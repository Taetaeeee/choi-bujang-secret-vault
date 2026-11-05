import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import config from '../aleph.config.json' with { type: 'json' };
import { runAttackChecks } from '../src/attack-check.mjs';
import { createPolicyBackup, verifyPolicyBackup, requireUntouchedSources } from '../src/stage10-policy.mjs';

const readme = [
  '# mock',
  '## 4단계 저장점 (fixture)',
  '- RLS 활성화 상태 `true`. `authenticated` 역할의 4개 정책: USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).',
  '## 5단계 저장점 (fixture)',
  '- `public.vault_user_notes` 한 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 테이블 권한을 `REVOKE ALL`로 회수했습니다.',
  '- SQL Editor에서 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE가 `false`, 개별 GRANT는 `NULL`임을 확인했습니다.',
  '## 보너스 test',
].join('\n');

test('11단계 설정도 기존 10단계 정책 백업의 해시·경로 제한을 유지한다', () => {
  const root = mkdtempSync(join(tmpdir(), 'stage11-policy-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/decider.mjs'),
      'export async function decide(request) {\n  if (request.deviceRegistered !== true) {\n    return null;\n  }\n}\n');
    writeFileSync(join(root, 'README.md'), readme);
    const path = join(root, 'aleph.config.json');
    const baseline = { step: 9, allowedRoutes: ['GET /api/notes/:id'], restoreRoute: null };
    writeFileSync(path, JSON.stringify(baseline));
    createPolicyBackup(root, { sourceCommit: 'e6334b2060886d836e6b9da11609d1afa2fabbaf' });
    const { manifest } = verifyPolicyBackup(root);
    const current = { ...baseline, step: 11, restoreRoute: 'POST /api/restore' };
    writeFileSync(path, JSON.stringify(current));
    assert.doesNotThrow(() => requireUntouchedSources(root, manifest));
    writeFileSync(path, JSON.stringify({ ...current, allowedRoutes: ['GET /api/all'] }));
    assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/u);
    writeFileSync(path, JSON.stringify({ ...current, restoreRoute: 'POST /api/unverified' }));
    assert.throws(() => requireUntouchedSources(root, manifest), /current_source_changed_since_backup/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('11단계 직접 점검은 PWA와 비로그인 기기 API를 읽고 지난 18개 점검을 유지한다', async () => {
  assert.ok(config.step >= 11);
  const beforeKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_only_mock';
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push([options.method ?? 'GET', url.pathname]);
    if (url.pathname === '/aleph.json') return Response.json({ step: 11, repoUrl: config.repoUrl });
    if (url.pathname === '/data.json') return new Response('', { status: 404 });
    if (url.pathname === '/') return new Response('fixture', {
      headers: { 'X-Content-Type-Options': 'nosniff' },
    });
    if (url.pathname === '/manifest.webmanifest') return Response.json({
      name: 'BYTE BACK 내 자료실', start_url: '/', scope: '/', display: 'standalone',
      icons: [{ sizes: '192x192', type: 'image/png' }, { sizes: '512x512', type: 'image/png' }],
    });
    if (url.pathname === '/api/device') return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (url.pathname === '/api/restore') return Response.json({ error: 'RESTORE_NOT_AVAILABLE' }, { status: 503 });
    if (url.pathname.startsWith('/api/notes') || url.pathname === '/rest/v1/vault_user_notes') {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    throw new Error('unexpected_mock_url');
  };
  try {
    const attempts = await runAttackChecks({ ...config, step: 11 });
    assert.equal(attempts.length, 20); // bundle 상한 20건
    assert.equal(new Set(attempts.map(x => x.attackId)).size, 20);
    assert.ok(attempts.some(x => x.attackId === 'stage10_policy_backup_local'));
    assert.ok(attempts.some(x => x.attackId === 'stage10_virtual_note_local'));
    assert.match(attempts.find(x => x.attackId === 'stage11_public_manifest').observed,
      /Manifest 형식 일치 true/u);
    assert.match(attempts.find(x => x.attackId === 'stage11_unauthenticated_device').observed,
      /HTTP 401; 비로그인 거부 true/u);
    assert.ok(requests.some(([m, p]) => m === 'GET' && p === '/manifest.webmanifest'));
    assert.ok(requests.some(([m, p]) => m === 'GET' && p === '/api/device'));
    assert.ok(attempts.every(x => Object.keys(x).sort().join(',') === 'attackId,expected,observed'
      && x.expected.length <= 300 && x.observed.length <= 300));
  } finally {
    globalThis.fetch = oldFetch;
    if (beforeKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = beforeKey;
  }
});
