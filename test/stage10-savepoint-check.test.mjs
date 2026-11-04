import assert from 'node:assert/strict';
import { test } from 'node:test';
import config from '../aleph.config.json' with { type: 'json' };
import { runAttackChecks } from '../src/attack-check.mjs';

test('10단계 제출 점검은 기존 기록을 보존하고 로컬/실제 HTTP 결과를 구분한다', async () => {
  const before = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_only_mock';
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push([options.method ?? 'GET', url.pathname]);
    if (url.pathname === '/aleph.json') return Response.json({ step: 10, repoUrl: config.repoUrl });
    if (url.pathname === '/data.json') return new Response('', { status: 404 });
    if (url.pathname === '/') {
      return new Response('fixture', { headers: { 'X-Content-Type-Options': 'nosniff' } });
    }
    if (url.pathname === '/api/restore') return Response.json({ error: 'RESTORE_NOT_AVAILABLE' }, { status: 503 });
    if (url.pathname.startsWith('/api/notes') || url.pathname === '/rest/v1/vault_user_notes') {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    throw new Error('unexpected_mock_url');
  };
  try {
    const output = await runAttackChecks(config);
    assert.equal(output.length, 18);
    assert.equal(new Set(output.map(entry => entry.attackId)).size, 18);
    for (const item of output) {
      assert.deepEqual(Object.keys(item).sort(), ['attackId', 'expected', 'observed']);
      assert.ok(item.expected.length >= 1 && item.expected.length <= 300);
      assert.ok(item.observed.length >= 1 && item.observed.length <= 300);
    }
    for (const name of ['burst_read_threshold_local_fixture', 'burst_read_normal_local_fixture',
      'stage10_policy_backup_local', 'stage10_restored_policy_local',
      'stage10_virtual_note_local', 'stage10_anonymous_restore_post']) {
      assert.ok(output.some(item => item.attackId === name));
    }
    assert.ok(requests.some(([method, path]) => method === 'POST' && path === '/api/restore'));
    assert.match(output.find(item => item.attackId === 'stage10_anonymous_restore_post').observed,
      /HTTP 503/);
    assert.match(output.find(item => item.attackId === 'stage10_virtual_note_local').observed,
      /운영 DB 복원 미실행/);
  } finally {
    globalThis.fetch = originalFetch;
    if (before === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = before;
  }
});
