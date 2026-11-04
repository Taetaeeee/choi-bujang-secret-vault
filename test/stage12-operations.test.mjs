import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { operationsSummary, DOCUMENTED_STAGE10_BACKUP_COMMIT } from '../src/operations-summary.mjs';
import { RULE_IDS } from '../src/decider.mjs';
import { operationsHandler } from '../api/operations.js';

const TEST_IDENTITY = { kind: 'student', userId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' };
function mockResponse() {
  const headers = new Map();
  return {
    headers, statusCode: 200, body: null,
    setHeader(key, value) { headers.set(key, value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}
const accepted = () => ({ identity: TEST_IDENTITY, status: 200 });
const mockDb = () => ({ from: () => { throw new Error('must not read notes'); } });

async function run({ method = 'GET', authorize = accepted, approval = 'approved', makeSummary } = {}) {
  const response = mockResponse();
  const calls = [];
  await operationsHandler({ method, headers: {} }, response, {
    authorize,
    makeDb: () => { calls.push('db'); return mockDb(); },
    deviceLookup: async () => { calls.push('approval'); return { status: approval }; },
    ...(makeSummary ? { makeSummary } : {}),
  });
  return { response, calls };
}

test('요약 수치는 실제 등록된 RULE_IDS에서만 가져오고 미연결 실행 결과는 0건으로 조작하지 않는다', () => {
  const result = operationsSummary({ observedAt: '2026-11-04T00:00:00.000Z' });
  const record = result.record;
  assert.equal(result.schema, 'aleph.operations.summary.v1');
  assert.equal(record.decision.registeredRuleCount, RULE_IDS.length);
  assert.deepEqual(record.decision.registeredRuleIds, [...RULE_IDS]);
  assert.equal(record.decision.operationalDecision, 'not_observed');
  assert.equal(record.detection.operationalEventCount, null);
  assert.equal(record.detection.operationalEvents, 'not_observed');
  assert.equal(record.revocation.completedCount, null);
  assert.equal(record.revocation.operationalExecution, 'not_observed');
  assert.equal(record.recovery.liveVerifiedVersion, null);
  assert.equal(record.recovery.operationalRestore, 'not_observed');
  assert.equal(record.recovery.historicalBaselineCommit, DOCUMENTED_STAGE10_BACKUP_COMMIT);
  assert.equal(result.redaction, 'private_fields_omitted');
});

test('실제 API 결과는 승인된 사용자 요청에서만 기록하고 기밀 필드를 포함하지 않는다', async () => {
  const { response, calls } = await run();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, ['db', 'approval']);
  assert.equal(response.body.record.deviceApproval.value, 'approved');
  assert.equal(response.body.record.decision.registeredRuleCount, RULE_IDS.length);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const raw = JSON.stringify(response.body).toLowerCase();
  for (const field of ['owner_id', 'email', 'access_token', 'refresh_token', 'note.body', 'device_digest', '__host-byteback']) {
    assert.ok(!raw.includes(field), `public response leaks ${field}`);
  }
});

test('로그인 거부·미승인·승인 기록 오류에서는 요약과 규칙 수를 반환하지 않는다', async () => {
  for (const [options, status, error] of [
    [{ authorize: async () => ({ status: 401, error: 'UNAUTHORIZED' }) }, 401, 'UNAUTHORIZED'],
    [{ approval: 'pending' }, 403, 'DEVICE_NOT_APPROVED'],
    [{ approval: 'revoked' }, 403, 'DEVICE_NOT_APPROVED'],
    [{ approval: 'unavailable' }, 503, 'DEVICE_APPROVAL_UNAVAILABLE'],
  ]) {
    const { response } = await run(options);
    assert.equal(response.statusCode, status);
    assert.deepEqual(response.body, { error });
  }
});

test('조회 외 요청은 실행되지 않고 서버 오류는 실패-차단한다', async () => {
  const post = await run({ method: 'POST' });
  assert.equal(post.response.statusCode, 405);
  assert.deepEqual(post.calls, []);
  const failed = await run({ makeSummary: () => { throw new Error('db token forbidden'); } });
  assert.equal(failed.response.statusCode, 503);
  assert.deepEqual(failed.response.body, { error: 'OPERATIONS_UNAVAILABLE' });
});

test('작전실 화면은 동일한 요약 API의 서버 기록으로 표시하며 메모 API를 요청하지 않는다', async () => {
  const html = await readFile(new URL('../public/operations.html', import.meta.url), 'utf8');
  const root = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /fetch\('\/api\/operations'/u);
  assert.match(html, /record\.decision\.registeredRuleCount/u);
  assert.match(html, /JSON\.stringify\(/u);
  assert.match(html, /record\.detection\.operationalEventCount/u);
  assert.match(html, /record\.recovery\.liveVerifiedVersion/u);
  assert.doesNotMatch(html, /fetch\('\/api\/notes/u);
  assert.match(root, /href="\/operations\.html"/u);
});
