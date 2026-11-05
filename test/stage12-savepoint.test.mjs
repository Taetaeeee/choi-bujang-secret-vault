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

test('12단계 제출은 20건 이내 실제·가상 점검을 구분하고 공식 41종을 통과로 작성하지 않는다', async () => {
  const oldFetch = globalThis.fetch;
  const beforeKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_only_mock';
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push([options.method ?? 'GET', url.pathname]);
    if (url.pathname === '/aleph.json') return Response.json({ step: 12, repoUrl: config.repoUrl });
    if (url.pathname === '/data.json') return new Response('', { status: 404 });
    if (url.pathname === '/') return new Response('fixture', {
      headers: { 'X-Content-Type-Options': 'nosniff' },
    });
    if (url.pathname === '/manifest.webmanifest') return Response.json({
      name: 'BYTE BACK 내 자료실', start_url: '/', scope: '/', display: 'standalone',
      icons: [{ sizes: '192x192', type: 'image/png' }, { sizes: '512x512', type: 'image/png' }],
    });
    if (url.pathname === '/operations.html') return new Response('fixture', { status: 200 });
    if (url.pathname === '/api/device') return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (url.pathname === '/api/operations') return Response.json({ error: 'UNAUTHORIZED' }, {
      status: 401, headers: { 'X-Request-ID': 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        'X-Observed-At': '2026-11-05T00:00:00.000Z' },
    });
    if (url.pathname === '/api/restore') return Response.json({ error: 'RESTORE_NOT_AVAILABLE' }, { status: 503 });
    if (url.pathname.startsWith('/api/notes') || url.pathname === '/rest/v1/vault_user_notes') {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    throw new Error('unexpected_mock_url');
  };
  try {
    const results = await runAttackChecks(config);
    assert.equal(results.length, 20);
    assert.equal(new Set(results.map(item => item.attackId)).size, 20);
    const operations = results.find(item => item.attackId === 'stage12_unauthenticated_operations');
    assert.ok(operations);
    assert.match(operations.observed, /작전실 API HTTP 401\/거부 true\/헤더 true/u);
    assert.match(operations.observed, /화면 HTTP 200; 41종 미실행/u);
    assert.ok(results.some(item => item.attackId === 'stage11_public_manifest'));
    assert.ok(results.some(item => item.attackId === 'stage10_policy_backup_local'));
    assert.ok(results.some(item => item.attackId === 'device_registration_local_fixture'));
    assert.ok(results.every(item => Object.keys(item).sort().join(',') === 'attackId,expected,observed'
      && item.expected.length <= 300 && item.observed.length <= 300));
    assert.ok(requests.some(([method, path]) => method === 'GET' && path === '/api/operations'));
    assert.ok(requests.some(([method, path]) => method === 'GET' && path === '/operations.html'));
    assert.ok(!results.some(item => /41종.*통과/u.test(item.observed)));
  } finally {
    globalThis.fetch = oldFetch;
    if (beforeKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = beforeKey;
  }
});
