// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 8단계 제작 2: 엔진 검증 요청의 서비스·동작·정확한 경로로 자료 구역을 나눕니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'starter.deny', 'device_registered', 'step_up_required',
  'personal_note_read', 'class_notice_read',
]);

// 엔진이 전달한 접속 사건의 출처와 형식만 검사합니다.
// `none`은 관측 자료가 없다는 뜻이며 정상 접속의 증거가 아닙니다.
// `judge_fixture`는 심판의 가상 사건이며 실제 위치·네트워크 증거가 아닙니다.
// 요청 계약에 없는 클라이언트 헤더는 확인하거나 채워 넣지 않습니다.
function inspectAccessContext(request) {
  const signals = request.signals;
  const events = request.recentEvents;
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)
      || !Array.isArray(events) || events.length > 12) {
    return 'invalid';
  }

  // 사건 0건([])과 사건 정보 누락(undefined)은 다릅니다.
  if (!events.every(event => event && typeof event === 'object' && !Array.isArray(event)
      && typeof event.kind === 'string' && event.kind.length > 0
      && Number.isFinite(event.ageSeconds) && event.ageSeconds >= 0
      && Number.isInteger(event.count) && event.count >= 0)) {
    return 'invalid';
  }

  const validHour = Number.isInteger(signals.hour)
    && signals.hour >= 0 && signals.hour <= 23;

  if (signals.source === 'none') {
    // 실제 경로에서 제공하지 않는 지역·네트워크·시각을 추정하지 않습니다.
    if (signals.region !== 'unknown' || signals.network !== 'unknown'
        || (signals.hour !== null && !validHour)) return 'invalid';
    return 'unavailable';
  }

  if (signals.source === 'judge_fixture') {
    // 실습용 사건도 값이 누락됐다면 정상값으로 보완하지 않습니다.
    if (typeof signals.region !== 'string' || signals.region.trim() === ''
        || typeof signals.network !== 'string' || signals.network.trim() === ''
        || !validHour) return 'invalid';
    return 'fixture_only';
  }

  return 'invalid';
}

// 운영 엔진이 검증한 service/method/path/route만 사용합니다.
// 판정기 계약에는 강사 role이나 Supabase 메모 소유자 ID가 없습니다.
// 예시 fixture의 ID는 UUID가 아닐 수 있으므로 UUID 형식은 강제하지 않습니다.
function isSingleItemPath(path, root) {
  if (typeof path !== 'string' || !path.startsWith(`${root}/`)) return false;
  const itemId = path.slice(root.length + 1);
  return itemId.length > 0 && !/[/?#\\%]/u.test(itemId)
    && itemId !== '.' && itemId !== '..'
    // /notes/export 같은 기능 경로를 :id와 같은 깊이로 취급하지 않습니다.
    && !['export', 'download', 'bulk', 'search'].includes(itemId.toLowerCase());
}

// 반 공지의 서비스명·경로는 이번 단계에서 채택한 정책용 이름입니다.
// 현재 저장소에 해당 공지 API/강사 관리 경로가 구현됐다는 뜻은 아닙니다.
function allowedReadZone(request) {
  // 허용 경로에 쿼리로 추가 기능을 붙이지 않습니다.
  if (request.method !== 'GET' || request.queryLength !== 0) return null;

  if (request.service === 'notes'
      && request.route === 'GET /notes/:id'
      && isSingleItemPath(request.path, '/notes')) return 'personal_note_read';

  if (request.service === 'notices'
      && ((request.route === 'GET /notices' && request.path === '/notices')
        || (request.route === 'GET /notices/:id'
          && isSingleItemPath(request.path, '/notices')))) return 'class_notice_read';

  // 강사 자료, 공지 쓰기, 메모 목록, 불명확한 서비스·경로는 모두 미허용입니다.
  return null;
}

export async function decide(request) {
  if (request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 출처 불명·누락 사건은 정상 접속으로 간주하지 않고 기존 거부 규칙을 사용합니다.
  // 출처가 `none`인 유효한 요청은 6단계 기기 판정만 유지합니다.
  const accessContext = inspectAccessContext(request);
  if (accessContext === 'invalid') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'starter_not_ready',
      ruleIds: [RULE_IDS[0]],
    };
  }

  // 서비스/경로/동작이 모두 맞는 구역의 GET만 허용 후보입니다.
  const readZone = allowedReadZone(request);
  if (readZone === 'personal_note_read') {
    // 실습용 엔진 사건에서만 복합 위험을 판단합니다. 지역 하나는 판단 조건이 아닙니다.
    // 0~5시 + 낯선 네트워크 + 최근 5분 내 위험 사건 10회 이상인 경우입니다.
    // `risk_signal.count`는 가상 사건 횟수이며 실제 메모 열람 횟수는 아닙니다.
    const combinedRisk = accessContext === 'fixture_only'
      && request.signals.hour >= 0 && request.signals.hour < 6
      && request.signals.network === 'unusual'
      && request.recentEvents.some(event => event.kind === 'risk_signal'
        && event.ageSeconds <= 300 && event.count >= 10);

    if (combinedRisk) {
      // 실제 추가 인증의 완료 여부와 인증 시각은 제공 엔진에서 검증합니다.
      // 로컬에서는 엔진이 검증해 넘긴 결과 필드만 판단합니다.
      const reauthenticated = request.stepUp?.verified === true
        && Number.isFinite(request.stepUp.authAgeSeconds)
        && request.stepUp.authAgeSeconds >= 0
        && request.stepUp.authAgeSeconds <= 300;
      if (!reauthenticated) {
        return {
          schema: 'aleph.decision.v1',
          requestId: request.requestId,
          decision: 'step_up',
          reasonCode: 'step_up_required',
          ruleIds: ['step_up_required'],
        };
      }
    }

    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'allow',
      reasonCode: 'approved',
      ruleIds: ['device_registered', 'personal_note_read'],
    };
  }

  if (readZone === 'class_notice_read') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'allow',
      reasonCode: 'approved',
      ruleIds: ['device_registered', 'class_notice_read'],
    };
  }

  // 공지의 POST/PUT/PATCH/DELETE, 강사 자료, 메모 목록/전체 조회는 거부합니다.
  // 강사 공지 수정은 이후 서버 관리 경로에서 신원을 검증해야 합니다.
  // 메모 owner_id 비교 역시 제작 3의 실제 자료 API에서 확인합니다.
  // 이 제작에서 허용하지 않은 요청은 기존 시작 규칙으로 거부합니다.
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'deny',
    reasonCode: 'starter_not_ready',
    ruleIds: [RULE_IDS[0]],
  };
}
