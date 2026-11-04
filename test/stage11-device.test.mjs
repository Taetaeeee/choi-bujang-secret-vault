import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { SESSION_COOKIE, DEVICE_COOKIE, sealSession, openSession, readCookie,
  setSessionCookie, sameOrigin, authorizeVault } from '../src/vault-session.mjs';
import { deviceDigest, getDeviceApproval, requestDeviceApproval } from '../src/device-approval.mjs';
import { deviceHandler } from '../api/device.js';
import { notesHandler } from '../api/notes.js';

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const TEST_ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'stub',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stub', VAULT_SESSION_KEY: 'ab'.repeat(32) };
const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln';
const session = { access_token: fakeJwt, refresh_token: 'secret-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: A, email: 'student@example.invalid' } };
const realOrigin = 'https://choi-bujang-secret-vault-alpha-drab.vercel.app';

function response() {
  let status = 200; let payload;
  const headers = new Map();
  return {
    headers, get statusCode() { return status; }, get body() { return payload; },
    getHeader(key) { return headers.get(key); },
    setHeader(key, val) { headers.set(key, val); },
    status(n) { status = n; return this; },
    json(value) { payload = value; return this; },
  };
}
function deviceCookieFrom(responseObj) {
  const header = responseObj.getHeader('Set-Cookie');
  const line = header.find(value => value.startsWith(`${DEVICE_COOKIE}=`));
  return line.split(';')[0];
}
function fakeDb() {
  const devices = [];
  const notes = [
    { id: 'aaaaaaaa-1111-4111-8111-000000000001', owner_id: A, title: 'A', body: 'A 가상 메모' },
    { id: 'bbbbbbbb-2222-4222-8222-000000000001', owner_id: B, title: 'B', body: 'B 가상 메모' },
  ];
  const samples = [ { id: 1, owner_id: A, title: 'A 표본', content: 'A 전용 가상 자료' },
    { id: 2, owner_id: B, title: 'B 표본', content: 'B 전용 가상 자료' } ];
  let readProtected = 0;
  let failTable = false;
  const db = {
    devices,
    get protectedReads() { return readProtected; },
    set unavailable(v) { failTable = v; },
    from(name) {
      if (!['vault_device_approvals', 'vault_user_notes', 'vault_notes'].includes(name)) throw new Error(name);
      if (name !== 'vault_device_approvals') ++readProtected;
      let rows = name === 'vault_device_approvals' ? devices : name === 'vault_user_notes' ? notes : samples;
      let filtered = rows;
      let incoming = null;
      let updating = null;
      let removing = false;
      const query = {
        select() { return query; },
        eq(key, val) { filtered = filtered.filter(row => row[key] === val); return query; },
        in(key, values) { filtered = filtered.filter(row => values.includes(row[key])); return query; },
        order() { return Promise.resolve({ data: [...filtered], error: null }); },
        async maybeSingle() {
          if (failTable && name === 'vault_device_approvals') return { data: null, error: { code: 'NO_TABLE' } };
          const record = filtered[0] ?? null;
          if (record && updating) Object.assign(record, updating);
          if (record && removing) rows.splice(rows.indexOf(record), 1);
          return { data: record, error: null };
        },
        update(fields) { updating = fields; return query; },
        delete() { removing = true; return query; },
        insert(row) { incoming = { id: 'cccccccc-3333-4333-8333-cccccccccccc', ...row }; return query; },
        async single() { rows.push(incoming); return { data: incoming, error: null }; },
      };
      return query;
    },
  };
  return db;
}

test('세션 쿠키는 AEAD 검증·HttpOnly/Secure이며 위조한 쿠키가 인증을 만들지 못함', async () => {
  const value = sealSession(session, TEST_ENV);
  assert.ok(!value.includes(session.access_token));
  assert.ok(!value.includes(session.refresh_token));
  const req = { headers: { cookie: `${SESSION_COOKIE}=${value}` } };
  assert.deepEqual(openSession(req, TEST_ENV), session);
  const parts = value.split('.');
  parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`;
  const changed = parts.join('.');
  assert.equal(openSession({ headers: { cookie: `${SESSION_COOKIE}=${changed}` } }, TEST_ENV), null);
  assert.equal(readCookie({ headers: { cookie: `${SESSION_COOKIE}=x; ${SESSION_COOKIE}=y` } }, SESSION_COOKIE), null);
  const res = response(); setSessionCookie(res, session, TEST_ENV);
  assert.match(res.getHeader('Set-Cookie')[0], /HttpOnly; Secure; SameSite=Strict/u);
  assert.throws(() => sealSession(session, { ...TEST_ENV, VAULT_SESSION_KEY: '' }), /SESSION_CONFIG_UNAVAILABLE/u);
});

test('JWT는 검증된 서버 세션만 사용하고, 브라우저가 임의로 승인 상태를 보내도 신뢰하지 않음', async () => {
  const res = response(); setSessionCookie(res, session, TEST_ENV);
  const cookie = res.getHeader('Set-Cookie')[0].split(';')[0];
  const auth = await authorizeVault({ headers: { cookie } }, response(), {
    env: TEST_ENV, verify: async authorization => {
      assert.equal(authorization, `Bearer ${session.access_token}`);
      return { kind: 'student', userId: A };
    },
  });
  assert.equal(auth.identity.userId, A);
  const wrong = await authorizeVault({ headers: { cookie } }, response(), {
    env: TEST_ENV, verify: async () => ({ kind: 'student', userId: B }),
  });
  assert.equal(wrong.status, 401);
  assert.equal(sameOrigin({ headers: { origin: realOrigin } }), true);
  assert.equal(sameOrigin({ headers: { origin: 'https://attacker.invalid' } }), false);
});

test('승인 요청은 pending만 만들고, 운영자 승인 이후에만 approved가 보임', async () => {
  const db = fakeDb();
  const req = { headers: {} };
  const res = response();
  assert.equal((await getDeviceApproval(db, req, { kind: 'student', userId: A })).status, 'not_requested');
  const pending = await requestDeviceApproval(db, req, res, { kind: 'student', userId: A });
  assert.equal(pending.status, 'pending');
  assert.equal(db.devices[0].status, 'pending');
  assert.equal(db.devices[0].owner_id, A);
  assert.match(db.devices[0].device_digest, /^[0-9a-f]{64}$/u);
  const cookie = deviceCookieFrom(res);
  assert.ok(!cookie.includes(db.devices[0].device_digest));
  assert.match(res.getHeader('Set-Cookie')[0], /HttpOnly; Secure; SameSite=Strict/u);
  const sameBrowser = { headers: { cookie } };
  assert.equal((await getDeviceApproval(db, sameBrowser, { kind: 'student', userId: A })).status, 'pending');
  assert.equal((await getDeviceApproval(db, sameBrowser, { kind: 'student', userId: B })).status, 'not_requested');
  assert.equal((await requestDeviceApproval(db, sameBrowser, response(), { kind: 'student', userId: A })).status, 'pending');
  assert.equal(db.devices.length, 1);
  // 별도 권한의 운영자가 DB에서 한 건을 승인하는 모의 연습(승인 API 없음).
  db.devices[0].status = 'approved';
  assert.equal((await getDeviceApproval(db, sameBrowser, { kind: 'student', userId: A })).status, 'approved');
  db.devices[0].status = 'revoked';
  assert.equal((await getDeviceApproval(db, sameBrowser, { kind: 'student', userId: A })).status, 'revoked');
  assert.equal((await requestDeviceApproval(db, sameBrowser, response(), { kind: 'student', userId: A })).status, 'revoked');
  assert.equal(deviceDigest('not-a-token'), null);
  db.unavailable = true;
  assert.equal((await getDeviceApproval(db, sameBrowser, { kind: 'student', userId: A })).status, 'unavailable');
});

test('기기 API는 비로그인·외부 출처·클라이언트 자가 승인 요청을 거부', async () => {
  const db = fakeDb();
  const authorized = async () => ({ identity: { kind: 'student', userId: A }, status: 200 });
  const options = { authorize: authorized, makeDb: () => db };
  let res = response();
  await deviceHandler({ method: 'POST', headers: { origin: 'https://attacker.invalid' },
    body: { action: 'request' } }, res, options);
  assert.equal(res.statusCode, 403);
  res = response();
  await deviceHandler({ method: 'POST', headers: { origin: realOrigin },
    body: { action: 'approve' } }, res, options);
  assert.equal(res.statusCode, 400);
  res = response();
  await deviceHandler({ method: 'POST', headers: { origin: realOrigin },
    body: { action: 'request', status: 'approved' } }, res, options);
  assert.equal(res.statusCode, 400);
  res = response();
  await deviceHandler({ method: 'GET', headers: {} }, res, {
    ...options, authorize: async () => ({ status: 401, error: 'UNAUTHORIZED' }),
  });
  assert.equal(res.statusCode, 401);
  res = response();
  await deviceHandler({ method: 'POST', headers: { origin: realOrigin },
    body: { action: 'request' } }, res, options);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'pending');
});

test('미승인·승인 기록 오류는 API에서 보호 자료 조회 전 차단', async () => {
  const db = fakeDb();
  const opts = { authorize: async () => ({ identity: { kind: 'student', userId: A }, status: 200 }),
    makeDb: () => db, deviceLookup: async () => ({ status: 'pending' }) };
  let res = response();
  await notesHandler({ method: 'GET', headers: {}, query: {} }, res, opts);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'DEVICE_NOT_APPROVED');
  assert.equal(db.protectedReads, 0);
  res = response();
  await notesHandler({ method: 'GET', headers: {}, query: {} }, res, {
    ...opts, deviceLookup: async () => ({ status: 'unavailable' }),
  });
  assert.equal(res.statusCode, 503);
  assert.equal(db.protectedReads, 0);
  res = response();
  await notesHandler({ method: 'GET', headers: {}, query: {} }, res, {
    ...opts, authorize: async () => ({ status: 401, error: 'UNAUTHORIZED' }),
  });
  assert.equal(res.statusCode, 401);
  assert.equal(db.protectedReads, 0);
});

test('서버가 승인한 계정의 기존 메모 목록은 정상, 타인 메모는 노출하지 않음', async () => {
  const db = fakeDb();
  const opts = { authorize: async () => ({ identity: { kind: 'student', userId: A }, status: 200 }),
    makeDb: () => db, deviceLookup: async () => ({ status: 'approved' }) };
  let res = response();
  await notesHandler({ method: 'GET', headers: {}, query: {} }, res, opts);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.notes.length, 1);
  assert.equal(res.body.notes[0].title, 'A');
  assert.equal(res.body.sampleNotes.length, 1);
  assert.equal(res.body.sampleNotes[0].title, 'A 표본');
  res = response();
  await notesHandler({ method: 'GET', headers: {},
    query: { noteId: 'bbbbbbbb-2222-4222-8222-000000000001' } }, res, opts);
  assert.equal(res.statusCode, 404);
  res = response();
  await notesHandler({ method: 'POST', headers: { origin: 'https://attacker.invalid' },
    body: { title: 'X', body: 'X' }, query: {} }, res, opts);
  assert.equal(res.statusCode, 403);
});

test('미승인 기기는 메모 조회뿐 아니라 생성·수정·삭제도 서버에서 차단', async () => {
  const db = fakeDb();
  const options = { authorize: async () => ({ identity: { kind: 'student', userId: A }, status: 200 }),
    makeDb: () => db, deviceLookup: async () => ({ status: 'pending' }) };
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const req = { method, headers: { origin: realOrigin },
      query: ['PUT', 'DELETE'].includes(method)
        ? { noteId: 'aaaaaaaa-1111-4111-8111-000000000001' } : {},
      body: { title: 'X', body: 'X' } };
    const res = response();
    await notesHandler(req, res, options);
    assert.equal(res.statusCode, 403, `${method} 미승인 차단`);
    assert.equal(res.body.error, 'DEVICE_NOT_APPROVED');
  }
  assert.equal(db.protectedReads, 0);
});

test('서버 승인을 받은 기기는 기존 메모 추가·수정·삭제를 그대로 수행', async () => {
  const db = fakeDb();
  const options = { authorize: async () => ({ identity: { kind: 'student', userId: A }, status: 200 }),
    makeDb: () => db, deviceLookup: async () => ({ status: 'approved' }) };
  const id = 'dddddddd-4444-4444-8444-dddddddddddd';
  let res = response();
  await notesHandler({ method: 'POST', headers: { origin: realOrigin }, query: {},
    body: { id, title: '새 메모', body: '가상 본문' } }, res, options);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, id);
  res = response();
  await notesHandler({ method: 'PUT', headers: { origin: realOrigin }, query: { noteId: id },
    body: { title: '수정된 메모', body: '가상 수정' } }, res, options);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.title, '수정된 메모');
  res = response();
  await notesHandler({ method: 'DELETE', headers: { origin: realOrigin },
    query: { noteId: id } }, res, options);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, id);
  res = response();
  await notesHandler({ method: 'GET', headers: {}, query: { noteId: id } }, res, options);
  assert.equal(res.statusCode, 404);
});

test('브라우저와 서버 코드에 공개 승인 API 또는 로컬 토큰 저장이 없음', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../api/auth.js', import.meta.url), 'utf8');
  const api = await readFile(new URL('../api/device.js', import.meta.url), 'utf8');
  const notes = await readFile(new URL('../api/notes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage)\.setItem/u);
  assert.doesNotMatch(auth, /session: \{\s*access_token/u);
  assert.doesNotMatch(api, /action === 'approve'/u);
  assert.match(notes, /deviceLookup\(db, request, identity\)/u);
  assert.match(notes, /approval.status !== 'approved'/u);
  assert.match(html, /lockNotes\('기기 승인 전에는 보호 자료를 제공하지 않습니다\.'/u);
});
