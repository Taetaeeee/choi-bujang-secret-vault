# XDR-06 | 자료 유출 탐지

**작업 범위:** 제작 1 — Wazuh 경보 읽기 · 제작 2 — MITRE ATT&CK 패턴 · 제작 3 — 독립 판단 · 제작 4 — 임시 거부 후보·알림 연결 · 제작 5 — 전체 경보 재판정 (2026-11-07)

**기록 출처:** [XDR 입력 계약](../../../xdr/README.md), [교육용 Wazuh 경보](../../../xdr/fixtures/exfiltration.json), 제작 1~5 소스와 사용자 PC 실행 결과, 사용자 제공 공식 심판 결과 (평가 커밋 [`d5af2c087239`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/d5af2c087239162e07ddafb80cfbd790a204073e)).

**상태:** 제작 1~5와 저장점 완료. 교육용 경보 **30건: block 10 / alert 10 / record 10**, 정상 이벤트 오차단 **0건**. 사용자 제공 공식 심판 결과 **필수 조건 4/4, 완결성 가점 3개, 완성도 100/100점, 작전 점수 100/100점**.

## 과제 목표

최 부장 PC에서 낯선 외부 목적지로 많은 자료가 빠져나가는 정황을 탐지합니다. **명확한 유출 경보는 block, 추가 조사가 필요한 경보는 alert, 정상 이용은 record**로 나누며, 기존 ZTNA 판정 규칙을 바꾸지 않고 별도의 대응 후보와 알림을 만듭니다. 교육용 Wazuh 경보를 통한 탐지와 실제 운영 네트워크의 차단은 구별합니다.

## 제작 1 — 경보 읽기

- **문제:** 원본 경보 전체를 출력하면 불필요한 정보나 비밀값 형태의 문자열이 노출될 수 있습니다.
- **해결:** `xdr/exfiltration/read-alerts.mjs`를 별도로 만들어 시각·출발 IP·계정·규칙 수준·설명 다섯 필드만 추출하고, 비밀번호·토큰 등으로 의심되는 문자열의 마스킹 처리를 포함했습니다. `decide.mjs`에서는 읽기 모듈을 불러오지 않습니다.
- **검증:** 사용자 PC에서 Node.js 문법 검사와 **원본 경보 30건 / 추출 출력 30줄** 일치를 확인했습니다. 원본 경보는 변경하지 않았으며, 마스킹이 모든 비밀값 형태를 완벽히 처리한다고 단정하지 않습니다.

## 제작 2 — 근거 기반 탐지 패턴

- **문제:** 외부 전송 또는 MITRE 기술 태그 하나만 보고 유출을 확정하면 정상적인 백업·자료 동기화까지 차단할 위험이 있습니다.
- **해결:** `xdr/exfiltration/patterns.json`에 세 패턴을 정의하고 이름·찾는 조건·근거 한 줄·공식 참조 링크를 기록했습니다.
- **검증:** 사용자 PC에서 JSON 읽기와 **패턴 3개**, 각 패턴의 이름·조건 및 **한 줄 근거 3개**를 검사했습니다.

| 패턴 | 기술 근거 | 판정 시 주의점 |
|---|---|---|
| 처음 보는 목적지로 대량 자료 반출 | [T1048](https://attack.mitre.org/techniques/T1048/) | 목적지 IP·전송량 하나만으로 유출을 확정하지 않음 |
| 업무 시간 밖 압축 파일 외부 반출 | [T1048](https://attack.mitre.org/techniques/T1048/) | 압축 파일 생성이나 시각만으로 실제 외부 반출을 확정하지 않음 |
| 명령 통로를 통한 대량·반복 전송 | [T1041](https://attack.mitre.org/techniques/T1041/) | C2 통로 존재만으로 유출 성공을 확정하지 않음 |

## 제작 3 — 독립 실행형 판단 모듈

- **문제:** 심판은 인터넷 없이 `decide.mjs` 하나만 불러오므로 외부 파일·패키지에 의존할 수 없습니다. 명확한 공격과 애매한 전송도 구분해야 합니다.
- **해결:** 세 패턴을 `xdr/exfiltration/decide.mjs` 상단 상수로 내장했습니다. `decide(alert)`가 설명·규칙 수준·MITRE 태그·목적지·전송량·파일 수·반복 정황을 교차 확인하고 `{ action, confidence, reason }`을 반환합니다. 임계값은 **0.85 이상 block / 0.50 이상 alert / 그 미만 record**이며, `import` 및 파일 입출력을 사용하지 않습니다.
- **검증:** 사용자 PC에서 반환 형식·확신도 임계값·패턴 근거·원본 불변을 검사하고 교육용 경보 **30건을 block 10 / alert 10 / record 10**으로 분류했습니다. 정상 이벤트 오차단은 **0건**입니다.

## 제작 4 — 만료형 거부 후보와 알림

- **문제:** 유출 의심 목적지 IP만 무조건 차단하면 같은 목적지를 쓰는 정상 요청까지 영향을 받을 수 있고, 기존 ZTNA 계약에는 외부 목적지 IP가 없습니다.
- **해결:** `xdr/exfiltration/respond.mjs`에서 `decide(alert)`의 **block 판정만** 출발 IP·목적지 IP 쌍을 기준으로 **15분 만료 거부 후보**로 만들고, 규칙에 근거 경보 ID·패턴명·만료 시각을 기록했습니다. block·alert 경보는 민감한 원문 없이 `xdr/alerts.log`에 한 줄씩 추가합니다. `decide.mjs`와 `src/decider.mjs`는 변경하지 않았습니다.
- **검증:** 사용자 PC에서 전체 **30건 처리**, **거부 후보 10개**, **위험·의심 알림 로그 20줄 추가**, 보류 0건을 확인했습니다. 모의 흐름 기준으로 공격 경보를 구별하고 정상·애매한 흐름은 기존 정책 판정으로 진행하도록 설계했습니다.
- **운영 한계:** 현재 ZTNA 공식 요청 계약에 목적지 IP·외부 규칙 설치 수단이 없어 거부 후보는 **`staged_only`**입니다. `continue`는 기존 ZTNA 판정을 이어간다는 뜻이며 접근 허용을 보장하지 않습니다. **운영 ZTNA의 실제 차단은 검증되지 않았습니다.**

## 제작 5 — 전체 경보 재시험과 저장점

- **문제:** 결과 파일의 판정 건수와 정상 이벤트 오차단 여부를 재확인하고, 추후 같은 조건으로 결과를 재현할 수 있어야 합니다.
- **해결:** `npm.cmd run xdr:run -- exfiltration`을 실행하여 `xdr/exfiltration/result.json`을 생성하고, 저장점에서 결과 건수·재현 명령·운영 한계를 루트 README에 기록했습니다.
- **검증:** 사용자 PC에서 **`counts = { block: 10, alert: 10, record: 10 }`**, 정상 이벤트 **`ex-21`~`ex-30` 모두 `record`**, 오차단 **0건**을 확인했습니다. 저장점 재실행 결과는 기존 결과 파일과 동일하여 저장점 커밋에서 `README.md`만 변경됐습니다.

## 공식 심판 결과 — XDR-06

**결과 출처:** 사용자가 제공한 방어전 공식 심판 판정 문구. 평가 대상은 [보너스 xdr-06 저장점 `d5af2c087239`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/d5af2c087239162e07ddafb80cfbd790a204073e)입니다.

| 공식 확인 항목 | 결과 |
|---|---|
| 방어 결과 | **방어 성공 — 이 단계의 괴물 모두 격파** |
| 필수 조건 | **4/4 확인** |
| 완결성 가점 | **3개** |
| 완성도 | **100 / 100** |
| 작전 점수 | **100 / 100 획득** |
| 평가 커밋 | `d5af2c087239` |
| 재제출 | 심판에서 불필요하다고 안내 |

### 포트폴리오 3줄 — 문제 → 해결 → 검증

- **문제:** 낯선 목적지로 대량의 자료가 전송되는 유출 정황을 포착하면서 정상적인 파일 동기화·백업을 잘못 차단하지 않아야 했습니다.
- **해결:** MITRE ATT&CK T1041·T1048 기반 패턴 3개, 독립 실행형 `decide(alert)`, 출발지·목적지 쌍에 한정된 15분 만료 거부 후보와 알림 처리를 분리 구현했습니다.
- **검증:** 교육용 Wazuh 경보 **30건을 block 10 / alert 10 / record 10**으로 분류했고 정상 오차단 **0건**을 확인했습니다. **공식 심판 조건 4/4, 완결성 가점 3개, 완성도 100/100점, 작전 점수 100/100점**을 받았습니다.

## 재현과 검증 범위

```powershell
node xdr/exfiltration/read-alerts.mjs | Measure-Object -Line
npm.cmd run xdr:run -- exfiltration
Get-Content xdr/exfiltration/result.json -Raw -Encoding UTF8
node xdr/exfiltration/respond.mjs
```

`respond.mjs`를 다시 실행하면 `xdr/alerts.log`에 같은 교육용 경보의 알림이 **추가 누적**됩니다. 이 로그 및 `xdr/exfiltration/deny-rules.json`은 Git 제외 대상입니다. 로컬의 모의 흐름·거부 후보와 실제 운영 ZTNA의 접근 차단을 혼동하지 않으며, **공식 심판에서의 방어 성공**은 별도 확인된 평가 결과로 기록합니다.

## 관련 파일

- [교육용 Wazuh 경보](../../../xdr/fixtures/exfiltration.json)
- [경보 읽기 모듈](../../../xdr/exfiltration/read-alerts.mjs)
- [탐지 패턴](../../../xdr/exfiltration/patterns.json)
- [독립 판단 모듈](../../../xdr/exfiltration/decide.mjs)
- [대응 연결 모듈](../../../xdr/exfiltration/respond.mjs)
- [30건 판정 결과](../../../xdr/exfiltration/result.json)
- [공식 평가 저장점](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/d5af2c087239162e07ddafb80cfbd790a204073e)
