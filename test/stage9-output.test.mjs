import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../src/detect.mjs';

const START = Date.parse('2026-10-01T00:00:00.000Z');

function events(count, { sub = 'student_fixture', method = 'GET', stepMs = 1000 } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    at: new Date(START + i * stepMs).toISOString(),
    method,
    identity: { sub },
  }));
}

test('정상 사건 응답은 action: observe 한 키만 반환한다', () => {
  for (const input of [[], events(30), events(120), events(200, { stepMs: 7000 })]) {
    const result = detect(input);
    assert.deepEqual(result, { action: 'observe' });
    assert.deepEqual(Reflect.ownKeys(result), ['action']);
  }
});

test('121건 이상 폭주 사건 응답은 action·reasonCode·subject 세 키만 반환한다', () => {
  const result = detect(events(121, { sub: 'suspect_fixture' }));
  assert.deepEqual(result, {
    action: 'propose_revocation',
    reasonCode: 'burst_read',
    subject: 'suspect_fixture',
  });
  assert.deepEqual(Reflect.ownKeys(result), ['action', 'reasonCode', 'subject']);
});

test('혼합 사건은 사용자별로 구분하며 회수 제안 외 정보·기기 권한을 반환하지 않는다', () => {
  const normalA = events(120, { sub: 'normal_a' });
  const normalB = events(120, { sub: 'normal_b' });
  const normal = detect([...normalA, ...normalB, ...events(100, { method: 'POST' })]);
  assert.deepEqual(normal, { action: 'observe' });
  assert.deepEqual(Reflect.ownKeys(normal), ['action']);

  const detected = detect([...normalA, ...events(121, { sub: 'suspect_fixture' })]);
  assert.deepEqual(detected, {
    action: 'propose_revocation', reasonCode: 'burst_read', subject: 'suspect_fixture',
  });
  assert.deepEqual(Reflect.ownKeys(detected), ['action', 'reasonCode', 'subject']);
});
