// 10단계 제작 3 — 공개 저장소에 포함되지 않는 *로컬 가상 B 메모* 한 건만 복원합니다.
// 기존 메모 API, 운영 DB, 접근 정책, 다른 자료, 감사 이력을 수정하지 않습니다.
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { verifiedApiIdentity } from './api-resource-access.mjs';
import { requireUntouchedSources, verifyPolicyBackup } from './stage10-policy.mjs';

export const TEST_B_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
export const RESTORE_NOTE_ID = 'bbbbbbbb-2222-4222-8222-000000000010';
export const RESTORE_SERVICE = 'notes';
export const RESTORE_ROUTE = 'POST /api/restore';
const SCHEMA = 'aleph.stage10.private-note-backup.v1';
const STORE_SCHEMA = 'aleph.stage10.virtual-note-store.v1';
const privateRel = 'artifacts/stage10/private/b-note.json';
const checksumRel = 'artifacts/stage10/private/b-note.sha256';
const storeRel = 'artifacts/stage10/drill/virtual-notes.json';
const auditRel = 'artifacts/stage10/audit.jsonl';
const fail = code => { throw new Error(code); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const keys = object => Object.keys(object).sort().join(',');

export function noteContentHash(note) {
  if (!note || !uuidPattern.test(note.id ?? '') || !uuidPattern.test(note.owner_id ?? '')
      || typeof note.title !== 'string' || !note.title.length || note.title.length > 160
      || typeof note.body !== 'string' || !note.body.length || note.body.length > 4000) {
    fail('invalid_virtual_note');
  }
  // DB 저장 값의 식별자·소유자·본문을 순서가 고정된 형태로 해시화합니다.
  return sha256(Buffer.from(JSON.stringify([
    note.id, note.owner_id, note.title, note.body,
  ]), 'utf8'));
}

export function noteRestorePaths(root) {
  const base = resolve(root);
  return {
    backup: join(base, privateRel), checksum: join(base, checksumRel),
    store: join(base, storeRel), audit: join(base, auditRel),
  };
}

function ensureVirtualStore(value) {
  if (!value || value.schema !== STORE_SCHEMA || !Array.isArray(value.notes)
      || value.notes.length < 2 || value.notes.length > 20) fail('invalid_virtual_note_store');
  const ids = new Set();
  for (const note of value.notes) {
    noteContentHash(note);
    if (ids.has(note.id)) fail('duplicate_virtual_note_id');
    ids.add(note.id);
  }
  return value;
}

function readVirtualStore(root) {
  const { store } = noteRestorePaths(root);
  if (!existsSync(store)) fail('virtual_note_store_missing');
  let value;
  try { value = JSON.parse(readFileSync(store, 'utf8')); }
  catch { fail('invalid_virtual_note_store'); }
  return ensureVirtualStore(value);
}

export function verifyPrivateNoteBackup(root) {
  // 정책 백업도 없거나 손상되었으면 별도 메모 복원을 시작하지 않습니다.
  const policy = verifyPolicyBackup(root);
  requireUntouchedSources(root, policy.manifest);
  const { backup, checksum } = noteRestorePaths(root);
  if (!existsSync(backup) || !existsSync(checksum)) fail('private_note_backup_missing');
  const bytes = readFileSync(backup);
  const expected = readFileSync(checksum, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/u.test(expected) || sha256(bytes) !== expected) {
    fail('private_note_backup_hash_mismatch');
  }
  let manifest;
  try { manifest = JSON.parse(bytes.toString('utf8')); }
  catch { fail('private_note_backup_invalid'); }
  if (!manifest || manifest.schema !== SCHEMA || manifest.sourceCommit !== policy.manifest.sourceCommit
      || !manifest.note || keys(manifest.note) !== 'body,id,owner_id,title'
      || manifest.note.id !== RESTORE_NOTE_ID || manifest.note.owner_id !== TEST_B_ID
      || manifest.contentSha256 !== noteContentHash(manifest.note)) {
    fail('private_note_backup_invalid');
  }
  return { manifest, backupSha256: expected };
}

// 공개 저장소에 시험 메모 본문을 저장하지 않습니다. 매 실행마다 새 가상 데이터를 생성합니다.
// 기존 정책 백업, 시험 데이터, 감사 로그는 덮어쓰지 않습니다.
export function prepareVirtualBNote(root) {
  const { manifest: policy } = verifyPolicyBackup(root);
  requireUntouchedSources(root, policy);
  const paths = noteRestorePaths(root);
  if ([paths.backup, paths.checksum, paths.store].some(existsSync)) {
    fail('virtual_note_drill_already_exists');
  }
  const randomBody = () => `가상 시험 내용 ${randomBytes(24).toString('hex')}`;
  const target = { id: RESTORE_NOTE_ID, owner_id: TEST_B_ID,
    title: 'B 계정 복원 검증용 가상 메모', body: randomBody() };
  const otherB = { id: 'bbbbbbbb-2222-4222-8222-000000000020', owner_id: TEST_B_ID,
    title: 'B 계정 비대상 가상 메모', body: randomBody() };
  const otherA = { id: 'aaaaaaaa-1111-4111-8111-000000000030',
    owner_id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    title: 'A 계정 비대상 가상 메모', body: randomBody() };
  const privateSnapshot = { schema: SCHEMA, sourceCommit: policy.sourceCommit,
    note: target, contentSha256: noteContentHash(target) };
  const bytes = Buffer.from(`${JSON.stringify(privateSnapshot, null, 2)}\n`, 'utf8');
  const current = ensureVirtualStore({ schema: STORE_SCHEMA, notes: [
    { ...target, body: `${target.body} [tampered_fixture]` }, otherB, otherA,
  ] });
  mkdirSync(join(resolve(root), 'artifacts/stage10/private'), { recursive: true, mode: 0o700 });
  mkdirSync(join(resolve(root), 'artifacts/stage10/drill'), { recursive: true });
  writeFileSync(paths.backup, bytes, { flag: 'wx', mode: 0o600 });
  writeFileSync(paths.checksum, `${sha256(bytes)}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(paths.store, `${JSON.stringify(current, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const verified = verifyPrivateNoteBackup(root);
  if (verified.manifest.contentSha256 !== noteContentHash(target)) fail('private_note_verification_failed');
  return { id: target.id, owner: target.owner_id, contentSha256: privateSnapshot.contentSha256,
    backupSha256: sha256(bytes), policyCommit: policy.sourceCommit, otherNotes: 2 };
}

export function planVirtualNoteRestore(root) {
  const { manifest, backupSha256 } = verifyPrivateNoteBackup(root);
  const store = readVirtualStore(root);
  const selected = store.notes.filter(note => note.id === RESTORE_NOTE_ID);
  if (selected.length !== 1) fail('restore_target_missing_or_duplicate');
  const current = selected[0];
  // ID가 같아도 다른 계정 소유로 변경돼 있으면 무조건 중단합니다.
  if (current.owner_id !== TEST_B_ID) fail('restore_owner_mismatch');
  const before = noteContentHash(current);
  if (before === manifest.contentSha256) fail('virtual_note_already_restored');
  return {
    service: RESTORE_SERVICE, route: RESTORE_ROUTE,
    id: RESTORE_NOTE_ID, owner: TEST_B_ID,
    sourceCommit: manifest.sourceCommit,
    backupSha256, beforeSha256: before, afterSha256: manifest.contentSha256,
    target: storeRel, otherNotes: store.notes.length - 1, audit: auditRel,
  };
}

function appendAudit(path, data, event) {
  const previous = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
  const prefix = previous.length && previous[previous.length - 1] !== 10 ? '\n' : '';
  appendFileSync(path, `${prefix}${JSON.stringify({
    schema: 'aleph.stage10.virtual-note-audit.v1', at: new Date().toISOString(), event,
    target: data.id, owner: 'fixture-b', sourceCommit: data.sourceCommit,
    beforeSha256: data.beforeSha256, afterSha256: data.afterSha256,
  })}\n`, { flag: 'a', encoding: 'utf8' });
}

// 서버 검증 신원만 받고, 요청의 role/userId/owner_id는 믿거나 저장하지 않습니다.
export function restoreVirtualBNote(root, identity) {
  if (!verifiedApiIdentity(identity) || identity.kind !== 'student' || identity.userId !== TEST_B_ID) {
    fail('virtual_b_identity_required');
  }
  const plan = planVirtualNoteRestore(root);
  const { manifest } = verifyPrivateNoteBackup(root);
  const paths = noteRestorePaths(root);
  const store = readVirtualStore(root);
  const idx = store.notes.findIndex(note => note.id === RESTORE_NOTE_ID);
  if (idx < 0 || noteContentHash(store.notes[idx]) !== plan.beforeSha256) {
    fail('virtual_note_changed_before_restore');
  }
  // 계획한 한 레코드만 교체하고 다른 레코드의 순서·내용을 그대로 보존합니다.
  const untouched = store.notes.filter(note => note.id !== RESTORE_NOTE_ID)
    .map(note => noteContentHash(note));
  store.notes[idx] = { ...manifest.note };
  if (noteContentHash(store.notes[idx]) !== plan.afterSha256
      || JSON.stringify(store.notes.filter(note => note.id !== RESTORE_NOTE_ID)
        .map(note => noteContentHash(note))) !== JSON.stringify(untouched)) {
    fail('virtual_note_restore_verification_failed');
  }
  const temporary = `${paths.store}.restore-stage10.tmp`;
  if (existsSync(temporary)) fail('virtual_note_temp_exists');
  appendAudit(paths.audit, plan, 'note_restore_started');
  try {
    writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    if (noteContentHash(readVirtualStoreFromPath(temporary).notes[idx]) !== plan.afterSha256) {
      fail('virtual_note_temp_hash_mismatch');
    }
    // 한 번 더 검사하여 검증과 쓰기 사이의 변경을 최대한 방지합니다.
    if (noteContentHash(readVirtualStore(root).notes[idx]) !== plan.beforeSha256) {
      fail('virtual_note_changed_before_restore');
    }
    renameSync(temporary, paths.store);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
  const restored = readVirtualStore(root);
  if (noteContentHash(restored.notes[idx]) !== plan.afterSha256 || restored.notes[idx].owner_id !== TEST_B_ID) {
    fail('virtual_note_restore_verification_failed');
  }
  if (JSON.stringify(restored.notes.filter(note => note.id !== RESTORE_NOTE_ID)
    .map(note => noteContentHash(note))) !== JSON.stringify(untouched)) {
    fail('other_virtual_notes_changed');
  }
  appendAudit(paths.audit, plan, 'note_restore_completed');
  return { restored: true, id: plan.id, owner: plan.owner, contentSha256: plan.afterSha256,
    otherNotesPreserved: untouched.length, auditPreserved: true };
}

function readVirtualStoreFromPath(path) {
  let value;
  try { value = JSON.parse(readFileSync(path, 'utf8')); }
  catch { fail('invalid_virtual_note_store'); }
  return ensureVirtualStore(value);
}

// 인증된 POST만 통과시키는 작은 HTTP 핸들러. 복원 본문은 응답에 포함하지 않습니다.
export function createVirtualNoteRestoreHandler({ root, verifyIdentity }) {
  if (typeof verifyIdentity !== 'function') fail('identity_verifier_required');
  return async (request, response) => {
    const send = (status, value) => response.status(status).json(value);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return send(405, { error: 'METHOD_NOT_ALLOWED' });
    }
    if (!request.headers?.authorization) return send(401, { error: 'UNAUTHORIZED' });
    let identity;
    try { identity = await verifyIdentity(request.headers.authorization); }
    catch { return send(401, { error: 'UNAUTHORIZED' }); }
    if (!verifiedApiIdentity(identity) || identity.kind !== 'student' || identity.userId !== TEST_B_ID) {
      return send(403, { error: 'FORBIDDEN' });
    }
    let body;
    try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; }
    catch { return send(400, { error: 'INVALID_REQUEST' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || keys(body) !== 'id' || body.id !== RESTORE_NOTE_ID) {
      return send(400, { error: 'INVALID_REQUEST' });
    }
    try { return send(200, restoreVirtualBNote(root, identity)); }
    catch (error) {
      // 복원 대상의 실제 메모 내용·백업 상세를 외부 응답이나 로그에 기록하지 않습니다.
      if (error.message === 'virtual_note_already_restored') return send(409, { error: 'ALREADY_RESTORED' });
      if (error.message === 'restore_owner_mismatch') return send(403, { error: 'FORBIDDEN' });
      return send(503, { error: 'RESTORE_NOT_AVAILABLE' });
    }
  };
}

export function verifyRestoredVirtualBNote(root) {
  const { manifest } = verifyPrivateNoteBackup(root);
  const store = readVirtualStore(root);
  const selected = store.notes.filter(note => note.id === RESTORE_NOTE_ID);
  if (selected.length !== 1 || selected[0].owner_id !== TEST_B_ID
      || noteContentHash(selected[0]) !== manifest.contentSha256) {
    fail('restored_note_id_owner_hash_mismatch');
  }
  return { id: RESTORE_NOTE_ID, owner: TEST_B_ID, contentSha256: manifest.contentSha256,
    otherNotesPreserved: store.notes.length - 1 };
}
