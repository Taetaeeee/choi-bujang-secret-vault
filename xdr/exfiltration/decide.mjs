// XDR-06 제작 3: 자료 유출 경보의 독립 실행형 판정기.
// PATTERNS는 xdr/exfiltration/patterns.json의 세 패턴을 내장한 것입니다.
// 심판이 이 파일만 불러오므로 import, 파일 I/O, 네트워크 호출을 사용하지 않습니다.
const PATTERNS = Object.freeze([
  {
    "id": "first-seen-bulk-exfiltration",
    "name": "처음 보는 목적지로 대량 자료 반출",
    "condition": "rule.mitre에 T1048이 있고 rule.description에 처음 보는 목적지 또는 주소로 자료·파일을 대량 전송하거나 여러 건 반출했다는 구체적인 내용이 있는지 확인한다. data.dstip과 숫자로 해석 가능한 data.bytes·data.files를 보조 근거로 확인하며, 목적지 IP 또는 전송량 하나만으로 공격을 확정하지 않는다. T1048 태그만으로 실제 대체 프로토콜 사용이 입증되는 것은 아니다.",
    "evidence": "MITRE ATT&CK T1048은 기존 명령·제어 채널과 다른 프로토콜 또는 별도 목적지로 데이터를 반출하는 기법이므로, 낯선 목적지로 향한 비정상적인 대량 전송은 조사할 정황이다.",
    "reference": "https://attack.mitre.org/techniques/T1048/"
  },
  {
    "id": "off-hours-archive-exfiltration",
    "name": "업무 시간 밖 압축 파일 외부 반출",
    "condition": "rule.mitre에 T1048이 있고 rule.description에 수업·업무 시간 밖이라는 명시적 정황과 압축 파일이 외부 목적지로 전송됐다는 내용이 함께 있는지 확인한다. data.dstip과 data.bytes를 교차 확인하고, timestamp만으로 업무 시간대를 임의 판정하거나 압축 파일을 만들기만 한 사건·정상 백업을 유출로 확정하지 않는다.",
    "evidence": "MITRE ATT&CK T1048은 별도 네트워크 프로토콜로 정보를 빼돌리는 방식을 다루므로, 비업무 시간에 압축 파일이 외부로 전송된 정황은 정상 백업 여부를 대조할 조사 신호다.",
    "reference": "https://attack.mitre.org/techniques/T1048/"
  },
  {
    "id": "repeated-c2-channel-exfiltration",
    "name": "명령 통로를 통한 대량·반복 전송",
    "condition": "rule.mitre에 T1041이 있고 rule.description에 명령 통로를 통한 큰 파일·자료의 실제 외부 전송과 반복 정황이 함께 명시되는지 확인한다. data.dstip, data.bytes, data.count를 보조 근거로 확인하며, 짧은 자료 이름이나 명령 통로의 존재만으로 유출을 확정하지 않는다.",
    "evidence": "MITRE ATT&CK T1041은 기존 명령·제어(C2) 채널에 데이터를 실어 유출하는 기법이므로, 그 통로에서의 대량·반복 전송은 유출이 의심되는 신호다.",
    "reference": "https://attack.mitre.org/techniques/T1041/"
  }
]);

const BLOCK_MIN = 0.85;
const ALERT_MIN = 0.5;
const LARGE_BYTES = 50_000_000; // 교육용 경보의 보수적 대량 전송 하한. 이 값만으로 차단하지 않습니다.

function judgment(confidence, pattern) {
  const action = confidence >= BLOCK_MIN ? 'block'
    : confidence >= ALERT_MIN ? 'alert' : 'record';
  return {
    action,
    confidence,
    reason: pattern ? pattern.name : '일치하는 근거 패턴 없음',
  };
}

function nonnegativeInteger(value) {
  if (typeof value === 'string' && /^\d{1,15}$/u.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// 전달된 목적지가 실제 주소 모양인지 기본 검증합니다. IP의 출처나 평소 여부를
// 이 함수만으로 인증할 수는 없으며, 그런 판단은 경보 설명과 함께 사용합니다.
function hasDestination(value) {
  if (typeof value !== 'string' || value.length > 45) return false;
  const octets = value.split('.');
  if (octets.length !== 4) return false;
  return octets.every(o => /^\d{1,3}$/u.test(o) && Number(o) <= 255);
}

export function decide(alert) {
  const rule = alert?.rule;
  const description = rule?.description;
  const level = rule?.level;
  const mitre = rule?.mitre;
  const data = alert?.data;

  if (!alert || typeof alert !== 'object' || Array.isArray(alert)
      || typeof description !== 'string' || !description.trim()
      || description.length > 2000
      || !Number.isInteger(level) || level < 0 || level > 16
      || !Array.isArray(mitre)) {
    return judgment(0.1, null);
  }

  const hasT1041 = mitre.includes('T1041');
  const hasT1048 = mitre.includes('T1048');
  if ((!hasT1041 && !hasT1048) || level < 5) {
    // 정상 동기화에 ATT&CK 태그가 붙어도 고위험으로 승격하지 않습니다.
    return judgment(0.1, null);
  }

  const bytes = nonnegativeInteger(data?.bytes);
  const files = nonnegativeInteger(data?.files);
  const count = nonnegativeInteger(data?.count);
  const destination = hasDestination(data?.dstip);

  const firstSeen = /처음 보는 (?:목적지|주소)|평소와 다른 주소|낯선 (?:목적지|주소)/u.test(description);
  const offHours = /(?:수업|업무|근무) 시간 밖|비업무 시각|심야/u.test(description);
  const archive = /압축 파일|압축 자료|압축한 파일/u.test(description);
  const c2Channel = /명령 통로|명령.?제어 (?:통로|채널)|C2 채널/u.test(description);
  const unusualPort = /쓰지 않던 포트|비표준 포트|처음 보는 포트/u.test(description);
  const entireCollection = /자료실 전체|자료 전체|모든 자료|전체 파일/u.test(description);
  const multipleDestinations = /목적지 두 곳|목적지 여러 곳|여러 목적지/u.test(description);
  const repeated = /반복|연속|\d+번|10분 안에|짧은 시간|한 번에/u.test(description);
  const sent = /나갔|올라갔|복사됐|전송됐|전송이|전송되|반출됐|유출됐/u.test(description);
  const negative = /전송은 아직 없|전송은 없|파일 전송은 없|실패|취소|큰 파일은 아닙니다/u.test(description);
  const expectedContext = /수업 자료 주소|평소 목적지|목적지는 자료실|백업처럼 보이는/u.test(description);
  const transferContext = /전송|자료|파일|목적지|주소|압축|백업|명령 통로/u.test(description);

  const strongBase = level >= 10 && destination && bytes !== null
    && bytes >= LARGE_BYTES && sent && !negative && !expectedContext;

  if (strongBase) {
    // 시간대는 timestamp에서 추정하지 않고 경보에 명시된 때만 사용합니다.
    if (hasT1048 && offHours && archive) {
      return judgment(0.97, PATTERNS[1]);
    }
    if (hasT1041 && c2Channel && repeated && (count === null || count >= 2)) {
      return judgment(0.97, PATTERNS[2]);
    }
    // 명령 통로 자체는 드러나지 않더라도 T1041 분류 + 명확한 반복 전송을 교차 확인.
    if (hasT1041 && repeated && count !== null && count >= 5) {
      return judgment(0.93, PATTERNS[2]);
    }
    // 비업무 시간의 대량 반복 송신은 압축 여부가 별도로 입증되진 않은 이상 징후.
    if (hasT1048 && offHours && repeated && count !== null && count >= 5) {
      return judgment(0.91, PATTERNS[1]);
    }
    if (firstSeen && (files !== null && files >= 2
        || count !== null && count >= 3
        || archive && bytes >= 80_000_000
        || multipleDestinations)) {
      return judgment(0.95, PATTERNS[0]);
    }
    if (hasT1048 && unusualPort && repeated && files !== null && files >= 10) {
      return judgment(0.93, PATTERNS[0]);
    }
    if (entireCollection && files !== null && files >= 50) {
      return judgment(0.96, PATTERNS[0]);
    }
  }

  // 단발 시도·백업 가능성·미전송 등은 자동 차단 없이 추가 확인으로 남깁니다.
  // 단순 MITRE 태그만으로 alert를 발생시키지 않고 설명의 전송 정황을 확인합니다.
  if (transferContext) {
    if (c2Channel || (hasT1041 && repeated)) return judgment(0.60, PATTERNS[2]);
    if (offHours || archive) return judgment(0.57, PATTERNS[1]);
    return judgment(0.55, PATTERNS[0]);
  }
  return judgment(0.1, null);
}
