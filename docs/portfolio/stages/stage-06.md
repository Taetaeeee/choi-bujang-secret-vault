# 6단계 | 등록한 기기만 자료실 접근 허용

**기록 출처:** 6단계 제작 1~3의 실제 대화·PowerShell 실행 출력, [6단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/79a1bf7)  
**기록 상태:** 제작 1~3 수행 결과 확인. 공식 심판 제출 완료 및 100/100점 획득(사용자 보고).

## 과제 개요

기존 자료실의 로그인·메모 기능을 보존하면서, SDP 판정기 `src/decider.mjs`에 **등록된 기기의 자료실 읽기만 허용**하는 규칙을 추가했습니다. 기기 등록 사실은 학생 코드가 임의로 확인하는 것이 아니라 방어전 엔진이 검증해 전달하는 `deviceRegistered` 항목을 사용합니다.

## 제작 1 — 판정 요청 계약 확인

- **문제:** 기기 등록 규칙을 만들기 전에 판정기가 실제로 받는 사용자·기기 정보의 필드 이름을 확인해야 했습니다.
- **해결 방법:** `docs/DECIDER_REQUEST.md`에서 사용자 가명 식별자 `subjectId`, 기기 식별자 `deviceId`, 기기 등록 여부 `deviceRegistered`를 확인했습니다. 계약에 없는 `request.device`, `request.identity`, `request.role`은 사용하지 않기로 했습니다.
- **검증:** 요청 계약 문서의 항목과 대조했습니다. 제작 1에서는 판정기 코드를 변경하거나 인증서·CA·서명 키·개인키를 생성하지 않았습니다. 이 제작은 실행 시험이 아닌 계약 확인 단계입니다.

## 제작 2 — 기기 등록 판정 규칙 구현

- **문제:** 정상 로그인 여부와 별개로 미등록 기기 또는 등록 정보가 누락된 기기에서는 자료실 접근을 거부해야 했습니다.
- **해결 방법:** `src/decider.mjs`의 `RULE_IDS`에 `device_registered`를 추가했습니다. `request.deviceRegistered === true`이고 자료실 읽기(`service: notes`, `method: GET`, `route: GET /notes` 또는 `GET /notes/:id`)인 경우만 `allow / approved`를 반환하고, 미등록·누락 요청은 `deny / device_not_registered`로 거부하도록 구현했습니다. 기존 `starter.deny` 규칙은 유지했습니다.
- **검증:** `npm.cmd run decider:test`의 등록 기기 정상 요청과 미등록 기기 가상 요청 2건이 모두 `통과`했습니다. 나머지 요청은 기존 기본 거부 응답을 유지하도록 코드에서 확인했습니다.

## 제작 3 — 판정 결과 검증 및 확인 절차 문서화

- **문제:** 로컬 시험에서 등록 기기 허용과 미등록 기기 거부가 실제로 동작하는지 확인하고, 그 검증 절차를 재현할 수 있도록 남겨야 했습니다.
- **해결 방법:** `npm.cmd run decider:test`를 실행하고, `decide()` 반환값의 `decision`·`reasonCode`를 직접 출력해 확인하는 PowerShell 명령과 예상 결과를 루트 `README.md`에 기록했습니다. 별도의 접속 프로그램 설치나 키 발급은 하지 않았습니다.
- **검증:** 로컬 시험 2건이 모두 통과했습니다. 직접 실행한 명령에서 등록 기기 `allow / approved`, 미등록 기기 `deny / device_not_registered`가 출력되는 것을 확인했습니다.

## 최종 저장점 및 검증 범위

| 항목 | 확인 결과 |
|---|---|
| 저장점 커밋 | [`79a1bf7`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/79a1bf7) — `6단계 저장점` |
| `aleph.config.json` | `step: 6` 반영 |
| 판정기 로컬 시험 | 등록·미등록 가상 요청 2건 통과 |
| 기존 회귀 시험 | `test:r5` 2건 통과, `test:package` 3건 통과 |
| 제출 묶음 생성 | `npm.cmd run bundle` 성공, 단계 6 · 변경 파일 4개 · 판정 규칙 2개 · 직접 점검 기록 6개 |
| GitHub Push | `main`에 저장점 커밋 반영 확인 |
| Vercel 배포 | `/aleph.json`의 `step: 6`과 배포 커밋 `79a1bf7` 일치 확인 |
| 공식 심판 결과 | **100/100점** (2026-11-02, 사용자 보고) |

제출 묶음의 **직접 점검 6개는 기록 건수**입니다. 여섯 개 점검 결과가 모두 기대값과 일치한다는 사실까지 위 실행 요약만으로 입증되지는 않습니다.

## 공식 심판 평가 결과 (2026-11-02)

- **평가 대상:** 6단계 「등록한 기기만 자료실에 들어옵니다」
- **제출 결과:** 공식 심판 제출 완료
- **최종 점수:** **100 / 100점** (사용자 보고)
- **구현 내용:** `device_registered` 규칙을 적용하여 등록된 기기의 자료실 읽기 요청만 허용하고, 미등록 기기는 `deny / device_not_registered`로 거부하도록 구현했습니다.
- **검증:** 로컬 판정기 시험 2건 통과, 제출 묶음 생성 및 GitHub·Vercel 배포 커밋 일치를 확인했습니다.
- **구현 범위:** 별도 기기 등록 프로그램은 개발하지 않았으며, 심판의 세부 공격 로그는 확인하지 않았습니다.
## 구현 범위와 한계

- 이번 단계에서 구현한 것은 **엔진이 전달한 기기 등록 여부에 따른 판정 규칙**입니다. 실제 기기를 등록·승인하는 기능을 새로 구현한 것이 아닙니다.
- 실제 릴레이는 미등록 기기를 학생 판정기에 전달하기 전에 거부할 수 있습니다. 따라서 `deviceRegistered: false`에 대한 로컬 검증은 **가상 요청 시험**입니다.
- Vercel에 6단계 구현 커밋이 배포된 사실을 확인했고, 공식 심판에서 100/100점을 받았다고 사용자에게 전달받았습니다. 심판의 세부 공격 로그는 별도로 확인하지 않았습니다.
- 기존 브라우저 화면, 메모 API, 계정별 메모 접근 제어와 XDR 실습 구현은 이번 단계에서 변경하지 않았습니다.
- 공개 Git 저장소에 인증서·개인키·서버 전용 비밀값을 추가하지 않았습니다.

## 코드 및 재실행 근거

- [판정 요청·응답 계약](../../DECIDER_REQUEST.md)
- [기기 등록 판정기](../../../src/decider.mjs)
- [로컬 판정기 시험](../../../scripts/decider-test.mjs)
- [6단계 확인 순서가 포함된 루트 README](../../../README.md)
- [6단계 설정](../../../aleph.config.json)
- [제출용 자기 점검 코드](../../../src/attack-check.mjs)
- [6단계 저장점 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/79a1bf7)

로컬 재실행: `npm.cmd run decider:test`.

실제 반환값 확인:

```powershell
node --input-type=module -e "import { decide } from './src/decider.mjs'; import { fixtureRequests } from './scripts/fixture-7.mjs'; const { normal } = fixtureRequests(); for (const [name, input] of [['등록 기기', normal], ['미등록 기기', { ...normal, deviceRegistered: false }]]) { const result = await decide(input); console.log(name + ': ' + result.decision + ' / ' + result.reasonCode); }"
```

이 명령은 가상 요청 로컬 시험이며 공식 심판 판정의 증거가 아닙니다.
