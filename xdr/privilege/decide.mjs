// XDR-05 제작 3: 독립 실행형 권한 상승 경보 판정기.
// PATTERNS는 xdr/privilege/patterns.json의 패턴 3개를 그대로 내장합니다.
// 심판은 이 파일만 불러오므로 외부 모듈, 파일 입출력, 외부 호출을 사용하지 않습니다.
const PATTERNS = Object.freeze([
  {
    "id": "unexpected-admin-group-membership",
    "name": "갑작스러운 관리자 그룹 추가",
    "condition": "Wazuh rule.description에 일반 계정의 관리자 그룹 편입·짧은 시간 내 재편입·여러 계정의 연속 추가가 명시되고, 가능한 경우 data.group이 administrators인지, data.count에 반복 근거가 있는지, rule.mitre에 T1078이 있는지 확인한다. 그룹 추가 한 건만으로 계정 도용을 확정하지 않는다.",
    "evidence": "MITRE ATT&CK T1078은 공격자가 기존 계정의 유효 자격 증명을 악용해 높은 권한에 접근할 수 있다고 설명하므로 비정상적인 관리자 그룹 편입은 계정 악용 조사 신호다.",
    "reference": "https://attack.mitre.org/techniques/T1078/"
  },
  {
    "id": "unfamiliar-privileged-command",
    "name": "처음 보는 관리자 권한 명령",
    "condition": "Wazuh rule.description에 처음 보는 주소에서의 관리자 명령, 직전 관리자 권한 획득 후 명령 실행, 다른 계정 권한으로 명령 실행, 세션 권한의 갑작스러운 변경 중 하나가 명시되는지 확인하고 rule.mitre의 T1068 또는 T1078 및 rule.level을 교차 확인한다. 명령 1건이나 실패 1건만으로 취약점 악용을 확정하지 않는다.",
    "evidence": "MITRE ATT&CK T1068은 소프트웨어 취약점 악용을 통한 권한 상승을 설명하므로 비정상 관리자 명령은 조사 대상이지만 명령 실행 사실만으로 취약점 악용을 증명하지는 못한다.",
    "reference": "https://attack.mitre.org/techniques/T1068/"
  },
  {
    "id": "off-hours-privilege-use",
    "name": "업무 시간 밖 권한 사용",
    "condition": "Wazuh rule.description이 수업·업무 시간 밖의 관리자 명령 또는 비업무 시각의 관리자 그룹 추가와 명령 실행을 명시하는지 확인하고 rule.mitre의 T1068·T1078 맥락과 함께 평가한다. timestamp만으로 업무 시간 여부를 임의 추정하거나 평소 관리자 활동을 자동 차단하지 않는다.",
    "evidence": "MITRE ATT&CK T1078은 유효 계정을 이용한 권한 상승을 다루며 관련 탐지 지침도 비정상 시각의 계정 활동을 살피므로 시간대 이탈과 권한 사용의 결합은 조사 근거가 된다.",
    "reference": "https://attack.mitre.org/techniques/T1078/"
  }
]);

const BLOCK_MIN = 0.85;
const ALERT_MIN = 0.5;

function judgment(confidence, pattern) {
  const action = confidence >= BLOCK_MIN ? 'block'
    : confidence >= ALERT_MIN ? 'alert' : 'record';
  return { action, confidence, reason: pattern ? pattern.name : '일치하는 근거 패턴 없음' };
}

export function decide(alert) {
  const description = alert?.rule?.description;
  const level = alert?.rule?.level;
  const mitre = alert?.rule?.mitre;
  const data = alert?.data;

  // 손상되거나 출처가 불명확한 경보는 차단 근거로 사용하지 않습니다.
  if (typeof description !== 'string' || description.length > 2000
      || !Number.isInteger(level) || level < 0 || level > 16
      || !Array.isArray(mitre)) {
    return judgment(0.1, null);
  }

  const hasT1068 = mitre.includes('T1068');
  const hasT1078 = mitre.includes('T1078');
  if (!hasT1068 && !hasT1078) return judgment(0.1, null);

  const group = typeof data?.group === 'string' ? data.group.trim().toLowerCase() : '';
  const hasGroupField = group.length > 0;
  const isAdminGroup = group === 'administrators';
  const explicitOtherGroup = hasGroupField && !isAdminGroup;
  const count = typeof data?.count === 'string' && /^\d{1,4}$/u.test(data.count)
    ? Number(data.count) : (Number.isInteger(data?.count) ? data.count : 0);

  const negatedAdminGroup = /관리자 그룹(?:은|이)\s*아닙니다|관리자 그룹이\s*아닌/u.test(description);
  const mentionsAdminGroup = /관리자 그룹/u.test(description);
  const addedToAdminGroup = (
    (mentionsAdminGroup && /추가|들어갔|들어왔|편입|재가입/u.test(description))
    || /다시 관리자(?:로|에)\s*들어/u.test(description)
  ) && !negatedAdminGroup && !explicitOtherGroup;

  const privilegedCommand = /관리자\s*(?:권한\s*)?명령|권한\s*명령/u.test(description);
  const commandExecuted = /명령을?\s*실행|명령 실행/u.test(description);
  const sessionPromoted = /세션.{0,20}관리자 권한으로 바뀌|관리자 권한으로\s*변경/u.test(description);
  const unusualSourceOrIdentity = /원격 주소|처음 보는 주소|주소는 처음 봅|평범한 계정|방금 관리자가 된|다른 계정의 권한|곧바로/u.test(description);
  const abnormalGroupChange = /같은 주소|계정\s*\d+개|연속|빠진 계정|\d+분 뒤|다시 관리자/u.test(description);
  const offHours = /수업 시간 밖|업무 시간 밖|근무 시간 밖|비업무 시각|업무처럼 보이지 않는 시각/u.test(description);

  const canceledOrFailed = /취소됐|취소했|실패|명령은\s*없|변경은\s*없/u.test(description);
  const strongEnough = level >= 10 && !canceledOrFailed;
  const groupStrong = strongEnough && hasT1078 && addedToAdminGroup
    && (unusualSourceOrIdentity || abnormalGroupChange || offHours
        || (isAdminGroup && count >= 2) || commandExecuted);
  const commandStrong = strongEnough && (hasT1068 || hasT1078)
    && ((privilegedCommand && commandExecuted && (unusualSourceOrIdentity || offHours))
        || (sessionPromoted && unusualSourceOrIdentity));
  const offHoursStrong = strongEnough && offHours && (hasT1068 || hasT1078)
    && ((privilegedCommand && commandExecuted) || (addedToAdminGroup && commandExecuted));

  // 강한 징후라도 취약점 악용·계정 도용의 성공 자체를 증명하지는 않습니다.
  if (offHoursStrong) return judgment(0.95, PATTERNS[2]);
  if (groupStrong) return judgment(count >= 2 || commandExecuted ? 0.96 : 0.92, PATTERNS[0]);
  if (commandStrong) return judgment(sessionPromoted ? 0.93 : 0.94, PATTERNS[1]);

  // 계정·그룹 조회, 실패한 관리자 명령, 수업용 그룹 변경 등은 조사만 요청합니다.
  // 패턴 이름은 조사 범주이며 실제 권한 도용이 확정됐다는 의미가 아닙니다.
  if (level >= 5) {
    if (offHours && /(관리자|권한|그룹)/u.test(description)) {
      return judgment(0.55, PATTERNS[2]);
    }
    if (/(관리자|권한 상승)/u.test(description)
        && /(명령|세션|권한 상승|권한으로)/u.test(description)) {
      return judgment(0.55, PATTERNS[1]);
    }
    if (/(그룹|계정 종류|계정.*(?:변경|조회))/u.test(description)) {
      return judgment(0.55, PATTERNS[0]);
    }
  }
  return judgment(0.1, null);
}
