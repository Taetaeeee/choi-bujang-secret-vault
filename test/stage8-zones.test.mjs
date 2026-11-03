import assert from 'node:assert/strict';
import { test } from 'node:test';
import config from '../aleph.config.json' with { type: 'json' };
import { decide, RULE_IDS } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const { normal, suspicious } = fixtureRequests();
const req = (patch = {}) => ({ ...normal, ...patch });

async function expected(input, decision, reasonCode) {
  const output = await decide(input);
  assert.equal(output.decision, decision);
  assert.equal(output.reasonCode, reasonCode);
  assert.deepEqual(Object.keys(output).sort(),
    ['schema', 'requestId', 'decision', 'reasonCode', 'ruleIds'].sort());
  assert.equal(output.requestId, input.requestId);
  assert.ok(output.ruleIds.length > 0 && output.ruleIds.every(id => RULE_IDS.includes(id)));
  return output;
}

test('메모 ID 1개를 지정한 GET만 허용하며 UUID일 필요는 없다', async () => {
  const allowed = await expected(req(), 'allow', 'approved');
  assert.ok(allowed.ruleIds.includes('personal_note_read'));
  await expected(req({ path: '/notes/non-uuid-123' }), 'allow', 'approved');
  await expected(req({ path: '/notes/demo.txt' }), 'allow', 'approved');
});

test('메모 목록·메모 쓰기·기능 경로·쿼리 우회는 거부', async () => {
  for (const request of [
    { route: 'GET /notes', path: '/notes' },
    { route: 'GET /notes/:id', path: '/notes' },
    { route: 'GET /notes/:id', path: '/notes/export' },
    { route: 'GET /notes/:id', path: '/notes/demo/export' },
    { route: 'GET /notes/:id', path: '/notes/demo?export=1' },
    { route: 'GET /notes/:id', path: '/notes/demo', queryLength: 8 },
    { method: 'POST', route: 'POST /notes', path: '/notes' },
    { method: 'PUT', route: 'PUT /notes/:id', path: '/notes/demo' },
    { method: 'DELETE', route: 'DELETE /notes/:id', path: '/notes/demo' },
    { service: 'notices', route: 'GET /notes/:id', path: '/notes/demo' },
  ]) await expected(req(request), 'deny', 'starter_not_ready');
});

test('반 공지 목록·개별 읽기만 허용', async () => {
  const list = await expected(req({ service: 'notices', route: 'GET /notices', path: '/notices' }),
    'allow', 'approved');
  assert.ok(list.ruleIds.includes('class_notice_read'));
  await expected(req({ service: 'notices', route: 'GET /notices/:id', path: '/notices/001' }),
    'allow', 'approved');
  await expected(req({ service: 'notices', route: 'GET /notices/:id', path: '/notices/demo-text' }),
    'allow', 'approved');
});

test('반 공지 쓰기는 누구에게나 거부, 강사 자료는 모든 메서드 거부', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    await expected(req({ service: 'notices', method, route: `${method} /notices/:id`,
      path: '/notices/demo', role: 'instructor',
      stepUp: { verified: true, authAgeSeconds: 10 } }),
    'deny', 'starter_not_ready');
  }
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    await expected(req({ service: 'instructor_materials', method,
      route: `${method} /instructor-materials/:id`, path: '/instructor-materials/demo' }),
    'deny', 'starter_not_ready');
  }
});

test('등록되지 않은 기기와 알 수 없는 경로도 거부', async () => {
  await expected(req({ service: 'notices', route: 'GET /notices', path: '/notices',
    deviceRegistered: false }), 'deny', 'device_not_registered');
  await expected(req({ route: 'GET /notes/:id', path: '/other/demo' }),
    'deny', 'starter_not_ready');
  await expected(req({ service: 'unknown', route: 'GET /notes/:id' }),
    'deny', 'starter_not_ready');
});

test('7단계 복합 이상 접속의 추가 확인 규칙은 유지', async () => {
  await expected(suspicious, 'step_up', 'step_up_required');
  await expected({ ...suspicious, stepUp: { verified: true, authAgeSeconds: 60 } },
    'allow', 'approved');
  await expected({ ...suspicious, stepUp: { verified: true, authAgeSeconds: 301 } },
    'step_up', 'step_up_required');
});

test('allowedRoutes에는 판정기 허용 경로만 메서드와 함께 존재', () => {
  assert.deepEqual(config.allowedRoutes, [
    'GET /api/notes/:id',
    'GET /api/notices',
    'GET /api/notices/:id',
  ]);
});
