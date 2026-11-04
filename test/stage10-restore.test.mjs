import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupPaths, createPolicyBackup, simulatePolicyTampering, verifyPolicyBackup } from '../src/stage10-policy.mjs';
import { planPolicyRestore, restorePolicyDrill, retestRestoredPolicy } from '../src/stage10-restore.mjs';

const COMMIT = 'e6334b2060886d836e6b9da11609d1afa2fabbaf';
const RULE = 'if (request.deviceRegistered !== true) {';
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
const README = [
  '# mock',
  '## 4단계 저장점 (fixture)',
  '- RLS 활성화 상태 `true`. `authenticated` 역할의 4개 정책: USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).',
  '## 5단계 저장점 (fixture)',
  '- `public.vault_user_notes` 한 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 테이블 권한을 `REVOKE ALL`로 회수했습니다.',
  '- SQL Editor에서 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE가 `false`, 개별 GRANT는 `NULL`임을 확인했습니다.',
  '## 보너스 test',
].join('\n');
const request = {
  requestId: 'fixture-request', service: 'notes', method: 'GET', route: 'GET /notes/:id',
  path: '/notes/a', deviceRegistered: true,
};

async function fixture(fn, { backup = true, simulate = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'stage10-restore-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/decider.mjs'), DECIDER);
  writeFileSync(join(root, 'aleph.config.json'), JSON.stringify({ step: 9, allowedRoutes: ['GET /api/notes/:id'] }));
  writeFileSync(join(root, 'README.md'), README);
  if (backup) createPolicyBackup(root, { sourceCommit: COMMIT });
  if (simulate) simulatePolicyTampering(root);
  try { return await fn(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('복원 전 계획은 버전·변경 한 줄·해시·보존 범위를 보여 주되 쓰지 않는다', () => fixture(root => {
  const { drill } = backupPaths(root);
  const before = readFileSync(drill, 'utf8');
  const plan = planPolicyRestore(root);
  assert.equal(plan.sourceCommit, COMMIT);
  assert.equal(plan.changedLines, 1);
  assert.equal(plan.beforeLine, 'if (request.deviceRegistered === false) {');
  assert.equal(plan.afterLine, RULE);
  assert.match(plan.beforeSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(plan.unchanged, ['src/decider.mjs', 'aleph.config.json', 'README.md', 'Supabase DB']);
  assert.equal(readFileSync(drill, 'utf8'), before);
  assert.equal(existsSync(join(root, 'artifacts/stage10/audit.jsonl')), false);
}));

test('명시적 승인 없이 복원하지 않는다', () => fixture(root => {
  const { drill } = backupPaths(root);
  const before = readFileSync(drill, 'utf8');
  assert.throws(() => restorePolicyDrill(root), /restore_confirmation_required/);
  assert.equal(readFileSync(drill, 'utf8'), before);
}));

test('복원은 시험 사본만 되돌리고, 기존 감사 기록에 시작/완료 사건만 추가한다', () => fixture(root => {
  const sourcePaths = ['src/decider.mjs', 'aleph.config.json', 'README.md'];
  const original = sourcePaths.map(path => readFileSync(join(root, path)));
  const audit = join(root, 'artifacts/stage10/audit.jsonl');
  const historical = '{"event":"older-service-audit","subject":"virtual"}\n';
  writeFileSync(audit, historical);
  const plan = restorePolicyDrill(root, { confirm: true });
  const { manifest } = verifyPolicyBackup(root);
  assert.equal(readFileSync(backupPaths(root).drill, 'utf8'), manifest.decider.content);
  assert.equal(plan.afterSha256, manifest.decider.sha256);
  assert.deepEqual(sourcePaths.map(path => readFileSync(join(root, path))), original);
  const history = readFileSync(audit, 'utf8');
  assert.ok(history.startsWith(historical));
  const events = history.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.map(entry => entry.event), ['older-service-audit', 'restore_started', 'restore_completed']);
  assert.equal(existsSync(join(root, 'artifacts/stage10/drill/.restore-stage10.tmp')), false);
}));

test('복원 후 가상 A 본인 자료 허용·B의 A 자료 거부·기기 거부·다른 서비스 차단 확인', () => fixture(async root => {
  await assert.rejects(() => retestRestoredPolicy(root, request), /drill_not_restored_or_hash_mismatch/);
  restorePolicyDrill(root, { confirm: true });
  const results = await retestRestoredPolicy(root, request);
  assert.equal(results.length, 4);
  assert.ok(results.every(item => item.passed));
}));

test('백업 또는 해시 누락 시 복원 중단하고 감사 기록도 만들지 않는다', () => fixture(root => {
  unlinkSync(backupPaths(root).checksum);
  const original = readFileSync(backupPaths(root).drill, 'utf8');
  assert.throws(() => restorePolicyDrill(root, { confirm: true }), /backup_or_checksum_missing/);
  assert.equal(readFileSync(backupPaths(root).drill, 'utf8'), original);
  assert.equal(existsSync(join(root, 'artifacts/stage10/audit.jsonl')), false);
}));

test('백업 해시 위조와 예상하지 않은 시험 사본 변경 시 복원 중단', async () => {
  await fixture(root => {
    const { backup, drill } = backupPaths(root);
    writeFileSync(backup, `${readFileSync(backup, 'utf8')}x`);
    const before = readFileSync(drill, 'utf8');
    assert.throws(() => restorePolicyDrill(root, { confirm: true }), /backup_sha256_mismatch/);
    assert.equal(readFileSync(drill, 'utf8'), before);
  });
  await fixture(root => {
    const { drill } = backupPaths(root);
    writeFileSync(drill, `${readFileSync(drill, 'utf8')}\nextra rule`);
    assert.throws(() => restorePolicyDrill(root, { confirm: true }), /unexpected_drill_change/);
  });
});

test('원본 코드나 다른 서비스 설정이 백업 이후 바뀌면 중단', () => fixture(root => {
  const { drill } = backupPaths(root);
  const original = readFileSync(drill, 'utf8');
  writeFileSync(join(root, 'aleph.config.json'), JSON.stringify({ step: 9, allowedRoutes: [] }));
  assert.throws(() => restorePolicyDrill(root, { confirm: true }), /source_changed_since_backup/);
  assert.equal(readFileSync(drill, 'utf8'), original);
}));

test('이미 복원한 시험 사본을 또 복원하지 않고 감사 사건을 중복 추가하지 않는다', () => fixture(root => {
  restorePolicyDrill(root, { confirm: true });
  const audit = join(root, 'artifacts/stage10/audit.jsonl');
  const history = readFileSync(audit, 'utf8');
  assert.throws(() => restorePolicyDrill(root, { confirm: true }), /unexpected_drill_change|drill_already_restored/);
  assert.equal(readFileSync(audit, 'utf8'), history);
}));


test('단계 10 저장점 후 기존 정책 사본으로 시험 정책 복원·재검증 가능', () => fixture(async root => {
  const config = join(root, 'aleph.config.json');
  const original = readFileSync(config, 'utf8');
  writeFileSync(config, original.replace('"step":9', '"step":10'));
  const plan = planPolicyRestore(root);
  assert.equal(plan.changedLines, 1);
  restorePolicyDrill(root, { confirm: true });
  const checks = await retestRestoredPolicy(root, request);
  assert.ok(checks.every(item => item.passed));
}));
