// 10단계 제작 1: 운영 정책은 읽기 전용으로 다루고 시험 사본만 변조합니다.
// DB 정책 근거는 README의 과거 기록이며 현재 Supabase 정책 실측이 아닙니다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BACKUP = 'artifacts/stage10/verified-policy.json';
const CHECKSUM = 'artifacts/stage10/verified-policy.sha256';
const DRILL = 'artifacts/stage10/drill/decider.mjs';
const SCHEMA = 'aleph.stage10.policy-backup.v1';
const ORIGINAL_RULE = 'if (request.deviceRegistered !== true) {';
const TAMPERED_RULE = 'if (request.deviceRegistered === false) {';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const checksum = value => sha256(Buffer.from(value, 'utf8'));

function selectEvidence(readme) {
  const fourth = readme.split('## 4단계 저장점 (')[1]?.split('## 5단계 저장점 (')[0];
  const fifth = readme.split('## 5단계 저장점 (')[1]?.split('## 보너스 ')[0];
  if (!fourth || !fifth) fail('db_documentation_missing');
  const selectLine = (section, required) => section.split(/\r?\n/u)
    .find(line => required.every(fragment => line.includes(fragment)));
  const rls = selectLine(fourth, ['RLS 활성화 상태', 'auth.uid() = owner_id', 'WITH CHECK']);
  const privileges = selectLine(fifth, ['REVOKE ALL', 'PUBLIC', 'anon', 'authenticated']);
  const verified = selectLine(fifth, ['anon·authenticated', 'false', 'NULL']);
  if (!rls || !privileges || !verified) fail('db_documentation_incomplete');
  return [rls, privileges, verified];
}

function baseline(root, sourceCommit) {
  const decider = read(root, 'src/decider.mjs');
  const configRaw = read(root, 'aleph.config.json');
  const readme = read(root, 'README.md');
  let config;
  try { config = JSON.parse(configRaw); } catch { fail('invalid_config_json'); }
  if (!Array.isArray(config.allowedRoutes) || !config.allowedRoutes.length
      || config.allowedRoutes.some(route => typeof route !== 'string' || !route.trim())) {
    fail('allowed_routes_missing');
  }
  const evidence = selectEvidence(readme);
  if (decider.split(ORIGINAL_RULE).length !== 2) fail('original_rule_missing_or_ambiguous');
  return {
    schema: SCHEMA,
    sourceCommit,
    scope: ['src/decider.mjs', 'aleph.config.json#allowedRoutes', 'README.md#historical-db-policy'],
    decider: { sha256: checksum(decider), content: decider },
    allowedRoutes: { sha256: checksum(JSON.stringify(config.allowedRoutes)), values: config.allowedRoutes },
    dbPolicy: {
      table: 'public.vault_user_notes',
      source: 'README.md (4·5단계 기록)',
      status: 'historical_documentation_only_not_live_verified',
      evidence,
      sha256: checksum(JSON.stringify(evidence)),
    },
    sourceFileHashes: {
      'src/decider.mjs': checksum(decider),
      'aleph.config.json': checksum(configRaw),
      'README.md': checksum(readme),
    },
  };
}

function verifyManifest(manifest) {
  if (!manifest || manifest.schema !== SCHEMA || !/^[0-9a-f]{40}$/u.test(manifest.sourceCommit ?? '')) {
    fail('invalid_backup_manifest');
  }
  if (!manifest.decider || typeof manifest.decider.content !== 'string'
      || manifest.decider.sha256 !== checksum(manifest.decider.content)
      || !Array.isArray(manifest.allowedRoutes?.values)
      || manifest.allowedRoutes.sha256 !== checksum(JSON.stringify(manifest.allowedRoutes.values))
      || !Array.isArray(manifest.dbPolicy?.evidence)
      || manifest.dbPolicy.status !== 'historical_documentation_only_not_live_verified'
      || manifest.dbPolicy.sha256 !== checksum(JSON.stringify(manifest.dbPolicy.evidence))) {
    fail('backup_section_hash_mismatch');
  }
  if (manifest.decider.content.split(ORIGINAL_RULE).length !== 2) fail('invalid_backup_rule');
  if (!manifest.sourceFileHashes || Object.keys(manifest.sourceFileHashes).sort().join(',')
      !== ['README.md', 'aleph.config.json', 'src/decider.mjs'].sort().join(',')) {
    fail('invalid_backup_sources');
  }
  return manifest;
}

export function backupPaths(root) {
  return { backup: join(resolve(root), BACKUP), checksum: join(resolve(root), CHECKSUM), drill: join(resolve(root), DRILL) };
}

export function describeBackup(root, { sourceCommit } = {}) {
  const commit = sourceCommit ?? execFileSync('git', ['-C', resolve(root), 'rev-parse', 'HEAD'], {
    encoding: 'utf8', windowsHide: true,
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(commit)) fail('invalid_source_commit');
  return baseline(resolve(root), commit);
}

export function createPolicyBackup(root, options = {}) {
  const paths = backupPaths(root);
  // 사본과 해시 중 하나라도 이미 있으면 재생성/덮어쓰기를 금지합니다.
  if (existsSync(paths.backup) || existsSync(paths.checksum)) fail('backup_already_exists');
  const manifest = describeBackup(root, options);
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  const digest = checksum(payload);
  mkdirSync(join(resolve(root), 'artifacts/stage10'), { recursive: true });
  writeFileSync(paths.backup, payload, { flag: 'wx', encoding: 'utf8' });
  writeFileSync(paths.checksum, `${digest}\n`, { flag: 'wx', encoding: 'utf8' });
  // 디스크에 쓴 사본을 다시 읽고 검사한 뒤에만 성공을 보고합니다.
  verifyPolicyBackup(root);
  return { commit: manifest.sourceCommit, digest, routes: manifest.allowedRoutes.values.length,
    dbStatus: manifest.dbPolicy.status };
}

export function verifyPolicyBackup(root) {
  const paths = backupPaths(root);
  if (!existsSync(paths.backup) || !existsSync(paths.checksum)) fail('backup_or_checksum_missing');
  const content = readFileSync(paths.backup);
  const stored = readFileSync(paths.checksum, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/u.test(stored) || sha256(content) !== stored) fail('backup_sha256_mismatch');
  let manifest;
  try { manifest = JSON.parse(content.toString('utf8')); } catch { fail('backup_json_invalid'); }
  return { manifest: verifyManifest(manifest), digest: stored };
}

// README는 10단계 설명이 추가될 수 있으므로, 백업 대상인 과거 DB 정책 원문만 비교합니다.
// RLS/GRANT 근거가 조금이라도 바뀌면 중단합니다. 정책 외 새 문단은 허용합니다.
export function verifyHistoricalDbEvidence(root, manifest) {
  let current;
  try { current = selectEvidence(read(root, 'README.md')); }
  catch { fail('historical_db_policy_changed'); }
  if (JSON.stringify(current) !== JSON.stringify(manifest.dbPolicy.evidence)) {
    fail('historical_db_policy_changed');
  }
}

// 기존 백업 이후 허용하는 설정 변경은 단계 번호 9→10/11과
// 심판이 요구한 restoreRoute null→POST /api/restore뿐입니다.
// 변경을 역으로 적용한 원문이 백업 당시 설정 SHA-256과 정확히 같아야 합니다.
// 허용 경로/발급자 등 다른 변경은 계속 중단하고 기존 백업은 덮어쓰지 않습니다.
export function verifyConfigSource(root, manifest) {
  const path = 'aleph.config.json';
  const originalSha = manifest.sourceFileHashes?.[path];
  let raw;
  try { raw = read(root, path); } catch { fail('current_source_missing'); }
  if (checksum(raw) === originalSha) return;
  let config;
  try { config = JSON.parse(raw); } catch { fail('current_source_changed_since_backup'); }
  if (![10, 11].includes(config.step) || checksum(JSON.stringify(config.allowedRoutes)) !== manifest.allowedRoutes.sha256) {
    fail('current_source_changed_since_backup');
  }
  const matches = [...raw.matchAll(/("step"\s*:\s*)(10|11)(?=\s*[,}])/gu)];
  if (matches.length !== 1) fail('current_source_changed_since_backup');
  const match = matches[0];
  const beforeStepBump = raw.slice(0, match.index) + match[1] + '9'
    + raw.slice(match.index + match[0].length);
  if (checksum(beforeStepBump) === originalSha) return;

  // 심판 요구에 따라 경로가 지정된 경우에만 해당 한 필드를 원래 null로 되돌려
  // 백업의 원본 해시와 비교합니다. 다른 값 또는 다른 파일 수정은 통과하지 않습니다.
  const routeMatches = [...beforeStepBump.matchAll(/("restoreRoute"\s*:\s*)"POST \/api\/restore"(?=\s*[,}])/gu)];
  if (routeMatches.length !== 1) fail('current_source_changed_since_backup');
  const routeMatch = routeMatches[0];
  const beforeRouteBump = beforeStepBump.slice(0, routeMatch.index)
    + routeMatch[1] + 'null'
    + beforeStepBump.slice(routeMatch.index + routeMatch[0].length);
  if (checksum(beforeRouteBump) !== originalSha) fail('current_source_changed_since_backup');
}

export function requireUntouchedSources(root, manifest) {
  for (const [path, digest] of Object.entries(manifest.sourceFileHashes)) {
    if (path === 'README.md') {
      verifyHistoricalDbEvidence(root, manifest);
      continue;
    }
    if (path === 'aleph.config.json') {
      verifyConfigSource(root, manifest);
      continue;
    }
    try {
      if (checksum(read(root, path)) !== digest) fail('current_source_changed_since_backup');
    } catch (error) {
      if (error.message === 'current_source_changed_since_backup') throw error;
      fail('current_source_missing');
    }
  }
}

export function simulatePolicyTampering(root) {
  const { manifest } = verifyPolicyBackup(root);
  requireUntouchedSources(resolve(root), manifest);
  const paths = backupPaths(root);
  if (existsSync(paths.drill)) fail('drill_copy_already_exists');
  const altered = manifest.decider.content.replace(ORIGINAL_RULE, TAMPERED_RULE);
  if (altered === manifest.decider.content) fail('mutation_not_applied');
  mkdirSync(join(resolve(root), 'artifacts/stage10/drill'), { recursive: true });
  writeFileSync(paths.drill, altered, { flag: 'wx', encoding: 'utf8' });
  return comparePolicyDrill(root);
}

export function comparePolicyDrill(root) {
  const { manifest } = verifyPolicyBackup(root);
  const paths = backupPaths(root);
  if (!existsSync(paths.drill)) fail('drill_copy_missing');
  const actual = readFileSync(paths.drill, 'utf8');
  const expected = manifest.decider.content.replace(ORIGINAL_RULE, TAMPERED_RULE);
  // 예상한 한 줄 이외의 변조가 있으면 내용을 출력하지 않고 중단합니다.
  if (actual !== expected) fail('unexpected_drill_change');
  return {
    commit: manifest.sourceCommit,
    target: 'artifacts/stage10/drill/decider.mjs',
    comparedWith: 'verified backup src/decider.mjs',
    removed: ORIGINAL_RULE,
    added: TAMPERED_RULE,
    changedLines: 1,
    dbStatus: manifest.dbPolicy.status,
  };
}
