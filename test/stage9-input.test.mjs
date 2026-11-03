import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect, readDetectionEvents } from '../src/detect.mjs';

const at = '2026-10-01T00:00:00.000Z';
const sub = 'learner_fixture';

function fixture(method = 'GET') {
  return {
    at,
    method,
    identity: {
      sub,
      get role() { throw new Error('forbidden_identity_field'); },
    },
    get network() { throw new Error('forbidden_network_field'); },
    get device() { throw new Error('forbidden_device_field'); },
    get region() { throw new Error('forbidden_region_field'); },
    get body() { throw new Error('forbidden_body_field'); },
    get token() { throw new Error('forbidden_token_field'); },
    get realName() { throw new Error('forbidden_name_field'); },
  };
}

test('계약의 at·method·identity.sub만 읽어 세 값으로 정리한다', () => {
  const [read, write] = readDetectionEvents([fixture(), fixture('POST')]);
  assert.deepEqual(read, { atMs: Date.parse(at), method: 'GET', sub });
  assert.deepEqual(write, { atMs: Date.parse(at), method: 'POST', sub });
  assert.deepEqual(Object.keys(read), ['atMs', 'method', 'sub']);
});

test('제작 2의 구간 규칙을 추가해도 제작 1의 세 필드 입력 처리는 유지한다', () => {
  for (const count of [30, 120]) {
    assert.deepEqual(detect(Array.from({ length: count }, () => fixture())), { action: 'observe' });
  }
  assert.deepEqual(detect(Array.from({ length: 121 }, () => fixture())), {
    action: 'propose_revocation', reasonCode: 'burst_read', subject: sub,
  });
});

test('잘못된 사건은 입력 내용을 출력하지 않는 고정 오류로 처리한다', () => {
  assert.throws(() => readDetectionEvents(null), { name: 'TypeError', message: 'invalid_detection_events' });
  for (const event of [null, {}, { at, method: 'GET', identity: {} },
    { at: 'not-a-date', method: 'GET', identity: { sub } }]) {
    assert.throws(() => readDetectionEvents([event]), { name: 'TypeError', message: 'invalid_detection_event' });
  }
});
