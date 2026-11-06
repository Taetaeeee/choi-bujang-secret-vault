// XDR-04 제작 3: 격리 실행용 지속성 경보 판정기.
// 아래 패턴은 patterns.json의 내용을 생성 시점에 내장했습니다.
const PATTERNS = Object.freeze([
    {
        "id":  "unsigned-service-registration",
        "name":  "서명 없는 신규 서비스 등록 또는 실행 파일 변경",
        "condition":  "Wazuh rule.description에 서명 없는 새 서비스 등록·서명 없는 서비스 실행 파일 변경·평소 목록 밖 서비스의 재부팅 지속 등록 중 하나가 명시되고, rule.mitre의 T1543 및 data.path의 임시 실행 파일 경로·data.count의 반복 등록 등 추가 정황을 확인한다. 단순 서비스 재시작이나 설명 변경만으로는 악용 확정하지 않는다.",
        "evidence":  "MITRE ATT\u0026CK T1543은 공격자가 재실행을 유지하기 위해 시스템 서비스를 새로 등록하거나 기존 서비스의 실행 구성을 변경하는 지속성 기법을 설명한다.",
        "reference":  "https://attack.mitre.org/techniques/T1543/"
    },
    {
        "id":  "unfamiliar-scheduled-task",
        "name":  "낯선 예약 작업을 통한 비정상 프로그램 실행",
        "condition":  "Wazuh rule.description에 처음 보는 예약 작업·임의 이름·수업 시간 밖 실행 등이 있고, rule.mitre의 T1053과 data.path의 임시 폴더 실행 파일 등 비정상 실행 근거를 함께 확인한다. 수업용 작업 등록이나 정상 업데이트 예약만으로는 악용 확정하지 않는다.",
        "evidence":  "MITRE ATT\u0026CK T1053은 공격자가 예약 작업을 만들거나 바꾸어 악성 프로그램을 특정 시각 또는 반복적으로 실행하고 지속성을 확보할 수 있다고 설명한다.",
        "reference":  "https://attack.mitre.org/techniques/T1053/"
    },
    {
        "id":  "startup-folder-persistence",
        "name":  "평소 목록에 없는 시작 폴더 자동 실행 항목",
        "condition":  "Wazuh rule.description에 시작 폴더의 새 프로그램이 평소 목록에 없다는 정보가 있고, data.path가 Windows Startup 폴더를 가리키거나 동일 임시 파일을 예약 작업과 함께 실행하도록 등록한 정황을 확인한다. 시작 폴더 변경 1건이나 서명 미확인만으로는 자동 차단하지 않는다.",
        "evidence":  "MITRE ATT\u0026CK T1547.001은 Windows 시작 폴더에 프로그램을 추가하면 로그인할 때 실행되어 지속성을 확보할 수 있다고 설명한다.",
        "reference":  "https://attack.mitre.org/techniques/T1547/001/"
    }
].map(pattern => Object.freeze(pattern)));

function safeText(value, maxLength = 2000) {
  return typeof value === 'string' && value.length <= maxLength ? value : '';
}

function hasTechnique(mitre, technique) {
  return Array.isArray(mitre) && mitre.some(tag =>
    typeof tag === 'string' &&
    (tag === technique || tag.startsWith(`${technique}.`)));
}

function result(confidence, pattern = null) {
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    reason: pattern?.name ?? '일치하는 근거 패턴 없음',
  };
}

// 격리 심판이 호출하는 유일한 공개 함수입니다.
export function decide(alert) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
    return result(0.1);
  }

  const rule = alert.rule;
  const data = alert.data;

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)
      || !data || typeof data !== 'object' || Array.isArray(data)) {
    return result(0.1);
  }

  const description = safeText(rule.description);
  const path = safeText(data.path, 1024);
  const level = rule.level;

  if (!description || !Number.isInteger(level) || level < 0 || level > 16) {
    return result(0.1);
  }

  const service = /서비스/u.test(description);
  const task = /예약\s*작업/u.test(description);
  const startup = /시작\s*(?:폴더|프로그램|항목)/u.test(description);

  const t1543 = hasTechnique(rule.mitre, 'T1543');
  const t1053 = hasTechnique(rule.mitre, 'T1053');
  const t1547 = hasTechnique(rule.mitre, 'T1547.001');

  const tempExecutable = /(?:^|[\\/])(?:temp|tmp)[\\/][^\\/]+\.(?:exe|com|dll|ps1|bat|cmd)$/iu.test(path);
  const startupExecutable = /[\\/]Start Menu[\\/]Programs[\\/]Startup[\\/][^\\/]+\.(?:exe|com|bat|cmd|ps1)$/iu.test(path);

  const unknown = /평소\s*목록에\s*없는|처음\s*보는|낯선/u.test(description);
  const unsigned = /서명\s*없는|서명이\s*없/u.test(description);
  const registration = /새\s*서비스|신규|등록|추가|생성/u.test(description);
  const modifiedBinary = /실행\s*파일이\s*바뀌/u.test(description);
  const persists = /다시\s*켜도\s*남도록|재부팅|자동\s*실행/u.test(description);

  const countValue = typeof data.count === 'string' || Number.isInteger(data.count)
    ? String(data.count) : '';
  const repeated = /연속|반복/u.test(description)
    && /^(?:[3-9]|[1-9]\d{1,5})$/u.test(countValue);

  const offHours = /수업\s*시간\s*밖/u.test(description);
  const randomName = /임의\s*문자열/u.test(description);
  const linkedTemp = /같은\s*임시\s*파일을\s*함께\s*가리/u.test(description);

  // 명확한 공격: 높은 경보 수준과 복수의 구체적 근거가 일치해야 차단.
  if (level >= 10) {
    if (t1543 && service) {
      if (tempExecutable &&
          ((unsigned && (registration || modifiedBinary)) ||
           (unknown && persists))) {
        return result(0.94, PATTERNS[0]);
      }

      if (unsigned && registration && repeated) {
        return result(0.94, PATTERNS[0]);
      }
    }

    if (t1053 && task && tempExecutable &&
        (unknown || offHours || randomName)) {
      return result(0.94, PATTERNS[1]);
    }

    if ((t1543 || t1547) && startup && startupExecutable &&
        unknown && /추가|등록/u.test(description)) {
      return result(0.94, PATTERNS[2]);
    }

    if (t1543 && t1053 && startup && task &&
        tempExecutable && linkedTemp) {
      return result(0.96, PATTERNS[2]);
    }
  }

  // 애매한 경보: 단발 변경, 서명 미확인, 수업용 작업은 조사만 수행.
  if (level >= 5 && (t1543 || t1053 || t1547)) {
    if (service) return result(0.55, PATTERNS[0]);
    if (task) return result(0.55, PATTERNS[1]);
    if (startup) return result(0.55, PATTERNS[2]);

    if (tempExecutable &&
        /임시\s*폴더|실행\s*파일/u.test(description)) {
      return result(0.55, PATTERNS[0]);
    }
  }

  // 근거가 부족한 정상 이벤트는 차단하지 않음.
  return result(0.1);
}
