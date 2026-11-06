// XDR-03 제작 3 — CVE-2021-44228 / MITRE ATT&CK T1190 교육용 Wazuh 경보 판정.
// 아래 PATTERNS의 id/name/condition/evidence/reference는 patterns.json의 3개 항목을 그대로 옮겼습니다.
// 이 파일은 심판 격리 환경에서 단독 실행됩니다: 외부 모듈·파일·네트워크 접근/외부 상태 변경 없음.
const PATTERNS = Object.freeze([
  {
    "id": "jndi-header-lookup",
    "name": "요청 머리글에 포함된 원격 JNDI 조회 시도",
    "condition": "Wazuh data.useragent 등 요청 머리글에서 완전한 JNDI 원격 조회 구문을 확인하고, rule.description 또는 rule.mitre의 T1190 등과 교차 검토한다. 단순 jndi 단어·CVE 이름만으로는 일치시키지 않는다.",
    "evidence": "NVD CVE-2021-44228은 공격자가 제어한 로그 메시지와 매개변수의 JNDI/LDAP 조회가 취약한 Log4j2에서 원격 코드 실행으로 이어질 수 있다고 설명한다.",
    "reference": "https://nvd.nist.gov/vuln/detail/CVE-2021-44228"
  },
  {
    "id": "jndi-parameter-lookup",
    "name": "URL 인자에 포함된 원격 JNDI 조회 시도",
    "condition": "Wazuh data.url의 요청 인자에서 완전한 JNDI 원격 조회 구문을 확인하고, rule.description 또는 rule.mitre의 T1190 등과 교차 검토한다. 단순 취약점 이름 검색·문서 조회는 제외한다.",
    "evidence": "NVD CVE-2021-44228은 로그 메시지의 매개변수에 전달된 공격자 제어 JNDI 조회가 취약한 Log4j2의 원격 실행 위험과 연결된다고 명시한다.",
    "reference": "https://nvd.nist.gov/vuln/detail/CVE-2021-44228"
  },
  {
    "id": "vulnerability-scan-trace",
    "name": "알려진 취약점 점검 도구의 흔적",
    "condition": "Wazuh rule.description에 취약점 점검 흔적이나 점검 도구와 유사한 요청이 명시된 경우 조사 신호로 분류한다. 도구 이름·CVE 문자열·낮은 수준의 단발 경보만으로는 악용 확정 또는 자동 차단하지 않는다.",
    "evidence": "MITRE ATT&CK T1190은 공개 애플리케이션의 취약점 악용을 다루지만, 점검 도구 흔적 자체만으로는 실제 악용 요청이나 침해 성공을 확정할 수 없다.",
    "reference": "https://attack.mitre.org/techniques/T1190/"
  }
].map(pattern => Object.freeze(pattern)));

// 실제 원격 호출을 수행하지 않습니다. 경보에 포함된 완전한 원격 조회 문자열만 비교합니다.
// 단어 하나(jndi, CVE 번호)나 잘린 구문만으로는 이 패턴에 일치하지 않습니다.
const REMOTE_JNDI = /\$\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns):\/\/[^{}\s]{1,512}\}/iu;
const WEAK_CLUE = /CVE-2021-44228|\bjndi\b|취약점|점검|조회\s*구문|조회\s*형태|머리글|중괄호|라이브러리|로그에|잘린\s*글자|lookup-fragment/iu;
const SCAN_CLUE = /취약점.{0,12}점검|점검.{0,12}도구|도구.{0,12}점검/iu;

function limitedText(value, length = 2048) {
  return typeof value === 'string' && value.length <= length ? value : '';
}

function decodeOnce(value) {
  // URL 인코딩을 한 번만 풀어 비교합니다. 비정상 인코딩은 원문으로 비교합니다.
  try { return decodeURIComponent(value); } catch { return value; }
}

function response(confidence, pattern = null) {
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    // 근거 이름만 반환하며 IP·URL·요청 원문·계정·비밀값은 되돌려 주지 않습니다.
    reason: pattern?.name ?? '일치하는 근거 패턴 없음',
  };
}

// XDR 공식 실행기와 격리 심판이 호출하는 유일한 공개 함수입니다.
export function decide(alert) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) return response(0);
  const rule = alert.rule;
  const data = alert.data;
  if (!rule || typeof rule !== 'object' || !data || typeof data !== 'object') return response(0);

  const description = limitedText(rule.description, 2000);
  const level = rule.level;
  if (!description || !Number.isInteger(level) || level < 0 || level > 16) return response(0);

  const mappedT1190 = Array.isArray(rule.mitre)
    && rule.mitre.some(tag => typeof tag === 'string' && /^T1190(?:\.|$)/u.test(tag));
  const cveMention = /CVE-2021-44228/iu.test(description);
  const context = mappedT1190 || cveMention;

  const agentText = limitedText(data.useragent);
  const urlText = limitedText(data.url);
  // 헤더의 사용자 에이전트, URL의 요청 인자를 분리해 확인합니다.
  const headerLookup = REMOTE_JNDI.test(agentText);
  const query = urlText.indexOf('?') >= 0 ? decodeOnce(urlText.slice(urlText.indexOf('?') + 1)) : '';
  const parameterLookup = REMOTE_JNDI.test(query);

  if (headerLookup || parameterLookup) {
    const pattern = headerLookup ? PATTERNS[0] : PATTERNS[1];
    // 완전한 조회 구문 + Wazuh의 공격 맥락 + 높은 경보 수준이 동시에 확인되어야 차단.
    if (context && level >= 10) return response(headerLookup && parameterLookup ? 0.98 : 0.94, pattern);
    // 실제 조회 구문이 있어도 다른 맥락/낮은 경보 수준이면 추가 조사로 제한.
    return response(0.72, pattern);
  }

  const weakClue = WEAK_CLUE.test(`${description} ${urlText} ${agentText}`);
  const scanClue = SCAN_CLUE.test(description);
  // Wazuh의 T1190 매핑과 낮은 수준의 단서가 있어도 악용이 확정된 것은 아닙니다.
  // 세 번째 패턴은 조사 범주명이며, 이 점수만으로 점검 도구나 침해 성공을 단정하지 않습니다.
  if (mappedT1190 && level >= 5 && (scanClue || weakClue)) {
    return response(scanClue ? 0.63 : 0.55, PATTERNS[2]);
  }

  return response(0.1);
}
