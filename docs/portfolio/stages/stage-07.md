# 7단계 | 평소와 다른 접속은 다시 확인합니다

**출처:** 제작 1~3 대화 및 사용자 PowerShell 실행 결과, [7단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/706c34a)
**상태:** 제작 1~3 검증 완료 · 2026-11-03 공식 심판 **100/100점** (사용자 제공 결과)

## 과제 개요

6단계의 등록 기기 접근 규칙을 유지하면서 엔진에서 전달한 가상 접속 정보의 출처를 점검하고, 평소와 다른 시각·네트워크·최근 위험 사건이 함께 확인되면 추가 인증(`step_up`)을 요청했습니다. 지역 하나만으로 영구 차단하지 않습니다.

## 제작 1 — 접속 정보 출처 구분

- **문제:** 출처가 불확실하거나 누락된 접속 정보가 정상 접속으로 처리되거나 클라이언트 헤더를 신뢰할 위험이 있었음.
- **해결 방법:** `inspectAccessContext()`로 `signals.source`와 `recentEvents`의 형식을 검사함. `none`은 관측 정보 없음, `judge_fixture`는 가상 사건, 그 외 불명확한 출처는 무효로 구분하고 임의의 정상값을 채우지 않음.
- **검증:** `decider:test`의 기존 등록·미등록 기기 2건 통과. `source: client`와 위조 헤더를 포함한 로컬 가상 요청은 `deny / starter_not_ready`로 판정함. 실제 엔진의 헤더 방어는 미실측.

## 제작 2 — 복합 이상 접속 판정

- **문제:** 등록된 기기라도 비정상 시간, 낯선 네트워크, 최근 위험 사건이 함께 발생하면 추가로 본인을 확인할 필요가 있었음.
- **해결 방법:** 가상 접속에서 0~5시, `network: unusual`, 최근 300초 이내 `risk_signal.count` 10 이상이 모두 성립하면 `step_up / step_up_required`를 반환. 기존 `device_registered` 규칙과 정상 접근은 유지하고 지역 단독 차단은 적용하지 않음.
- **검증:** `decider:test` 4건 통과, `fixture:7`에서 정상 `allow`, 복합 이상 `step_up` 확인. `risk_signal.count`는 실습용 위험 사건 횟수이지 실제 자료 열람 건수가 아님.

## 제작 3 — 추가 인증 전후 가상 검증

- **문제:** 엔진의 재인증 정보를 사용해 추가 확인 전후에 판정이 달라지는지 확인해야 했음.
- **해결 방법:** `docs/DECIDER_REQUEST.md`의 `stepUp.verified`와 `stepUp.authAgeSeconds`를 확인하고 기존 판정기를 가상 요청으로 검증함. 실제 로그인·자료실 API 연동 코드는 추가하지 않음.
- **검증:** 사용자 로컬 시험에서 인증 확인 전 `step_up / step_up_required`, 확인 정보 60초 `allow / approved`, 301초 경과 `step_up / step_up_required` 확인. 실제 동일 계정 재로그인 및 운영 자료 차단은 **미실행**.

## 최종 저장점 및 시험 결과

| 항목 | 결과 |
|---|---|
| 저장점 커밋 | [`706c34a`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/706c34a) — `7단계 저장점` |
| 변경 파일 | `README.md`, `aleph.config.json`, `src/attack-check.mjs`, `src/decider.mjs` |
| 기존 회귀 시험 | `test:r5` 2건, `test:package` 3건 통과 |
| 7단계 가상 시험 | `decider:test` 4건 통과, `fixture:7` 정상 `allow`·복합 이상 `step_up` |
| 로컬 빌드 | `npm.cmd run build -- --local` 성공 |
| 새 Clone 후 설치 | `npm.cmd install` 성공 (실행 출력: 취약점 0건), `decider:test`·`fixture:7` 재통과 |
| 제출 묶음 | `npm.cmd run bundle` 성공 · 단계 7 · 커밋 `706c34ac5bcd` · 변경 4개 · 규칙 3개 · 점검 기록 8개 |
| 운영 배포 | `/aleph.json`의 단계 7, 배포 커밋이 저장점 커밋과 일치함을 사용자가 확인 |
| 공식 심판 결과 | **100/100점** · 조건 7개 확인 · 완결성 가점 3개 (2026-11-03 사용자 제공 결과) |

제출 묶음의 점검 **기록 8개**는 전 항목이 기대값대로 성공했다는 뜻이 아닙니다. 심판의 세부 공격 로그는 별도로 확인되지 않았습니다.

## 본인 결정·아이디어·학습

- **결정:** 지역 단일 신호로 차단하지 않고 시간·네트워크·최근 위험 사건을 결합한 추가 인증 방식 적용. 입력 출처를 우선 확인하고 불명확한 값을 정상이라고 추정하지 않음.
- **임계값:** 0~5시 / 300초 내 10회는 가상 사건에 맞춰 제안받아 적용한 실습 기준임. 실제 사용자 행동 분석으로 산정한 기준은 아님.
- **개별 아이디어:** 공식 과제 외에 별도 독자 기능을 추가한 사실은 확인되지 않아 기재하지 않음.
- **배운 개념:** 신뢰 경계, 위험 기반 추가 인증, `deny`와 `step_up`의 차이, 로컬 가상 결과와 운영 접근 제어 검증의 차이.

## 구현 범위와 한계

`judge_fixture`는 운영 사용자 위치의 증거가 아니고 실제 경로의 `signals.source: none`은 접속 맥락 미제공 상태입니다. 제공 엔진의 재인증 필드를 가상 시험에 사용했지만, **운영 자료실에서 추가 확인 전 실제 자료 제공을 차단했는지 및 같은 사용자로 다시 로그인했는지는 실측하지 않았습니다.** 토큰·비밀키·메모 본문은 기록하지 않았습니다. 공식 심판 100점과 운영 연동 실측은 구분합니다.

## 코드와 재실행 근거

- [판정기](../../../src/decider.mjs)
- [판정 요청 계약](../../DECIDER_REQUEST.md)
- [가상 요청 생성기](../../../scripts/fixture-7.mjs)
- [로컬 판정기 시험](../../../scripts/decider-test.mjs)
- [직접 점검 코드](../../../src/attack-check.mjs)
- [7단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/706c34a)

재실행: `npm.cmd run decider:test`, `npm.cmd run fixture:7`. 로컬 시험 성공은 실제 재로그인 및 운영 자료 차단의 증거가 아닙니다.
