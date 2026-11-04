import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPolicyBackup } from '../src/stage10-policy.mjs';
import { planPolicyRestore, restorePolicyDrill, retestRestoredPolicy } from '../src/stage10-restore.mjs';
import { simulatePolicyTampering } from '../src/stage10-policy.mjs';
import {
  createVirtualNoteRestoreHandler, noteContentHash, noteRestorePaths, planVirtualNoteRestore,
  prepareVirtualBNote, RESTORE_NOTE_ID, restoreVirtualBNote, TEST_B_ID,
  verifyPrivateNoteBackup, verifyRestoredVirtualBNote,
} from '../src/stage10-note-restore.mjs';

const COMMIT = 'e6334b2060886d836e6b9da11609d1afa2fabbaf';
const RULE = 'if (request.deviceRegistered !== true) {';
const A_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = { kind: 'student', userId: TEST_B_ID };
const A = { kind: 'student', userId: A_ID };
const README = `# mock
## 4단계 저장점 (fixture)
- RLS 활성화 상태 \`true\`. \`authenticated\` 역할의 4개 정책: USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).
## 5단계 저장점 (fixture)
- \`public.vault_user_notes\` 한 테이블에서 \`PUBLIC\`, \`anon\`, \`authenticated\`의 직접 테이블 권한을 \`REVOKE ALL\`로 회수했습니다.
- SQL Editor에서 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE가 \`false\`, 개별 GRANT는 \`NULL\`임을 확인했습니다.
## 보너스 test
`;
const DECIDER = `export const RULE_IDS = Object.freeze(['device_registered', 'personal_note_read', 'starter.deny']);
export async function decide(request) {
  const response = (decision, reasonCode, ruleIds) => ({
    schema: 'aleph.decision.v1', requestId: request.requestId, decision, reasonCode, ruleIds,
  });
  ${RULE}
    return response('deny', 'device_not_registered', ['device_registered']);
  }
  if (request.service === 'notes' && request.method === 'GET' && request.route === 'GET /notes/:id'
      && request.path.startsWith('/notes/')) {
    return response('allow', 'approved', ['device_registered', 'personal_note_read']);
  }
  return response('deny', 'starter_not_ready', ['starter.deny']);
}
`;
const req = { service: 'notes', method: 'GET', requestId: 'fixture',
  route: 'GET /notes/:id', path: '/notes/1', deviceRegistered: true };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readStore = root => JSON.parse(readFileSync(noteRestorePaths(root).store,'utf8'));
const readAudit = root => readFileSync(noteRestorePaths(root).audit,'utf8');

async function fixture(run, { prepare = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'stage10-note-p3-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/decider.mjs'), DECIDER);
  writeFileSync(join(root, 'aleph.config.json'), JSON.stringify({step: 9, allowedRoutes:['GET /api/notes/:id']}));
  writeFileSync(join(root, 'README.md'), README);
  createPolicyBackup(root, { sourceCommit: COMMIT });
  simulatePolicyTampering(root);
  restorePolicyDrill(root, {confirm: true});
  if (prepare) prepareVirtualBNote(root);
  try { return await run(root); }
  finally { rmSync(root, {recursive:true, force:true}); }
}
function fakeResponse() {
  const res={headers:{},code:0,body:null};
  res.setHeader=(key,value)=>{res.headers[key]=value;};
  res.status=(code)=>{res.code=code;return {json(data){res.body=data;return data;}}};
  return res;
}
async function post(root, identity, body={id:RESTORE_NOTE_ID}, method='POST') {
  const res=fakeResponse();
  const handler=createVirtualNoteRestoreHandler({root, verifyIdentity:async authorization=> authorization==='Bearer fixture' ? identity : null});
  const authorization = 'Bearer fixture';
  await handler({method,headers:{authorization},body},res);
  return res;
}

test('비공개 백업 1건을 만들고 백업 파일을 다시 읽어 SHA-256 검증',()=>fixture(root=>{
  const snapshot=verifyPrivateNoteBackup(root);
  assert.equal(snapshot.manifest.note.id,RESTORE_NOTE_ID);
  assert.equal(snapshot.manifest.note.owner_id,TEST_B_ID);
  assert.equal(snapshot.manifest.contentSha256,noteContentHash(snapshot.manifest.note));
  assert.equal(snapshot.backupSha256,sha256(readFileSync(noteRestorePaths(root).backup)));
  assert.equal(readStore(root).notes.length,3);
}));

test('백업 파일이나 검증 해시가 없으면 복원 전 중단',()=>fixture(root=>{
  const paths=noteRestorePaths(root);const original=readFileSync(paths.store);
  unlinkSync(paths.checksum);
  assert.throws(()=>planVirtualNoteRestore(root),/private_note_backup_missing/);
  assert.deepEqual(readFileSync(paths.store),original);
}));

test('비공개 백업이 변조되면 저장소·감사 기록을 수정하지 않고 중단',()=>fixture(root=>{
  const paths=noteRestorePaths(root);const before=readFileSync(paths.store);
  const audit=readAudit(root);writeFileSync(paths.backup,`${readFileSync(paths.backup,'utf8')} `);
  assert.throws(()=>restoreVirtualBNote(root,B),/private_note_backup_hash_mismatch/);
  assert.deepEqual(readFileSync(paths.store),before);assert.equal(readAudit(root),audit);
}));

test('백업의 메모 소유자·ID 또는 내용 해시를 위조하면 중단',()=>fixture(root=>{
  const paths=noteRestorePaths(root);const parsed=JSON.parse(readFileSync(paths.backup));
  parsed.note.owner_id=A_ID;parsed.contentSha256=noteContentHash(parsed.note);
  const bytes=Buffer.from(`${JSON.stringify(parsed)}\n`);
  writeFileSync(paths.backup,bytes);writeFileSync(paths.checksum,`${sha256(bytes)}\n`);
  assert.throws(()=>planVirtualNoteRestore(root),/private_note_backup_invalid/);
}));

test('plan은 ID·소유자·전후 해시를 표시할 수 있고 아직 파일을 수정하지 않음',()=>fixture(root=>{
  const paths=noteRestorePaths(root);const store=readFileSync(paths.store);const audit=readAudit(root);
  const plan=planVirtualNoteRestore(root);
  assert.equal(plan.id,RESTORE_NOTE_ID);assert.equal(plan.owner,TEST_B_ID);
  assert.match(plan.beforeSha256,/^[a-f0-9]{64}$/);assert.notEqual(plan.beforeSha256,plan.afterSha256);
  assert.equal(plan.otherNotes,2);assert.deepEqual(readFileSync(paths.store),store);assert.equal(readAudit(root),audit);
}));

test('B만 POST 복원 성공: 대상 ID·소유자·내용 해시 검증 및 다른 메모·감사 이력 보존',()=>fixture(async root=>{
  const before=readStore(root);const others=before.notes.slice(1);
  const oldAudit=readAudit(root);
  const res=await post(root,B);
  assert.equal(res.code,200);assert.equal(res.body.restored,true);
  const verified=verifyRestoredVirtualBNote(root);
  assert.deepEqual([res.body.id,res.body.owner,res.body.contentSha256],
    [verified.id,verified.owner,verified.contentSha256]);
  assert.deepEqual(readStore(root).notes.slice(1),others);
  const audit=readAudit(root);assert.ok(audit.startsWith(oldAudit));
  assert.deepEqual(audit.trim().split('\n').slice(-2).map(line=>JSON.parse(line).event),
    ['note_restore_started','note_restore_completed']);
}));

test('A의 B 메모 접근은 거부되고 상태·감사 이력 변화 없음',()=>fixture(async root=>{
  const paths=noteRestorePaths(root);const old=readFileSync(paths.store);const audit=readAudit(root);
  const res=await post(root,A);
  assert.equal(res.code,403);assert.equal(res.body.error,'FORBIDDEN');
  assert.deepEqual(readFileSync(paths.store),old);assert.equal(readAudit(root),audit);
}));

test('비로그인/GET/잘못된 ID/role/owner_id·content 포함 요청을 거부',()=>fixture(async root=>{
  const paths=noteRestorePaths(root);const before=readFileSync(paths.store);const audit=readAudit(root);
  const res=fakeResponse();
  await createVirtualNoteRestoreHandler({root,verifyIdentity:async()=>B})(
    {method:'POST',headers:{},body:{id:RESTORE_NOTE_ID}},res);
  assert.equal(res.code,401);
  assert.equal((await post(root,B,{id:RESTORE_NOTE_ID},'GET')).code,405);
  for (const body of [{id:'other'},{id:RESTORE_NOTE_ID,owner_id:TEST_B_ID},
      {id:RESTORE_NOTE_ID,role:'admin'},{id:RESTORE_NOTE_ID,body:'injected'}]) {
    assert.equal((await post(root,B,body)).code,400);
  }
  assert.deepEqual(readFileSync(paths.store),before);assert.equal(readAudit(root),audit);
}));

test('시험 사본의 대상 메모 소유자를 A로 바꾸면 즉시 중단',()=>fixture(async root=>{
  const paths=noteRestorePaths(root),store=readStore(root);store.notes[0].owner_id=A_ID;
  writeFileSync(paths.store,JSON.stringify(store));const before=readFileSync(paths.store),audit=readAudit(root);
  assert.equal((await post(root,B)).code,403);
  assert.deepEqual(readFileSync(paths.store),before);assert.equal(readAudit(root),audit);
}));

test('같은 메모를 두 번 복원하지 않으며 기존 감사 이벤트를 중복 추가하지 않음',()=>fixture(async root=>{
  assert.equal((await post(root,B)).code,200);
  const audit=readAudit(root),before=readFileSync(noteRestorePaths(root).store);
  const res=await post(root,B);
  assert.equal(res.code,409);assert.equal(res.body.error,'ALREADY_RESTORED');
  assert.equal(readAudit(root),audit);assert.deepEqual(readFileSync(noteRestorePaths(root).store),before);
}));

test('README에 새 제작 기록을 더해도 과거 정책 원문이 같으면 제작 2 검증 가능',()=>fixture(async root=>{
  const path=join(root,'README.md');writeFileSync(path,`${readFileSync(path,'utf8')}\n## 10단계 제작 3\n- target id\n`);
  const result=await retestRestoredPolicy(root,req);
  assert.equal(result.length,4);assert.ok(result.every(item=>item.passed));
}));

test('README 과거 DB 권한 기록이 변조되면 백업 검증을 통과시키지 않음',()=>fixture(root=>{
  const path=join(root,'README.md');writeFileSync(path,readFileSync(path,'utf8').replace('REVOKE ALL','GRANT ALL'));
  assert.throws(()=>planVirtualNoteRestore(root),/historical_db_policy_changed/);
}));
