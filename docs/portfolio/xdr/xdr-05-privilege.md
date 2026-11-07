# XDR-05 | 권한 상승 탐지

**작업 범위:** 제작 1 — Wazuh 경보 읽기 · 제작 2 — MITRE ATT&CK 패턴 · 제작 3 — 독립 판단 · 제작 4 — 임시 거부 후보·알림 연결 · 제작 5 — 재판정·오차단 확인 (2026-11-07)

**기록 출처:** [XDR 입력 계약](../../../xdr/README.md), [교육용 Wazuh 경보](../../../xdr/fixtures/privilege.json), 제작 1~5의 소스·로컬 실행 결과, 사용자 제공 공식 심판 결과 (평가 커밋 [`a594609c618d`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/a594609c618d566f7584b26a5e65c8ff651d8a7f))

**상태:** 제작 1~5와 저장점 완료. 교육용 경보 **26건: block 9 / alert 8 / record 9**, 정상 이벤트 오차단 **0건**. 사용자 제공 공식 심판 결과 **필수 조건 4/4, 완결성 가점 3개, 완성도 100/100점, 작전 점수 100/100점**.

## 과제 목표

일반 계정이 갑자기 관리자 그룹에 들어가거나 낯선 관리자 권한 명령을 실행하는 **권한 상승(Privilege Escalation) 징후**를 교육용 Wazuh 경보에서 분류합니다. 단순한 그룹 조회·정상 관리 계정 로그인·명령 실패를 명확한 침해로 오인하지 않도록 탐지와 대응을 분리합니다.

## 제작 1 — 경보 읽기

- **문제:** 원본 경보 전체를 출력하면 필요하지 않은 계정·비밀값 형태의 데이터까지 노출될 수 있습니다.
- **해결:** `xdr/privilege/read-alerts.mjs`에서 시각, 출발 IP, 계정, 규칙 수준, 설명의 **다섯 필드**만 추출하는 읽기 전용 모듈을 만들었습니다. 설명의 토큰·비밀번호 형태를 가리는 로직을 포함했고, `decide.mjs`에서는 이 모듈을 불러오지 않습니다.
- **검증:** 사용자 PC에서 Node.js 문법 검사를 통과하고 **원본 26건 / 출력 26줄**을 확인했습니다. 경보 원본 파일은 수정하지 않았습니다. 모든 가능한 비밀값 형태에 대한 완전한 마스킹을 입증한 것은 아닙니다.

## 제작 2 — 근거 있는 공격 패턴

- **문제:** 관리자 그룹 변경이나 관리자 명령 한 건만으로 계정 탈취나 취약점 악용을 확정하면 정상 사용자까지 차단할 수 있습니다.
- **해결:** `xdr/privilege/patterns.json`에 **갑작스러운 관리자 그룹 추가**, **처음 보는 관리자 권한 명령**, **업무 시간 밖 권한 사용**의 패턴 3개를 정의했습니다. 각 패턴에 이름·탐지 조건·근거 한 줄·MITRE 공식 링크를 포함했습니다.
- **검증:** 사용자 PC에서 JSON 읽기, **패턴 3개**, 패턴별 근거 **각 1줄**을 확인했습니다.

| 패턴 | 참고 기술 | 차단 판단 시 주의점 |
|---|---|---|
| 갑작스러운 관리자 그룹 추가 | [T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/) | 그룹 추가만으로 유효 계정 악용을 확정하지 않음 |
| 처음 보는 관리자 권한 명령 | [T1068 — Exploitation for Privilege Escalation](https://attack.mitre.org/techniques/T1068/) | 명령 실행만으로 소프트웨어 취약점 악용을 확정하지 않음 |
| 업무 시간 밖 권한 사용 | [T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/) | 시간대 정보만으로 정상 관리 업무를 자동 차단하지 않음 |

## 제작 3 — 격리 환경 독립 판단

- **문제:** 심판이 인터넷이나 추가 파일 없이 `decide.mjs` 한 파일만 불러오므로 외부 의존성을 없애야 합니다.
- **해결:** `patterns.json`의 패턴 3개를 상단 상수로 내장하고, `decide(alert)`가 설명·MITRE 태그·규칙 수준·그룹 정보·반복 정황을 조합해 `{ action, confidence, reason }`을 반환하도록 구현했습니다. 확신도 **0.85 이상은 block / 0.50 이상은 alert / 그 미만은 record**입니다. `import` 및 파일 입출력 없이 동작합니다.
- **검증:** 사용자 PC에서 문법·반환 형식·임계값·입력 불변·`import` 부재를 검사했고 경보 **26건을 9/8/9로 분류**, 정상 이벤트 오차단 **0건**을 확인했습니다.

## 제작 4 — 만료형 거부 후보와 알림

- **문제:** `block` 분류를 그대로 운영 ZTNA 차단으로 연결하면 Wazuh 계정명과 신뢰된 ZTNA `subjectId`의 식별 차이로 정상 세션을 막을 수 있습니다.
- **해결:** `xdr/privilege/respond.mjs`에 판단·대응을 분리했습니다. `block` 경보만 검토해 **15분 만료**, 근거 경보 ID·패턴명이 있는 거부 **후보**를 만들고, 같은 계정의 정상·애매한 경보와 충돌하면 후보를 보류합니다. `xdr/alerts.log`에는 경보 원문과 개인 식별 정보를 배제한 알림 요약을 한 줄씩 누적합니다.
- **검증:** 사용자 PC에서 거부 후보 **4개**, 충돌로 보류한 block 경보 **5건**, 알림 로그 **17줄 추가**, 만료 후 `continue`, 정상·애매한 이벤트 `continue`, 기존 ZTNA 로컬 판정 테스트 **4/4 통과**를 확인했습니다.
- **운영 한계:** 테스트용 신뢰 주체 연결은 **교육용 가상 매핑**입니다. 제공 ZTNA 엔진의 실제 신원 연결·규칙 집행 경로는 구현되지 않아 **`staged_only`**로만 동작합니다. `continue`는 최종 허용이 아니라 기존 ZTNA 판정을 이어간다는 뜻입니다.

## 제작 5 — 전체 경보 재시험과 저장점

- **문제:** 재실행 후 결과 파일의 판정 건수가 실제 경보와 일치하고 정상 이벤트가 오차단되지 않는지 확인해야 합니다.
- **해결:** `npm.cmd run xdr:run -- privilege`로 전체 경보를 재판정하고 `xdr/privilege/result.json`을 생성했습니다.
- **검증:** **`counts = { block: 9, alert: 8, record: 9 }`**, 정상 이벤트 **`pv-18`~`pv-26` 모두 `record`**, 오차단 **0건**이었습니다. 저장점에서 같은 명령을 다시 실행했을 때 `result.json`의 내용이 이전 커밋과 같았으므로 저장점 커밋에는 기존 루트 `README.md`의 기록만 추가했습니다.

## 공식 심판 결과 — XDR-05

**결과 출처:** 사용자가 제공한 방어전 심판 판정 문구. 평가 대상은 [보너스 xdr-05 저장점 `a594609c618d`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/a594609c618d566f7584b26a5e65c8ff651d8a7f)입니다.

| 공식 확인 항목 | 결과 |
|---|---|
| 방어 결과 | **방어 성공 — 이 단계의 괴물 모두 격파** |
| 필수 조건 | **4/4 확인** |
| 완결성 가점 | **3개** |
| 완성도 | **100 / 100** |
| 작전 점수 | **100 / 100 획득** |
| 평가 커밋 | `a594609c618d` |
| 재제출 | 심판에서 불필요하다고 안내 |

### 포트폴리오 3줄 — 문제 → 해결 → 검증

- **문제:** 일반 계정의 갑작스러운 관리자 권한 획득과 비정상 명령을 찾아내면서, 정상 관리자 활동까지 막지 않아야 했습니다.
- **해결:** MITRE ATT&CK T1068·T1078 기반 패턴 3개와 단일 파일 독립 판정기, 근거 경보·만료 시각이 있는 임시 거부 후보 및 알림 처리를 역할별로 분리했습니다.
- **검증:** 교육용 Wazuh 경보 **26건을 block 9 / alert 8 / record 9**로 분류했고 정상 오차단 **0건**을 확인했습니다. **공식 심판 조건 4/4, 완결성 가점 3개, 완성도 100/100점, 작전 점수 100/100점**을 받았습니다.

## 재현과 검증 범위

```powershell
node xdr/privilege/read-alerts.mjs | Measure-Object -Line
npm.cmd run xdr:run -- privilege
Get-Content xdr/privilege/result.json -Raw -Encoding UTF8
node xdr/privilege/respond.mjs
npm.cmd run decider:test
```

`respond.mjs`를 다시 실행하면 `xdr/alerts.log`에 같은 교육용 경보의 알림이 **추가 누적**됩니다. `xdr/alerts.log`와 각 모듈의 `deny-rules.json`은 Git 제외 대상입니다. 공식 심판의 **방어 성공**과 운영 ZTNA에서의 **실제 세션 차단·회수**를 구분하며, 후자는 검증되지 않았습니다.

## 관련 파일

- [교육용 Wazuh 경보](../../../xdr/fixtures/privilege.json)
- [경보 읽기 모듈](../../../xdr/privilege/read-alerts.mjs)
- [탐지 패턴](../../../xdr/privilege/patterns.json)
- [독립 판단 모듈](../../../xdr/privilege/decide.mjs)
- [대응 연결 모듈](../../../xdr/privilege/respond.mjs)
- [26건 판정 결과](../../../xdr/privilege/result.json)
- [공식 평가 저장점](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/a594609c618d566f7584b26a5e65c8ff651d8a7f)
