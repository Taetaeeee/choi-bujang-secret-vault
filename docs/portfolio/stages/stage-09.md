# 9단계 | 도플갱어를 찾고 권한을 거둡니다

**기록 출처:** 제작 1~3 공식 요청과 사용자 PowerShell 실행 결과, [9단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/fb0c750daf43aa7d8537783de879f76290f93ab2)  
**기록 상태:** 제작 1~3 로컬 검증·제출 완료 · 2026-11-03 공식 심판 **100/100점** (사용자 제공 결과)

## 과제와 목표

가명 사용자의 메모 조회 사건이 흩어져 있을 때 비정상적인 짧은 시간의 집중 조회를 탐지하는 과제입니다. 기존 6~8단계 접근 판정·메모 API는 유지하면서, `docs/DETECT_EVENTS.md`에 정의된 **같은 `identity.sub`의 GET 121건 이상/연속 10분 이내** 조건에서만 `burst_read`를 탐지해 접속 **회수 제안**을 반환하도록 했습니다.

## 제작 1 — 신뢰된 최소 입력만 읽기

- **문제:** 사건에 없는 기기·지역·네트워크 정보를 추정하거나 원본 메모·토큰 같은 불필요한 정보를 검사에 사용하면 판단 근거가 불명확해지고 민감 정보가 노출될 수 있음.
- **해결 방법:** `src/detect.mjs`의 `readDetectionEvents(events)`에서 계약상 `at`, `method`, `identity.sub`만 추출해 `{atMs, method, sub}`로 정리했습니다. 날짜와 필드 형식을 검사하고, 잘못된 사건은 입력값을 포함하지 않는 고정 오류로 처리했습니다.
- **검증:** `test/stage9-input.test.mjs` 3건 통과. 정상·폭주 사건의 최소 필드 처리, 부가 필드 비참조, 고정 오류 처리 등을 로컬에서 확인했습니다. 제작 1 시점에는 탐지 규칙 없이 모두 `observe`였고, 제작 2에서 기준에 맞게 동작을 갱신했습니다.

## 제작 2 — 사용자별 연속 10분 슬라이딩 윈도우

- **문제:** 전체 조회 건수만 합산하면 서로 다른 사용자의 요청 또는 10분 밖에 발생한 조회까지 섞여 정상 사용자를 잘못 탐지할 수 있음.
- **해결 방법:** 같은 가명 사용자(`identity.sub`)의 `GET` 사건만 모아 시각 기준으로 정렬하고, 양 끝이 정확히 10분 떨어진 경우를 포함하는 슬라이딩 윈도우로 조회 수를 계산했습니다. 어느 10분 구간에서든 **120건 초과(121건부터)**일 때만 `burst_read`를 탐지하며, 다른 사용자·POST/DELETE·느린 조회는 합산하지 않습니다. 여러 사용자가 폭주하면 임계값을 먼저 넘긴 한 가명 주체를 선택합니다.
- **검증:** `test/stage9-burst.test.mjs` 7건 통과. 120/121건 경계, 정확히 10분과 초과 경계, 사건 역순, 사용자별 분리, GET 외 동작 제외, 다중 폭주 및 부가 필드 미참조를 확인했습니다. 제공된 `npm.cmd run detect:test`의 6개 가상 사건도 모두 통과했습니다.

## 제작 3 — 탐지 반환 계약 제한

- **문제:** 탐지 결과에 기기 ID·역할 등의 추가 정보를 붙이거나 기존 판정기의 허용·거부 응답을 수정하면 계약을 어기거나 정상 기기 권한을 잘못 변경할 수 있음.
- **해결 방법:** 이미 구현된 `detect(events)`의 반환 형태를 유지하고, 정상은 `{ action: 'observe' }` **1개 키**, 의심은 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject: sub }` **3개 키**만 사용하는지 별도 시험을 추가했습니다. `src/decider.mjs`, 기기 권한, 회수 API는 변경하지 않았습니다.
- **검증:** `test/stage9-output.test.mjs` 3건 통과. 정상/폭주/혼합 사건에서 키 이름·개수를 정확히 검사했습니다. 기존 `decider:test` 4개 가상 판정도 통과해 이전 접근 판정의 로컬 회귀를 확인했습니다.

## 최종 저장점 및 제출 검증

| 항목 | 확인 결과 |
|---|---|
| 저장점 커밋 | [`fb0c750`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/fb0c750daf43aa7d8537783de879f76290f93ab2) — `9단계 저장점` |
| 변경 파일 | `README.md`, `aleph.config.json`, `src/attack-check.mjs`, `src/detect.mjs`, `test/stage9-input.test.mjs`, `test/stage9-burst.test.mjs`, `test/stage9-output.test.mjs` — 총 **7개** |
| 9단계 단위 시험 | 입력 처리 3건, 폭주 탐지 7건, 반환 형식 3건 — **13/13 통과** |
| 제공 탐지 가상 시험 | `npm.cmd run detect:test` — 정상 30건·120건 `observe`, 121건·200건 `propose_revocation`, 사용자 혼합·느린 조회 `observe` — **6/6 통과** |
| 기존 기능 회귀 | `decider:test` 4건, `test:r5` 2건, `test:package` 3건 통과; `npm.cmd run build -- --local` 성공 |
| 새 Clone·패키지 설치 | 임시 폴더에 `git clone` 후 커밋 `fb0c750` 확인, `npm.cmd install` 성공(보고된 취약점 0건), `detect:test` 6건 및 `decider:test` 4건 재통과 |
| 제출 묶음 | `npm.cmd run bundle` 성공, 단계 **9** · 커밋 `fb0c750daf43` · 변경 7개 · 판정 규칙 5개 · 직접 점검 **기록** 14개 |
| Vercel 배포 | `/aleph.json`에서 `step: 9`, 커밋 일치 `True`를 사용자가 확인 |
| 공식 심판 결과 | **100/100점** · 기본 조건 **4개 모두 확인** · 완결성 가점 **3개** (2026-11-03 사용자 제공 결과) |

직접 점검 **14개**는 제출 묶음에 포함된 기록 수로, 각 기록이 모두 성공했다는 뜻은 아닙니다. 공식 심판의 세부 내부 판정·공격 로그는 별도로 확인되지 않았습니다.

## 판단과 구현 한계

- **탐지와 대응의 분리:** `propose_revocation`은 해당 가명 사용자에 대한 회수를 **제안하는 값**이며, 실제 세션 해제나 기기 등록 해제 실행을 의미하지 않습니다. 운영 엔진에 사건을 공급하고 회수를 집행하는 경로는 미구현·미실측입니다.
- **정상 기기 유지:** 탐지 함수는 기기 상태를 읽거나 수정하지 않고 `observe`만 반환합니다. 정상 기기 유지 여부는 **로컬 로직과 공식 심판 결과의 범위**에서 확인했으며 운영 기기·세션 변화는 별도로 실측하지 않았습니다.
- **신뢰 경계:** 입력은 운영 엔진이 검증해 전달하는 사건을 전제로 하며, 브라우저에서 임의로 보낸 `identity.sub`를 권한 근거로 사용하도록 연동하지 않았습니다. 기기 번호·IP·지역·토큰·실명·메모 본문을 읽거나 저장하지 않습니다.
- **시간 기준:** 10분 슬라이딩 윈도우는 `at` 시각만 사용하며 수업 계약의 120건 초과 기준으로 구현했습니다. 실제 현장 트래픽에서 임계값을 분석하거나 오탐률을 측정한 것은 아닙니다.
- **개별 기여 범위:** 공식 과제별 요청을 따라 AI와 함께 구현·검증한 내역입니다. 별도로 구현하지 않은 운영 엔진 연동·자동 차단을 성과로 주장하지 않습니다.

## 코드와 재현 절차

- [탐지 함수](../../../src/detect.mjs)
- [탐지 사건 계약](../../DETECT_EVENTS.md)
- [제공된 탐지 연습](../../../scripts/detect-test.mjs)
- [입력 검사 테스트](../../../test/stage9-input.test.mjs)
- [폭주 탐지 테스트](../../../test/stage9-burst.test.mjs)
- [반환 형식 테스트](../../../test/stage9-output.test.mjs)
- [기존 접근 판정기](../../../src/decider.mjs)
- [9단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/fb0c750daf43aa7d8537783de879f76290f93ab2)

재실행: `node --test test/stage9-input.test.mjs test/stage9-burst.test.mjs test/stage9-output.test.mjs`, `npm.cmd run detect:test`, `npm.cmd run decider:test`. 로컬 가상 시험 및 공식 심판 점수는 실제 세션 회수 API의 동작을 실측한 증거가 아닙니다.
