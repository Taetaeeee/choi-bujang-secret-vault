import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { EVIDENCE_CASES, initialEvidence, runSafeProbe } from '../public/operations-evidence.js';
import { operationsHandler } from '../api/operations.js';

const UUID = '11111111-2222-4333-8444-555555555555';
const HEADER_ID = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const ISO = '2026-11-04T08:30:00.000Z';
const byId = id => EVIDENCE_CASES.find(x => x.id === id);

function fakeHttp(status, withServerHeaders = true) {
  const headers = new Map(withServerHeaders ? [
    ['X-Request-ID', HEADER_ID], ['X-Observed-At', ISO],
  ] : []);
  return { status, headers: { get: name => headers.get(name) ?? null },
    // If user code tries to read a memo body, fail immediately.
    json() { throw new Error('PROTECTED_BODY_MUST_NOT_BE_READ'); },
    text() { throw new Error('PROTECTED_BODY_MUST_NOT_BE_READ'); },
  };
}
const deps = { newId: () => UUID, now: () => ISO };

test('1~11 모든 단계는 검사 계획에 있으며 처음에는 결과·요청 ID·시각을 임의 생성하지 않는다', () => {
  const rows = initialEvidence();
  const stages = new Set(rows.map(x => x.stage));
  for (let step = 1; step <= 11; step++) assert.ok(stages.has(String(step)));
  assert.equal(rows.length, EVIDENCE_CASES.length);
  assert.equal(new Set(rows.map(x => x.id)).size, rows.length);
  assert.ok(rows.every(x => x.actual === '미실행' && x.status === '미실행'
    && x.requestId === null && x.checkedAt === null));
  assert.ok(!JSON.stringify(rows).includes('41종 통과'));
});

test('승인 계정 정상 요청 200: API 응답 메타데이터를 사용하며 메모 본문을 읽지 않는다', async () => {
  let options;
  const result = await runSafeProbe(byId('s02-allow'), { ...deps,
    fetcher: async (path, opts) => { assert.equal(path, '/api/notes'); options = opts; return fakeHttp(200); },
  });
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.method, 'GET');
  assert.equal(options.headers['X-BB-Check-ID'], UUID);
  assert.equal(result.actual, 'HTTP 200');
  assert.equal(result.status, '실측 일치');
  assert.equal(result.requestId, HEADER_ID);
  assert.equal(result.idSource, '서버 응답 ID');
  assert.equal(result.checkedAt, ISO);
  assert.equal(result.timeSource, '서버 응답 시각');
});

test('금지 요청 401: 쿠키를 제외하고 보내며 실측된 거부만 통과로 기록한다', async () => {
  const result = await runSafeProbe(byId('s02-deny'), { ...deps,
    fetcher: async (path, opts) => {
      assert.equal(path, '/api/notes');
      assert.equal(opts.credentials, 'omit');
      return fakeHttp(401);
    },
  });
  assert.equal(result.status, '실측 일치');
  assert.equal(result.actual, 'HTTP 401');
});

test('기대와 다른 HTTP 상태 또는 서버 응답 ID 누락은 통과 처리하지 않는다', async () => {
  const deniedNotDenied = await runSafeProbe(byId('s11-unauth'), { ...deps,
    fetcher: async () => fakeHttp(200),
  });
  assert.equal(deniedNotDenied.status, '확인 필요');
  assert.equal(deniedNotDenied.actual, 'HTTP 200');
  const missingId = await runSafeProbe(byId('s11-approved'), { ...deps,
    fetcher: async () => fakeHttp(200, false),
  });
  assert.equal(missingId.status, '확인 필요');
  assert.equal(missingId.idSource, '브라우저 전송 ID');
  assert.equal(missingId.requestId, UUID);
});

test('공개 정적 경로는 브라우저 전송 요청 ID·확인 시각을 별도 출처로 표기한다', async () => {
  const result = await runSafeProbe(byId('s01-static'), { ...deps,
    fetcher: async (path, opts) => {
      assert.equal(path, '/data.json');
      assert.equal(opts.credentials, 'omit');
      return fakeHttp(404, false);
    },
  });
  assert.equal(result.status, '실측 일치');
  assert.equal(result.idSource, '브라우저 전송 ID');
  assert.equal(result.timeSource, '브라우저 확인 시각');
});

test('실측 불가능한 단계는 자동 실행하지 않고 네트워크 실패도 확인 필요로 남긴다', async () => {
  await assert.rejects(() => runSafeProbe(byId('s07-risk'), deps), /NOT_AN_AUTOMATED_PROBE/u);
  const failed = await runSafeProbe(byId('s11-approved'), { ...deps,
    fetcher: async () => { throw new Error('private-token-would-leak'); },
  });
  assert.equal(failed.status, '확인 필요');
  assert.equal(failed.actual, '네트워크 요청 실패');
  assert.ok(!JSON.stringify(failed).includes('private-token'));
});

test('운영 요약 API는 서버 요청 ID·관측 시각을 헤더로 제공하고 본문 시각과 일치시킨다', async () => {
  const headers = new Map();
  const response = { statusCode: 200, body: null,
    setHeader(k, v) { headers.set(k, v); },
    status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; },
  };
  await operationsHandler({ method: 'GET', headers: {} }, response, {
    authorize: async () => ({ identity: { kind: 'student', userId: 'fake-test-id' }, status: 200 }),
    makeDb: () => ({}),
    deviceLookup: async () => ({ status: 'approved' }),
    makeSummary: ({ observedAt }) => ({ observedAt }),
  });
  assert.equal(response.statusCode, 200);
  assert.match(headers.get('X-Request-ID'), /^[\da-f-]{36}$/u);
  assert.equal(headers.get('X-Observed-At'), response.body.observedAt);
  assert.equal(headers.get('Cache-Control'), 'no-store');
});

test('화면과 응답 연동은 메모 본문 수집 없이 5개의 GET과 개인정보 제외 JSON으로 제한한다', async () => {
  const html = await readFile(new URL('../public/operations.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../public/operations-evidence.js', import.meta.url), 'utf8');
  assert.match(html, /id="evidence-body"/u);
  assert.match(html, /X-Request-ID/u);
  assert.match(html, /operations-evidence\.js/u);
  assert.match(js, /navigator\.clipboard\.writeText/u);
  assert.match(js, /credentials: probe\.credentials/u);
  assert.equal((js.match(/path: '\/api\/notes'/gu) ?? []).length, 2);
  assert.doesNotMatch(js, /localStorage|sessionStorage|response\.json\(|response\.text\(/u);
  assert.equal(EVIDENCE_CASES.filter(x => x.probe).length, 5);
  assert.ok(EVIDENCE_CASES.filter(x => x.probe).every(x => x.expected.startsWith('HTTP ')));
});
