import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import config from '../aleph.config.json' with { type: 'json' };
import { runAttackChecks } from '../src/attack-check.mjs';
import { createPolicyBackup, verifyPolicyBackup, requireUntouchedSources } from '../src/stage10-policy.mjs';

const documentedDb = [
  '# mock',
  '## 4단계 저장점 (fixture)',
  '- RLS 활성화 상태 `true`. `authenticated` 역할의 4개 정책: USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).',
  '## 5단계 저장점 (fixture)',
  '- `public.vault_user_notes` 한 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 테이블 권한을 `REVOKE ALL`로 회수했습니다.',
  '- SQL Editor에서 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE가 `false`, 개별 GRANT는 `NULL`임을 확인했습니다.',
].join('\n');

test('12단계 저장점은 step 12 설정과 10단계 비공개 백업 정책의 엄격한 검증을 유지한다', () => {
  assert.equal(config.step, 12);
  const root = mkdtempSync(join(tmpdir(), 'stage12-savepoint-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/decider.mjs'),
      'export async function decide(request) {\n  if (request.deviceRegistered !== true) {\n    return null;\n  }\n}\n');
    writeFileSync(join(root, 'README.md'), documentedDb);
    const path = join(root, 'aleph.config.json');
    const baseline = { step: 9, allowedRoutes: ['GET /api/notes/:id'], restoreRoute: null };
    writeFileSync(path, JSON.stringify(baseline));
    createPolicyBackup(root, { sourceCommit: 'e6334b2060886d836e6b9da11609d1afa2fabbaf' });
    const { manifest } = verifyPolicyBackup(root);
    const current = { ...baseline, step: 12, restoreRoute: 'POST /api/restore' };
    writeFileSync(path, JSON.stringify(current));
    assert.doesNotThrow(() => requireUntouchedSources(root, manifest));
    writeFileSync(path, JSON.stringify({ ...current, allowedRoutes: ['GET /api/all'] }));
    assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/u);
    writeFileSync(path, JSON.stringify({ ...current, restoreRoute: 'POST /api/unverified' }));
    assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('12단계 제출은 20개 전부 not_run이고 네트워크 요청을 전혀 하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error('unexpected_s12_network_request');
  };
  try {
    const results = await runAttackChecks(config);
    assert.equal(results.length, 20);
    assert.deepEqual(results.map(item => item.attackId), [
      "anonymous_static_data_read",
      "anonymous_list_read",
      "anonymous_note_create",
      "anonymous_note_update_delete",
      "anon_data_api_read",
      "anon_data_api_delete",
      "cross_owner_access",
      "screen_has_no_public_key",
      "device_rule_local",
      "step_up_cases_local",
      "relogin_block_not_run",
      "anonymous_other_zone_api",
      "zone_rules_local",
      "other_zone_authenticated_api",
      "burst_read_local",
      "revocation_not_run",
      "policy_and_memo_restore",
      "anonymous_device_api",
      "anonymous_ops_api",
      "ops_live_and_judge_suite_not_run",
    ]);
    assert.ok(results.every(item => item.observed === 'not_run'));
    assert.ok(results.every(item => Object.keys(item).sort().join(',') === 'attackId,expected,observed'));
    assert.ok(results.every(item => typeof item.expected === 'string' && item.expected.length > 0 && item.expected.length <= 300));
    assert.equal(new Set(results.map(item => item.attackId)).size, 20);
    assert.equal(requests, 0, '12단계 번들 실행은 GET을 포함한 네트워크 요청을 보내면 안 됨');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
