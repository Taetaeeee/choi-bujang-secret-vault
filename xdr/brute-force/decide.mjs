// BYTE BACK XDR brute-force: 단독 실행 가능한 순수 판단 모듈.
// patterns.json의 두 MITRE T1110 패턴을 상수로 옮긴 것입니다.
// 경보 원문, IP, 계정, 비밀번호, 토큰은 출력하거나 저장하지 않습니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 'password-guessing',
    name: '동일 출발 주소와 계정의 반복 로그인 실패',
    condition: '짧은 시간 동안 동일한 data.srcip와 data.srcuser 조합에서 로그인 실패가 연속 발생했다는 Wazuh 경보를 찾는다.',
    evidence: 'MITRE ATT&CK T1110.001: 하나의 계정에 비밀번호를 반복 추측하면 다수의 인증 실패가 발생할 수 있다.',
  }),
  Object.freeze({
    id: 'password-spraying',
    name: '동일 출발 주소의 여러 계정에 동일 비밀번호 시도',
    condition: '동일 data.srcip에서 여러 계정(data.accounts 등)에 같은 비밀번호를 시도했다는 내용이 Wazuh 경보 설명에 명시된 경우를 찾는다.',
    evidence: 'MITRE ATT&CK T1110.003: 하나 또는 소수의 비밀번호를 여러 계정에 반복 시도하는 행위는 Password Spraying에 해당한다.',
  }),
]);

function failureCount(value) {
  // 집계값이 실제로 존재하고 10진수 정수일 때만 사용합니다.
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]{0,6})$/u.test(value)) {
    return Number(value);
  }
  return null;
}

function result(confidence, pattern = null) {
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    reason: pattern?.name ?? '해당 패턴 없음',
  };
}

// 판정 입력은 단일 Wazuh 경보 객체입니다. 파일/네트워크/패키지 접근이 없습니다.
export function decide(alert) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) return result(0);

  const description = alert.rule?.description;
  const level = alert.rule?.level;
  const sourceIp = alert.data?.srcip;
  const account = alert.data?.srcuser;
  const timestamp = alert.timestamp;
  if (typeof description !== 'string' || description.length > 2000
      || !Number.isInteger(level) || level < 0 || level > 16
      || typeof sourceIp !== 'string' || !sourceIp.trim()
      || typeof account !== 'string' || !account.trim()
      || typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) {
    return result(0);
  }

  const tags = alert.rule?.mitre;
  const mappedToT1110 = Array.isArray(tags)
    && tags.some(tag => typeof tag === 'string' && /^T1110(?:\.|$)/u.test(tag));
  const hasFailures = /로그인 실패|비밀번호.*실패|실패.*로그인|실패\s*\d+\s*건|실패가\s*\d+\s*건/u.test(description);
  const explicitSuccess = /성공/u.test(description) && !/성공은 없습니다|성공이 없습니다|성공.*없었/u.test(description);

  // 같은 비밀번호를 여러 계정에 넣었다는 명시적 경보가 있어야 스프레이로 분류합니다.
  const multipleAccounts = /여러\s*계정|서로\s*다른\s*계정|계정\s*\d+\s*개/u.test(description)
    || (typeof alert.data?.accounts === 'string' && alert.data.accounts.split(',').filter(Boolean).length >= 3);
  const spray = multipleAccounts && /같은\s*비밀번호/u.test(description);
  if (!mappedToT1110) return result(0.1);
  if (spray && level >= 10 && !explicitSuccess) return result(0.97, PATTERNS[1]);
  // 로그인 실패가 명시되지 않으면 스프레이 외에는 공격으로 단정하지 않습니다.
  if (!hasFailures) return result(0.1);

  // Wazuh가 집계한 실패 건수와 높은 규칙 수준, T1110이 함께 있는 경우에만 차단합니다.
  const count = failureCount(alert.data?.count);
  if (count !== null && count >= 15 && level >= 10 && !explicitSuccess) {
    return result(0.91, PATTERNS[0]);
  }

  // 작은 집계나 성공이 섞인 실패는 확인 필요로 남기고 IP를 차단하지 않습니다.
  if (count !== null && count >= 3 && level >= 5) {
    return result(explicitSuccess ? 0.55 : count >= 5 ? 0.68 : 0.54, PATTERNS[0]);
  }
  return result(0.2);
}
