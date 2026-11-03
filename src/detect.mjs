// 9단계 제작 1·2: 엔진이 검증해 넘긴 가상 사건의 세 값만 읽고 조회 폭주를 탐지합니다.
// 브라우저가 입력한 신원·네트워크·기기·지역이나 메모 본문·토큰은 사용하지 않습니다.
// propose_revocation은 회수 제안이며 실제 세션 회수 처리가 아닙니다.
export function readDetectionEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');

  return events.map((event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new TypeError('invalid_detection_event');
    }

    // docs/DETECT_EVENTS.md에 정의된 필드만 읽습니다.
    const at = event.at;
    const method = event.method;
    const sub = event.identity?.sub;
    const atMs = typeof at === 'string' ? Date.parse(at) : NaN;

    // 오류에 입력값을 담지 않아 가명·본문·비밀값이 로그에 남지 않게 합니다.
    if (!Number.isFinite(atMs) || typeof method !== 'string' || method.length === 0
        || typeof sub !== 'string' || sub.trim().length === 0) {
      throw new TypeError('invalid_detection_event');
    }

    // 메모리의 최소 정보만 반환하고 원본 사건이나 부가 필드는 보관하지 않습니다.
    return { atMs, method, sub };
  });
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_NORMAL_GETS = 120;

export function detect(events) {
  // 같은 가명 사용자(GET)에 대해서만 시간을 모읍니다. 다른 메서드는 집계하지 않습니다.
  const readsBySubject = new Map();
  for (const { atMs, method, sub } of readDetectionEvents(events)) {
    if (method !== 'GET') continue;
    const reads = readsBySubject.get(sub);
    if (reads) reads.push(atMs);
    else readsBySubject.set(sub, [atMs]);
  }

  // 사건 입력 순서와 상관없이 어느 연속 10분 구간에 121건 이상 있는지 확인합니다.
  // 정확히 10분 떨어진 양 끝 사건은 같은 구간에 포함합니다.
  let firstBurst = null;
  for (const [sub, timestamps] of readsBySubject) {
    if (timestamps.length <= MAX_NORMAL_GETS) continue;
    timestamps.sort((a, b) => a - b);
    let left = 0;
    for (let right = 0; right < timestamps.length; right += 1) {
      while (timestamps[right] - timestamps[left] > WINDOW_MS) left += 1;
      if (right - left + 1 > MAX_NORMAL_GETS) {
        // 여러 사용자에게 폭주가 있어도 첫 발생 시각의 가명 사용자 하나만 제안합니다.
        const atMs = timestamps[right];
        if (!firstBurst || atMs < firstBurst.atMs
            || (atMs === firstBurst.atMs && sub < firstBurst.sub)) {
          firstBurst = { atMs, sub };
        }
        break;
      }
    }
  }

  if (firstBurst) {
    return { action: 'propose_revocation', reasonCode: 'burst_read', subject: firstBurst.sub };
  }
  // 정상 기기를 유지하기 위한 관찰 결과. 실제 권한·세션을 변경하지 않습니다.
  return { action: 'observe' };
}
