// 12단계 제작 2: 실제 HTTP 요청/응답의 최소 메타데이터만 화면에 남깁니다.
// 자료 본문·인증 쿠키·토큰·계정 식별자는 읽거나 저장·복사하지 않습니다.
// 41종 총공세 판정 또는 엔진의 allow/deny 집행을 대신하지 않습니다.

export const EVIDENCE_CASES = Object.freeze([
  { id: 's01-home', stage: '1', type: '정상', name: '자료실 공개 화면 제공', request: 'GET /', expected: 'HTTP 200', source: '정적 화면 수동 확인 필요' },
  { id: 's01-static', stage: '1', type: '금지', name: '공개 정적 메모 파일 접근', request: 'GET /data.json', expected: 'HTTP 404', probe: 'static' },
  { id: 's02-allow', stage: '2', type: '정상', name: '승인 계정의 자기 메모 목록', request: 'GET /api/notes (승인 쿠키)', expected: 'HTTP 200', probe: 'notes-allow' },
  { id: 's02-deny', stage: '2', type: '금지', name: '비로그인 자료 조회', request: 'GET /api/notes (쿠키 제외)', expected: 'HTTP 401', probe: 'notes-deny' },
  { id: 's03-auth', stage: '3', type: '정상', name: '로그인 검증과 세션 유지', request: 'POST /api/auth (status)', expected: '로그인 확인', source: '운영 수동 확인 필요' },
  { id: 's03-unauth', stage: '3', type: '금지', name: '로그아웃 세션의 보호 자료 차단', request: 'GET /api/notes (로그아웃)', expected: 'HTTP 401', source: '로그아웃 브라우저 별도 확인 필요' },
  { id: 's04-owner', stage: '4', type: '정상', name: '본인 소유 메모 단건 조회', request: 'GET /api/notes/:id (본인 ID)', expected: 'HTTP 200', source: '본인 시험 메모 ID 별도 필요' },
  { id: 's04-cross', stage: '4', type: '금지', name: '다른 계정의 메모 조회', request: 'GET /api/notes/:id (타인 ID)', expected: 'HTTP 404', source: 'A/B 두 시험 계정 별도 필요' },
  { id: 's05-proxy', stage: '5', type: '정상', name: '서버 경유 승인 사용자 자료 조회', request: 'GET /api/notes (승인 쿠키)', expected: 'HTTP 200', source: '2단계 측정과 같은 경로, 별도 단계 증거 확인 필요' },
  { id: 's05-direct', stage: '5', type: '금지', name: 'Supabase 원본 테이블 직접 접근', request: 'GET 원본 Data API (비인증)', expected: '직접 접근 거부', source: '현행 RLS/GRANT 별도 확인 필요' },
  { id: 's06-registered', stage: '6', type: '정상', name: '등록 기기 판정', request: '판정기 가상 요청', expected: 'allow', source: '운영 엔진 실행 미연결' },
  { id: 's06-unregistered', stage: '6', type: '금지', name: '미등록 기기 판정', request: '판정기 가상 요청', expected: 'deny', source: '운영 엔진 실행 미연결' },
  { id: 's07-normal', stage: '7', type: '정상', name: '일반 접속 요청', request: '판정기 가상 요청', expected: 'allow', source: '운영 엔진 실행 미연결' },
  { id: 's07-risk', stage: '7', type: '금지', name: '복합 이상 접속', request: '판정기 가상 요청', expected: 'step_up', source: '실제 재인증 집행 미확인' },
  { id: 's08-zone', stage: '8', type: '정상', name: '허용된 자료 구역 읽기', request: 'GET /notices (엔진 계약)', expected: 'allow', source: '운영 공지 API 구현·실행 미확인' },
  { id: 's08-forbidden', stage: '8', type: '금지', name: '다른 자료 구역 접근', request: '판정기 가상 요청', expected: 'deny', source: '운영 엔진 실행 미연결' },
  { id: 's09-normal', stage: '9', type: '정상', name: '10분 내 정상 조회', request: '탐지기 사건 입력', expected: 'observe', source: '운영 사건 피드 미연결' },
  { id: 's09-burst', stage: '9', type: '탐지', name: '10분 내 121회 이상 조회', request: '탐지기 사건 입력', expected: 'propose_revocation (제안만)', source: '실제 회수 집행 미확인' },
  { id: 's10-restore', stage: '10', type: '정상', name: '검증된 가상 정책·메모 복구', request: '로컬 복구 검사', expected: '해시 일치·가상 재시험 통과', source: '운영 복구 API 실측 아님' },
  { id: 's10-reject', stage: '10', type: '금지', name: '검증되지 않은 복구 사본 거부', request: '로컬 복구 검사', expected: '복구 중단', source: '운영 복구 API 실측 아님' },
  { id: 's11-approved', stage: '11', type: '정상', name: '승인 기기의 보호된 작전실 조회', request: 'GET /api/operations (승인 쿠키)', expected: 'HTTP 200', probe: 'operations-allow' },
  { id: 's11-unauth', stage: '11', type: '금지', name: '비로그인 작전실 접근', request: 'GET /api/operations (쿠키 제외)', expected: 'HTTP 401', probe: 'operations-deny' },
  { id: 's11-pending', stage: '11', type: '금지', name: '로그인했지만 미승인된 기기', request: 'GET /api/notes (승인 대기)', expected: 'HTTP 403', source: '별도 미승인 기기 필요' },
]);

const PROBES = Object.freeze({
  'static': { path: '/data.json', credentials: 'omit', status: 404, serverHeader: false },
  'notes-allow': { path: '/api/notes', credentials: 'same-origin', status: 200, serverHeader: true },
  'notes-deny': { path: '/api/notes', credentials: 'omit', status: 401, serverHeader: true },
  'operations-allow': { path: '/api/operations', credentials: 'same-origin', status: 200, serverHeader: true },
  'operations-deny': { path: '/api/operations', credentials: 'omit', status: 401, serverHeader: true },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u;

export function initialEvidence() {
  return EVIDENCE_CASES.map(({ id, stage, type, name, request, expected, source }) => ({
    id, stage, type, name, request, expected,
    actual: '미실행', requestId: null, checkedAt: null, idSource: null,
    timeSource: null, status: '미실행', source: source ?? '요청 전',
  }));
}

export async function runSafeProbe(caseDefinition, {
  fetcher = fetch,
  newId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
} = {}) {
  const probe = PROBES[caseDefinition.probe];
  if (!probe) throw new Error('NOT_AN_AUTOMATED_PROBE');
  // 정해진 5개의 안전한 GET 경로 외 요청, 메모 변경 요청은 지원하지 않습니다.
  const clientId = newId();
  if (!UUID.test(clientId)) throw new Error('INVALID_CLIENT_ID');
  const basis = { id: caseDefinition.id, stage: caseDefinition.stage,
    type: caseDefinition.type, name: caseDefinition.name, request: caseDefinition.request,
    expected: caseDefinition.expected };
  try {
    const response = await fetcher(probe.path, {
      method: 'GET', credentials: probe.credentials, cache: 'no-store', redirect: 'error',
      headers: { 'X-BB-Check-ID': clientId },
    });
    // 응답 본문(개인 메모 포함)을 전혀 읽거나 기록하지 않습니다.
    // Headers와 HTTP 상태만 사용합니다.
    const serverId = response.headers.get('X-Request-ID');
    const serverTime = response.headers.get('X-Observed-At');
    const validServerEvidence = UUID.test(serverId ?? '') && ISO.test(serverTime ?? '');
    const requestId = validServerEvidence ? serverId : clientId;
    const checkedAt = validServerEvidence ? serverTime : now();
    const meetsExpected = response.status === probe.status;
    const complete = meetsExpected && (!probe.serverHeader || validServerEvidence);
    // 실제 HTTP 결과와 출처가 확인되어야만 '실측 일치' 표시.
    const status = complete ? '실측 일치' : '확인 필요';
    return { ...basis, actual: `HTTP ${response.status}`, requestId, checkedAt,
      idSource: validServerEvidence ? '서버 응답 ID' : '브라우저 전송 ID',
      timeSource: validServerEvidence ? '서버 응답 시각' : '브라우저 확인 시각',
      status,
      source: complete ? (validServerEvidence ? '운영 API 응답 헤더' : '공개 경로 HTTP 응답')
        : (meetsExpected ? '서버 ID/시각 응답 헤더 확인 필요' : '기대 HTTP 상태와 불일치'),
    };
  } catch {
    return { ...basis, actual: '네트워크 요청 실패', requestId: clientId, checkedAt: now(),
      idSource: '브라우저 전송 ID', timeSource: '브라우저 확인 시각',
      status: '확인 필요', source: '응답 미수신: 서버에서 처리됐는지 확인 불가' };
  }
}

if (typeof document !== 'undefined') {
  const body = document.querySelector('#evidence-body');
  const runButton = document.querySelector('#evidence-run');
  const copyButton = document.querySelector('#evidence-copy');
  const status = document.querySelector('#evidence-status');
  let rows = initialEvidence();
  let running = false;

  function cell(row, value) {
    const td = document.createElement('td');
    td.textContent = value ?? '—';
    row.append(td);
  }
  function render() {
    body.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr');
      for (const value of [r.stage, r.type, r.name, r.request, r.expected, r.actual,
        r.status, r.requestId ? `${r.requestId} (${r.idSource})` : null,
        r.checkedAt ? `${r.checkedAt} (${r.timeSource})` : null]) cell(tr, value);
      return tr;
    }));
  }
  runButton.addEventListener('click', async () => {
    if (running) return;
    running = true;
    runButton.disabled = true;
    // 이전 실행 결과를 재사용하지 않습니다. 재측정 도중 미실행으로 초기화합니다.
    rows = initialEvidence();
    render();
    const plans = EVIDENCE_CASES.filter(c => c.probe);
    status.textContent = `읽기 전용 운영 HTTP 요청 ${plans.length}건 확인 중. 다른 단계는 미실행으로 유지합니다.`;
    try {
      for (const item of plans) {
        const result = await runSafeProbe(item);
        rows = rows.map(row => row.id === result.id ? result : row);
        render();
      }
      const measured = rows.filter(row => row.status === '실측 일치');
      const allow = measured.some(row => row.type === '정상');
      const deny = measured.some(row => row.type === '금지');
      status.textContent = `HTTP 점검 완료: 실측 일치 ${measured.length}/${plans.length}건 · 정상 ${allow ? '확인' : '미확인'} · 금지 ${deny ? '확인' : '미확인'}. 나머지 단계 및 41종 총공세는 미실행.`;
    } finally { running = false; runButton.disabled = false; }
  });
  copyButton.addEventListener('click', async () => {
    const evidence = {
      schema: 'aleph.stage12.http-evidence.v1',
      notice: 'HTTP 응답 상태/요청 ID/관측 시각만 수집. 공식 41종 총공세 판정 아님.',
      cases: rows,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(evidence, null, 2));
      status.textContent = '가린 확인표 JSON을 복사했습니다. 메모 본문·토큰·쿠키는 포함하지 않습니다.';
    } catch { status.textContent = '복사할 수 없습니다. 브라우저의 클립보드 권한을 확인해 주세요.'; }
  });
  render();
}
