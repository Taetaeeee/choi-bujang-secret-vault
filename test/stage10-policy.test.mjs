import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupPaths, comparePolicyDrill, createPolicyBackup, simulatePolicyTampering,
  verifyPolicyBackup, requireUntouchedSources,
} from '../src/stage10-policy.mjs';

const COMMIT = 'e6334b2060886d836e6b9da11609d1afa2fabbaf';
const RULE = 'if (request.deviceRegistered !== true) {';
const README = [
  '# mock',
  '## 4단계 저장점 (fixture)',
  '- RLS 활성화 상태 `true`. `authenticated` 역할의 4개 정책: USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).',
  '## 5단계 저장점 (fixture)',
  '- `public.vault_user_notes` 한 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 테이블 권한을 `REVOKE ALL`로 회수했습니다.',
  '- SQL Editor에서 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE가 `false`, 개별 GRANT는 `NULL`임을 확인했습니다.',
  '## 보너스 test',
].join('\n');

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'stage10-fixture-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/decider.mjs'), `export async function decide(request) {\n  ${RULE}\n    return 'deny';\n  }\n}`);
  writeFileSync(join(root, 'aleph.config.json'), JSON.stringify({ step: 9, allowedRoutes: ['GET /api/notes/:id'] }));
  writeFileSync(join(root, 'README.md'), README);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('사본을 새로 만들고 기록을 다시 읽어 SHA-256을 확인한다', () => fixture(root => {
  const result = createPolicyBackup(root, { sourceCommit: COMMIT });
  assert.match(result.digest, /^[0-9a-f]{64}$/);
  const { manifest } = verifyPolicyBackup(root);
  assert.equal(manifest.sourceCommit, COMMIT);
  assert.deepEqual(manifest.allowedRoutes.values, ['GET /api/notes/:id']);
  assert.equal(manifest.dbPolicy.status, 'historical_documentation_only_not_live_verified');
}));

test('백업 이전의 시험 변조는 중단하며 원본은 건드리지 않는다', () => fixture(root => {
  const before = readFileSync(join(root, 'src/decider.mjs'), 'utf8');
  assert.throws(() => simulatePolicyTampering(root), /backup_or_checksum_missing/);
  assert.equal(readFileSync(join(root, 'src/decider.mjs'), 'utf8'), before);
}));

test('해시가 맞지 않으면 시험 변조를 시작하지 않는다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  const { backup } = backupPaths(root);
  writeFileSync(backup, `${readFileSync(backup, 'utf8')} `);
  assert.throws(() => simulatePolicyTampering(root), /backup_sha256_mismatch/);
}));

test('백업이나 해시 파일이 하나라도 없으면 중단한다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  unlinkSync(backupPaths(root).checksum);
  assert.throws(() => verifyPolicyBackup(root), /backup_or_checksum_missing/);
}));

test('시험 사본은 한 줄만 달라지고 실제 정책 3개 파일은 불변이다', () => fixture(root => {
  const before = ['src/decider.mjs', 'aleph.config.json', 'README.md']
    .map(path => readFileSync(join(root, path), 'utf8'));
  createPolicyBackup(root, { sourceCommit: COMMIT });
  const result = simulatePolicyTampering(root);
  assert.equal(result.changedLines, 1);
  assert.equal(result.removed, RULE);
  assert.equal(result.added, 'if (request.deviceRegistered === false) {');
  assert.deepEqual(['src/decider.mjs', 'aleph.config.json', 'README.md']
    .map(path => readFileSync(join(root, path), 'utf8')), before);
  assert.deepEqual(comparePolicyDrill(root), result);
}));

test('백업 생성은 기존 사본을 덮어쓰지 않는다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  assert.throws(() => createPolicyBackup(root, { sourceCommit: COMMIT }), /backup_already_exists/);
}));

test('백업 후 원본이 바뀌었다면 시험 변조를 중단한다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  writeFileSync(join(root, 'aleph.config.json'), JSON.stringify({ step: 9, allowedRoutes: [] }));
  assert.throws(() => simulatePolicyTampering(root), /current_source_changed_since_backup/);
}));

test('시험용 사본에 예고하지 않은 차이가 있으면 내용을 출력하지 않고 중단한다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  simulatePolicyTampering(root);
  writeFileSync(backupPaths(root).drill, 'unexpected malicious rule');
  assert.throws(() => comparePolicyDrill(root), /unexpected_drill_change/);
}));

test('현재 README에 DB 정책 근거가 없다면 생성하지 않는다', () => fixture(root => {
  writeFileSync(join(root, 'README.md'), 'no policy available');
  assert.throws(() => createPolicyBackup(root, { sourceCommit: COMMIT }), /db_documentation_missing/);
}));


test('10단계 저장점은 step 9→10만 변경한 설정을 기존 검증된 사본과 호환한다', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  const path = join(root, 'aleph.config.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, original.replace('"step":9', '"step":10'));
  const { manifest } = verifyPolicyBackup(root);
  assert.doesNotThrow(() => requireUntouchedSources(root, manifest));
  assert.equal(simulatePolicyTampering(root).changedLines, 1);
}));

test('step 10으로 올려도 허용 경로 또는 다른 설정이 바뀌면 복원 거부', () => fixture(root => {
  createPolicyBackup(root, { sourceCommit: COMMIT });
  const path = join(root, 'aleph.config.json');
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const { manifest } = verifyPolicyBackup(root);
  writeFileSync(path, JSON.stringify({ ...original, step: 10, allowedRoutes: ['GET /api/all'] }));
  assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/);
  writeFileSync(path, JSON.stringify({ ...original, step: 10, extra: 'unapproved' }));
  assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/);
}));
