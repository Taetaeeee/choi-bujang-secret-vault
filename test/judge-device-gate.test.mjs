import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { authorizeVault } from '../src/vault-session.mjs';
import { notesHandler } from '../api/notes.js';
import { operationsHandler } from '../api/operations.js';

// All identities, JWTs, keys and notes below are in-memory synthetic fixtures.
// This does NOT exercise an official judge JWT, Supabase, or a production deployment.
const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const RUN = 'cccccccc-3333-4333-8333-cccccccccccc';
const A_NOTE = 'aaaaaaaa-1111-4111-8111-000000000001';
const B_NOTE = 'bbbbbbbb-2222-4222-8222-000000000001';
const NEW_NOTE = 'dddddddd-4444-4444-8444-dddddddddddd';
const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-secret',
  VAULT_SESSION_KEY: 'ab'.repeat(32) };

function makeResponse() {
  let statusCode = 200; let body = null;
  const headers = new Map();
  return {
    headers, get statusCode() { return statusCode; }, get body() { return body; },
    setHeader(k, v) { headers.set(k, v); },
    getHeader(k) { return headers.get(k); },
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
}

function fakeDb() {
  const notes = [
    { id: A_NOTE, owner_id: A, title: 'A fixture', body: 'A fixture body' },
    { id: B_NOTE, owner_id: B, title: 'B fixture', body: 'B fixture body' },
  ];
  let protectedReads = 0;
  return {
    get protectedReads() { return protectedReads; },
    from(name) {
      assert.ok(['vault_user_notes', 'vault_notes'].includes(name), `unexpected DB table: ${name}`);
      if (name !== 'vault_notes') protectedReads++;
      const rows = name === 'vault_notes' ? [] : notes;
      let filtered = rows;
      let toInsert, toUpdate, toDelete = false;
      const query = {
        select() { return query; },
        eq(key, val) { filtered = filtered.filter(row => row[key] === val); return query; },
        in(key, vals) { filtered = filtered.filter(row => vals.includes(row[key])); return query; },
        order() { return Promise.resolve({ data: [...filtered], error: null }); },
        insert(row) { toInsert = { ...row }; return query; },
        update(change) { toUpdate = change; return query; },
        delete() { toDelete = true; return query; },
        async single() {
          assert.ok(toInsert, 'unexpected single()');
          if (rows.some(row => row.id === toInsert.id)) return { data: null, error: { code: '23505' } };
          rows.push(toInsert);
          return { data: { ...toInsert }, error: null };
        },
        async maybeSingle() {
          const row = filtered[0] ?? null;
          if (row && toUpdate) Object.assign(row, toUpdate);
          if (row && toDelete) rows.splice(rows.indexOf(row), 1);
          return { data: row ? { ...row } : null, error: null };
        },
      };
      return query;
    },
  };
}

async function fixtureIssuer() {
  const legit = await generateKeyPair('ES256');
  const forged = await generateKeyPair('ES256');
  const verifier = createLoginVerifier({
    config,
    judgeKeySet: async () => legit.publicKey,
    supabaseClient: { auth: { getClaims: async () => ({ data: {}, error: new Error('fixture-only') }) } },
  });
  async function token(userId, identity, { key = legit.privateKey, role = 'judge' } = {}) {
    return new SignJWT({ aleph_run: RUN, aleph_role: role, aleph_identity: identity })
      .setProtectedHeader({ alg: 'ES256' }).setIssuer(config.judgeIssuer)
      .setAudience(new URL(config.publicAppUrl).hostname).setSubject(userId)
      .setIssuedAt().setExpirationTime('5m').sign(key);
  }
  const authorize = (request, response) => authorizeVault(request, response, { env, verify: verifier });
  return { token, authorize, forgedKey: forged.privateKey };
}

function request(method, token, noteId, body, extraHeaders = {}) {
  return { method, query: noteId ? { noteId } : {}, body,
    headers: { authorization: `Bearer ${token}`, ...extraHeaders } };
}
async function callNotes(req, options) {
  const res = makeResponse();
  await notesHandler(req, res, options);
  return res;
}

test('검증된 심판 JWT A/B가 기기 쿠키 없이 자기 메모만 읽고 타인 메모는 404', async () => {
  const { token, authorize } = await fixtureIssuer();
  const aToken = await token(A, 'a');
  const bToken = await token(B, 'b');
  const db = fakeDb();
  let deviceLookups = 0;
  const options = { authorize, makeDb: () => db,
    deviceLookup: async () => { deviceLookups++; return { status: 'not_requested' }; } };
  let res = await callNotes(request('GET', aToken, A_NOTE), options);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, A_NOTE);
  res = await callNotes(request('GET', bToken, A_NOTE), options);
  assert.equal(res.statusCode, 404);
  res = await callNotes(request('GET', bToken, B_NOTE), options);
  assert.equal(res.statusCode, 200);
  res = await callNotes(request('GET', aToken, B_NOTE), options);
  assert.equal(res.statusCode, 404);
  assert.equal(deviceLookups, 0, '심판은 학생 기기 승인 테이블을 사용하지 않음');
});

test('검증된 심판 Bearer POST는 SameSite 브라우저 Origin 없이 자기 ID로만 생성', async () => {
  const { token, authorize } = await fixtureIssuer();
  const aToken = await token(A, 'a');
  const bToken = await token(B, 'b');
  const db = fakeDb();
  const opts = { authorize, makeDb: () => db, deviceLookup: async () => ({ status: 'not_requested' }) };
  let res = await callNotes(request('POST', aToken, undefined,
    { id: NEW_NOTE, title: 'new fixture', body: 'no production data' }), opts);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, NEW_NOTE);
  res = await callNotes(request('GET', aToken, NEW_NOTE), opts);
  assert.equal(res.statusCode, 200);
  res = await callNotes(request('GET', bToken, NEW_NOTE), opts);
  assert.equal(res.statusCode, 404);
});

test('심판 JWT 서명 위조·잘못된 역할은 401이며 DB 접근 없음', async () => {
  const { token, authorize, forgedKey } = await fixtureIssuer();
  const db = fakeDb();
  const opts = { authorize, makeDb: () => db, deviceLookup: async () => ({ status: 'approved' }) };
  for (const invalid of [await token(A, 'a', { key: forgedKey }),
    await token(A, 'a', { role: 'student' })]) {
    const res = await callNotes(request('GET', invalid, A_NOTE), opts);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(db.protectedReads, 0);
});

test('미승인 학생은 헤더에서 judge를 주장해도 403, 승인 학생은 본인만 접근', async () => {
  const db = fakeDb();
  const student = { kind: 'student', userId: A };
  const authorize = async () => ({ identity: student, session: {}, status: 200 });
  let res = await callNotes({ method: 'GET', query: { noteId: A_NOTE },
    headers: { 'x-aleph-role': 'judge' } }, { authorize, makeDb: () => db,
    deviceLookup: async () => ({ status: 'pending' }) });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'DEVICE_NOT_APPROVED');
  assert.equal(db.protectedReads, 0);
  const approved = { authorize, makeDb: () => db,
    deviceLookup: async () => ({ status: 'approved' }) };
  res = await callNotes({ method: 'GET', query: { noteId: A_NOTE }, headers: {} }, approved);
  assert.equal(res.statusCode, 200);
  res = await callNotes({ method: 'GET', query: { noteId: B_NOTE }, headers: {} }, approved);
  assert.equal(res.statusCode, 404);
  res = await callNotes({ method: 'POST', query: {}, headers: { origin: 'https://attacker.invalid' },
    body: { title: 'X', body: 'X' } }, approved);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'ORIGIN_FORBIDDEN');
});

test('운영 요약 API는 심판에게 계속 403: 학생 전용 경계를 유지', async () => {
  const { token, authorize } = await fixtureIssuer();
  const res = makeResponse();
  await operationsHandler(request('GET', await token(A, 'a')), res, {
    authorize,
    makeDb: () => { throw new Error('must not call DB for judge'); },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});
