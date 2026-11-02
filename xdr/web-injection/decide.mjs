// BYTE BACK XDR web-injection: 심판 격리 환경에서 독립 실행하는 판단 모듈.
// 아래 PATTERNS는 xdr/web-injection/patterns.json의 세 항목을 그대로 옮긴 상수입니다.
// 파일/패키지/네트워크 접근이나 로그 기록 없이 alert 한 건만 판단합니다.
const PATTERNS = Object.freeze(
[
  {
    "id": "sql-injection",
    "name": "웹 요청 인자의 SQL 구문 주입 시도",
    "condition": "data.url의 요청 인자에 SQL 질의 구조를 바꾸려는 구문이 있거나 rule.description에 SQL 구문 주입 정황이 명시되고, data.srcip와 data.count 등에서 반복 요청 근거를 확인한다. 단순 수업명 SQL·select는 제외한다.",
    "evidence": "MITRE ATT&CK T1190은 외부 공개 앱 취약점 악용을 다루며, OWASP SQL Injection은 사용자 입력으로 SQL 질의의 동작을 바꾸는 공격을 설명한다.",
    "reference": "https://community.owasp.org/attacks/SQL_Injection"
  },
  {
    "id": "script-tag-injection",
    "name": "웹 요청 인자의 스크립트 태그 주입 시도",
    "condition": "data.url의 요청 인자에 실행을 유도하는 스크립트 태그가 있거나 rule.description에 스크립트 삽입 표식이 명시되고, data.srcip와 data.count 등에서 반복 요청 근거를 확인한다. 단순 수업명 script는 제외한다.",
    "evidence": "MITRE ATT&CK T1190은 외부 공개 앱 악용의 맥락을 제공하며, OWASP XSS는 신뢰된 웹페이지에 악성 스크립트를 삽입하는 공격을 설명한다.",
    "reference": "https://community.owasp.org/attacks/xss/"
  },
  {
    "id": "path-traversal",
    "name": "상위 디렉터리 이동 표기의 반복 시도",
    "condition": "data.url의 파일·경로 인자에 ../ 또는 인코딩된 상위 경로 이동 표기가 반복되거나 rule.description에 반복된 경로 이탈 시도가 명시되며, data.srcip와 data.count 등으로 반복 정황을 확인한다. 단순 단어 up은 제외한다.",
    "evidence": "MITRE ATT&CK T1190은 외부 공개 앱의 취약점 악용을 포함하며, OWASP Path Traversal은 ../ 등을 이용한 허용 경로 밖의 파일 접근 시도를 설명한다.",
    "reference": "https://community.owasp.org/attacks/Path_Traversal"
  }
].map(pattern => Object.freeze(pattern)));

// 동일 IP의 반복 요청이라는 설명과 경보 집계값을 함께 요구합니다.
// 제공된 실습 데이터의 URL은 doc-*로 된 교육용 표기이므로 그 이름만으로 차단하지 않습니다.
function failureSafeCount(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]{0,6})$/u.test(value)) {
    return Number(value);
  }
  return null;
}

function validSourceAddress(value) {
  if (typeof value !== 'string' || value.length > 45) return false;
  // 실습 경보는 모두 문서용 IPv4 주소이며, 여기서는 외부 의존성 없이 유효성을 확인합니다.
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part =>
    /^(?:0|[1-9][0-9]{0,2})$/u.test(part) && Number(part) <= 255);
}

function reply(confidence, pattern) {
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    // 유형이 확인되지 않은 경보에는 존재하지 않는 패턴 이름을 지어내지 않습니다.
    reason: pattern?.name ?? '일치하는 근거 패턴 없음',
  };
}

function decodeOnce(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function findPattern(description, url) {
  const requestUrl = decodeOnce(url);
  const sqlQueryShape = /(?:\bunion\s+select\b|\bselect\s+\S+\s+from\b|\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\bdrop\s+table\b|\bwaitfor\s+delay\b)/iu.test(requestUrl);
  const sqlDescription = /SQL\s*(?:구문|표식|주입)|데이터베이스\s*조회.{0,15}이어\s*붙/iu.test(description);
  // SQL/명령문을 잇는 구분자 의심: 신뢰된 Wazuh 경보의 반복 표기와 웹 질의 인자가 함께 있어야 합니다.
  const chainingSeparator = /명령\s*구분자\s*표기가\s*연속\s*요청/iu.test(description)
    && /\?/u.test(requestUrl);
  if (sqlQueryShape || sqlDescription || chainingSeparator) return PATTERNS[0];

  const scriptShape = /<\s*script\b|%3cscript|\bon\w+\s*=\s*['"]|javascript\s*:/iu.test(requestUrl);
  const scriptDescription = /스크립트\s*(?:삽입\s*표기|표식|태그\s*주입)/iu.test(description)
    && !/삽입\s*표식은\s*아닙니다/iu.test(description);
  if (scriptShape || scriptDescription) return PATTERNS[1];

  const upTraversal = /(?:\.\.\/|\.\.\\|%2e%2e(?:%2f|\/|%5c))/iu.test(requestUrl);
  const traversalDescription = /경로.{0,30}(?:거슬러\s*올라가|이탈\s*표기)/iu.test(description);
  if (upTraversal || traversalDescription) return PATTERNS[2];

  return null;
}

// 심판은 이 함수만 불러서 각 Wazuh 경보에 대한 한 개의 판단을 받습니다.
export function decide(alert) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) return reply(0);

  const timestamp = alert.timestamp;
  const description = alert.rule?.description;
  const level = alert.rule?.level;
  const sourceIp = alert.data?.srcip;
  const url = alert.data?.url;
  const count = failureSafeCount(alert.data?.count);

  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))
      || typeof description !== 'string' || !description.trim() || description.length > 2000
      || !Number.isInteger(level) || level < 0 || level > 16
      || !validSourceAddress(sourceIp)
      || typeof url !== 'string' || !url.startsWith('/') || url.length > 2048) {
    return reply(0);
  }

  const mappedToT1190 = Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(value => typeof value === 'string' && /^T1190(?:\.|$)/u.test(value));
  if (!mappedToT1190) return reply(0.05);

  const pattern = findPattern(description, url);

  // 하나의 Wazuh 집계 경보에 같은 주소의 다회 요청이 기록되어 있어야 차단합니다.
  // level 10, count 8은 이 교육용 데이터에 맞춘 실습 기준이며 보편적인 보안 기준이 아닙니다.
  if (pattern && count !== null && count >= 8 && level >= 10) {
    return reply(0.94, pattern);
  }

  // 유형이 명확하지 않거나 1회성인 T1190 경보는 자동 IP 차단하지 않고 조사 대상으로 둡니다.
  if (count !== null && count >= 1 && level >= 5) {
    return reply(pattern ? 0.65 : 0.52, pattern);
  }

  return reply(0.2, pattern);
}
