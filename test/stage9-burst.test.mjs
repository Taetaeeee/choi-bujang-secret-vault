import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../src/detect.mjs';

const START = Date.parse('2026-10-01T00:00:00.000Z');
const burst = (subject) => ({ action: 'propose_revocation', reasonCode: 'burst_read', subject });
const observe = { action: 'observe' };

function reads(count, { sub = 'student-a', spacingMs = 2000, start = START, method = 'GET' } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    at: new Date(start + index * spacingMs).toISOString(),
    method,
    identity: { sub },
  }));
}

test('같은 사용자의 GET이 120건까지는 관찰하고 121건부터 burst_read를 제안한다', () => {
  assert.deepEqual(detect([]), observe);
  assert.deepEqual(detect(reads(30)), observe);
  assert.deepEqual(detect(reads(120)), observe);
  assert.deepEqual(detect(reads(121)), burst('student-a'));
  assert.deepEqual(detect(reads(200)), burst('student-a'));
});

test('정확히 10분 안의 양 끝은 포함하며 10분 초과 분산 조회는 합산하지 않는다', () => {
  assert.deepEqual(detect(reads(121, { spacingMs: 5000 })), burst('student-a'));
  assert.deepEqual(detect(reads(121, { spacingMs: 5001 })), observe);
  assert.deepEqual(detect(reads(200, { spacingMs: 7000 })), observe);
});

test('어느 연속 10분 구간이든 탐지하며 오래된 사건과 입력 역순에 영향받지 않는다', () => {
  const older = reads(70, { start: START - 2_000_000, spacingMs: 10_000 });
  const fresh = reads(121, { start: START + 800_000, spacingMs: 4000 });
  assert.deepEqual(detect([...fresh, ...older].reverse()), burst('student-a'));
});

test('서로 다른 사용자의 100건 또는 120건씩을 합치지 않는다', () => {
  const a = reads(120);
  const b = reads(120, { sub: 'student-b' });
  const mixed = a.flatMap((event, index) => [event, b[index]]);
  assert.deepEqual(detect(mixed), observe);
  assert.deepEqual(detect([...reads(100), ...reads(100, { sub: 'student-b' })]), observe);
});

test('POST와 DELETE 등 GET이 아닌 요청은 조회 횟수에 포함하지 않는다', () => {
  const writes = [...reads(200, { method: 'POST' }), ...reads(200, { method: 'DELETE' })];
  assert.deepEqual(detect([...reads(120), ...writes]), observe);
  assert.deepEqual(detect([...reads(120), ...writes, ...reads(121, { sub: 'student-b' })]),
    burst('student-b'));
});

test('여러 계정의 폭주에서는 가장 먼저 임계값을 넘긴 가명 사용자만 제안한다', () => {
  const late = reads(121, { sub: 'student-b', start: START + 400_000 });
  const early = reads(121, { sub: 'student-a', start: START });
  assert.deepEqual(detect([...late, ...early]), burst('student-a'));
});

test('탐지에는 기기·IP·지역·토큰 같은 부가 필드를 읽지 않는다', () => {
  const events = reads(121).map(event => ({
    ...event,
    get network() { throw new Error('unexpected_network_access'); },
    get token() { throw new Error('unexpected_token_access'); },
    get device() { throw new Error('unexpected_device_access'); },
    get region() { throw new Error('unexpected_region_access'); },
    identity: {
      sub: event.identity.sub,
      get role() { throw new Error('unexpected_role_access'); },
    },
  }));
  assert.deepEqual(detect(events), burst('student-a'));
});
