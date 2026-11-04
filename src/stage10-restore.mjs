// 10단계 제작 2 — 검증된 백업으로 *가상 시험 사본만* 복원합니다.
// 운영 decider, allowedRoutes, DB RLS/GRANT, 기존 감사 이력은 수정하지 않습니다.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ownsStoredNote } from './api-resource-access.mjs';
import { backupPaths, comparePolicyDrill, verifyConfigSource, verifyHistoricalDbEvidence, verifyPolicyBackup } from './stage10-policy.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const auditPath = root => join(resolve(root), 'artifacts/stage10/audit.jsonl');

function requireOriginalSources(root, manifest) {
  for (const [path, digest] of Object.entries(manifest.sourceFileHashes)) {
    if (path === 'README.md') {
      verifyHistoricalDbEvidence(root, manifest);
      continue;
    }
    if (path === 'aleph.config.json') {
      verifyConfigSource(root, manifest);
      continue;
    }
    let bytes;
    try { bytes = readFileSync(join(resolve(root), path)); }
    catch { fail('source_file_missing'); }
    if (sha256(bytes) !== digest) fail('source_changed_since_backup');
  }
}

// 쓰기 없이 출력할 복원 대상·변경 범위를 계산합니다.
export function planPolicyRestore(root) {
  const { manifest, digest } = verifyPolicyBackup(root);
  requireOriginalSources(root, manifest);
  const diff = comparePolicyDrill(root); // 예고하지 않은 변조는 복원 전에 중단
  const { drill } = backupPaths(root);
  const current = readFileSync(drill);
  if (current.toString('utf8') === manifest.decider.content) fail('drill_already_restored');
  return {
    sourceCommit: manifest.sourceCommit,
    backupSha256: digest,
    target: 'artifacts/stage10/drill/decider.mjs',
    beforeSha256: sha256(current),
    afterSha256: manifest.decider.sha256,
    changedLines: diff.changedLines,
    beforeLine: diff.added,
    afterLine: diff.removed,
    allowedRoutes: manifest.allowedRoutes.values.length,
    dbPolicyStatus: manifest.dbPolicy.status,
    audit: 'artifacts/stage10/audit.jsonl',
    unchanged: ['src/decider.mjs', 'aleph.config.json', 'README.md', 'Supabase DB'],
  };
}

function appendAudit(root, details, event) {
  const dest = auditPath(root);
  // 기존 내용은 읽기/덮어쓰지 않고 끝에만 새 사건을 추가합니다.
  const previous = existsSync(dest) ? readFileSync(dest) : Buffer.alloc(0);
  const prefix = previous.length && previous[previous.length - 1] !== 10 ? '\n' : '';
  const entry = {
    schema: 'aleph.stage10.restore-audit.v1',
    at: new Date().toISOString(), event,
    sourceCommit: details.sourceCommit, backupSha256: details.backupSha256,
    target: details.target, beforeSha256: details.beforeSha256,
    afterSha256: details.afterSha256,
  };
  appendFileSync(dest, `${prefix}${JSON.stringify(entry)}\n`, { encoding: 'utf8', flag: 'a' });
}

// 호출자가 명시적으로 확인한 경우에만 복원합니다. 실사용 정책은 절대 복원 대상으로 받지 않습니다.
export function restorePolicyDrill(root, { confirm = false } = {}) {
  const plan = planPolicyRestore(root);
  if (confirm !== true) fail('restore_confirmation_required');
  const { manifest } = verifyPolicyBackup(root);
  const { drill } = backupPaths(root);
  const base = resolve(root);
  requireOriginalSources(base, manifest);
  if (sha256(readFileSync(drill)) !== plan.beforeSha256) fail('drill_changed_before_restore');
  appendAudit(base, plan, 'restore_started');

  const temporary = join(base, 'artifacts/stage10/drill/.restore-stage10.tmp');
  if (existsSync(temporary)) fail('restore_temp_already_exists');
  try {
    writeFileSync(temporary, manifest.decider.content, { flag: 'wx', encoding: 'utf8' });
    if (sha256(readFileSync(temporary)) !== plan.afterSha256) fail('restored_temp_hash_mismatch');
    if (sha256(readFileSync(drill)) !== plan.beforeSha256) fail('drill_changed_before_restore');
    renameSync(temporary, drill);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
  if (sha256(readFileSync(drill)) !== plan.afterSha256) fail('restored_drill_hash_mismatch');
  requireOriginalSources(base, manifest);
  appendAudit(base, plan, 'restore_completed');
  return plan;
}

// 판정기에는 소유자 정보가 없으므로, 서버 API의 독립된 소유권 검사도 함께 재시험합니다.
// 실제 A/B 계정 로그인이나 운영 DB 요청이 아니라, 가상 UUID·요청으로 하는 로컬 연습입니다.
export async function retestRestoredPolicy(root, normalRequest) {
  const { manifest } = verifyPolicyBackup(root);
  requireOriginalSources(root, manifest);
  const { drill } = backupPaths(root);
  if (!existsSync(drill) || sha256(readFileSync(drill)) !== manifest.decider.sha256) {
    fail('drill_not_restored_or_hash_mismatch');
  }
  const url = `${pathToFileURL(drill).href}?sha256=${manifest.decider.sha256}`;
  const { decide, RULE_IDS } = await import(url);
  if (typeof decide !== 'function' || !Array.isArray(RULE_IDS)) fail('restored_decider_contract_invalid');
  const request = normalRequest;
  if (!request || typeof request !== 'object') fail('virtual_request_missing');
  const allowed = await decide(request);
  const denied = await decide({ ...request, deviceRegistered: false });
  const unknown = await decide({ ...request, service: 'instructor_materials',
    route: 'GET /instructor-materials/:id', path: '/instructor-materials/a' });
  const valid = (response, decision) => response && response.schema === 'aleph.decision.v1'
    && response.requestId === request.requestId && response.decision === decision
    && Object.keys(response).sort().join(',') === 'decision,reasonCode,requestId,ruleIds,schema'
    && Array.isArray(response.ruleIds) && response.ruleIds.length > 0
    && response.ruleIds.every(id => RULE_IDS.includes(id));
  const aId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  const bId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  const noteA = { owner_id: aId };
  const aOwns = ownsStoredNote({ kind: 'student', userId: aId }, noteA);
  const bOwns = ownsStoredNote({ kind: 'student', userId: bId }, noteA);
  const results = [
    { name: 'A의 정상 자료 요청', passed: valid(allowed, 'allow') && aOwns },
    { name: 'B의 A 자료 요청 거부(서버 소유자 검사)', passed: valid(allowed, 'allow') && !bOwns },
    { name: '미등록 기기 거부', passed: valid(denied, 'deny') },
    { name: '다른 서비스/강사 자료 거부 규칙 유지', passed: valid(unknown, 'deny') },
  ];
  if (results.some(result => !result.passed)) fail('restored_access_regression_failed');
  return results;
}
