# 14단계 | 케셰브 — 업무 앱 접근 판정·사유·시각 표시

**기록 출처:** 사용자가 제공한 14단계 공식 과제 안내·공식 판정, [`on-client/student/extension.mjs`](../../../on-client/student/extension.mjs)의 구현, 제공 UI의 [`on-client/public/app.js`](../../../on-client/public/app.js) 입력 연결, 사용자 PowerShell·브라우저 점검 결과.

**기록 상태:** 2026-11-09 12:47(KST) 공식 **필수 확인 항목 5/5 통과**. 판정 기준 커밋 [`025d93d1f58d`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/025d93d1f58ddd5f8693781889cd945f8ba4bf0f). **별도 점수 100/100점은 확인되지 않았습니다.**

## 과제와 목표

직원이 **업무 앱 한 개**에 접근을 요청할 때 서버가 반환한 정책 판정, 판정 이유, 판정 시각을 보여 주는 학생 화면을 구현했습니다. 특히 **접근 거부(`deny`)**, **판정 확인 불가(`unknown`)**, **요청 실패(`error`)**는 서로 다른 상태이며, 이를 허용이나 같은 실패 원인으로 표현하지 않는 것이 목표였습니다. 전체 앱 권한을 열거하거나 정책을 결정하는 단계는 아닙니다.

## 문제 → 해결 방법

- **문제:** 요청 전·진행 중·서버 응답·요청 실패가 섞이거나, 알 수 없는 판정이 허용처럼 보이면 사용자에게 잘못된 접근 상태를 전달할 수 있습니다. 실패한 요청을 서버의 정책상 거부로 오해해서도 안 됩니다.
- **입력 계약:** `renderDecision({ status, mode, data?, error?, appId })`에서 `status`는 `idle / loading / ok / error`, 정상 응답 `data`는 `{ appId, decision, reason, checkedAt }`입니다. 기존 `public/app.js`가 앱별 접속 버튼으로 `POST /api/access`를 호출하고 해당 결과를 `renderDecision`에 전달합니다.
- **수정 범위:** 기존 `renderIdentity`를 포함한 다른 학생 함수, 제공 서버, `public/app.js`, 판정·인증 설정은 변경하지 않고 **`on-client/student/extension.mjs`의 `renderDecision`만 구현**했습니다. `document.createElement`와 `textContent`로 DOM 요소 하나를 반환하며 `innerHTML`은 사용하지 않았습니다.
- **상태 처리:** `idle`은 `앱을 골라 접속을 요청하세요.`, `loading`은 `판정 확인 중`, `error`는 `요청 실패: {error.message}`와 함께 **정책상 접근 거부가 아님**을 표시합니다. 오류·요청 중 상태에 이전 성공 판정을 남기지 않습니다.
- **판정 표시:** `allow`는 `접근 허용(allow)`, `deny`는 `접근 거부(deny)`, `challenge`는 `추가 확인 필요(challenge)`, `unknown` 및 목록 외 값은 `판정 확인 불가(unknown)`으로 안내합니다. `reason`과 `checkedAt`을 함께 출력하고, 결측 항목은 `확인 불가`로 표시합니다.
- **범위 제한:** `allow`는 정책상 허용이지 **실제 업무 앱 접속 성공**을 의미하지 않습니다. `challenge`는 앱이 추가 인증을 **대신 수행한다는 뜻이 아닙니다**. 개별 선택 앱의 결과만 표시합니다.

## 검증 — 코드·모의 시험·실제 화면·공식 평가 구분

| 확인 범위 | 관찰 결과와 근거 | 판단 |
|---|---|---|
| Git 수정 범위 | 사용자 `git diff --cached --name-only` 및 커밋 출력: `on-client/student/extension.mjs` 1개, 78줄 추가·1줄 삭제 | 확인 |
| Node.js 문법·공백 검사 | 사용자 PC `node --check`, `git diff --check`, `git diff --cached --check`가 오류 없이 종료. LF/CRLF 경고 출력 | 통과 |
| 함수 상태 분기 | 제출 커밋 소스에서 `idle / loading / ok / error`, 판정 네 값과 `reason / checkedAt` 출력 확인 | 코드 검토 |
| 상태별 모의 시험 | 구현 과정에서 16/16 통과로 보고되었으나, 이 문서 작성 시 테스트 재실행은 하지 않음 | 보고된 모의 결과 |
| 실제 브라우저 초기 화면 | 사용자 제공 화면에서 `업무 앱` 탭과 학생 구현 영역의 `앱을 골라 접속을 요청하세요` 문구 확인 | 확인 |
| 실제 업무 앱 접근 요청 | 기존 서버·에이전트 연결 실패로 앱 목록과 선택 버튼이 나타나지 않음 | **미확인** |
| 실제 계정 판정·사유·시각 | 서버가 실제 판정 데이터를 반환하지 않아 직접 관찰 불가. 정책·인증을 바꿔 네 판정을 억지로 만들지 않음 | **미확인** |
| GitHub 반영 | `main` Push 후 `git status -sb`가 `## main...origin/main`, 커밋 `025d93d1f58ddd5f8693781889cd945f8ba4bf0f` | 확인 |
| ALEPH 공식 판정 | 사용자 제공 2026-11-09 12:47 접수 결과: 아래 5개 필수 항목 모두 통과 | **5/5 통과** |

### 공식 필수 항목

| 필수 확인 항목 | 공식 결과 |
|---|---|
| `student-source-changed` | 통과 |
| `server-decisions-distinct` | 통과 |
| `decision-reason-visible` | 통과 |
| `unknown-not-allow` | 통과 |
| `failure-not-allow` | 통과 |

공식 판정은 **제출한 GitHub 커밋의 학생 코드에 대한 평가**이며, 연결되지 않은 로컬 화면에서 모든 접근 판정을 실제로 관찰했다는 뜻이 아닙니다.

## 선택과 학습

접근 제어 정책 결과와 통신·조회 실패를 분리해 사용자에게 보여 주는 데 집중했습니다. `unknown`이나 예기치 않은 판정 코드를 **접근 허용으로 승격하지 않음**으로써 상태 화면의 신뢰성을 높였고, 원래 영문 판정 코드를 병기해 개발·운영자가 서버 응답과 쉽게 대조하도록 했습니다. 기존 UI의 앱 선택 버튼과 결과 갱신 흐름은 제공 코드를 그대로 사용했습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** 업무 앱의 정책상 허용·거부·추가 확인·판정 불명과 서버 요청 실패를 정확히 구분해야 했습니다.
- **해결:** `renderDecision` 하나에 요청 상태별 메시지, 판정 코드·한국어 명칭, 판정 이유·시각, 실패 시 비허용 안내를 구현했습니다.
- **검증:** 로컬 문법·Git 범위 검사와 미연결 브라우저 안내를 확인하고, **2026-11-09 12:47 공식 필수 확인 항목 5/5 통과**를 받았습니다. 실제 연결된 계정의 접근 판정은 미확인입니다.

## 재현 및 관련 파일

저장소 루트 기준:

```powershell
node --check .\on-client\student\extension.mjs
git diff --check
```

로컬 앱 실행(별도 PowerShell):

```powershell
cd .\on-client
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
```

`http://127.0.0.1:5189/`의 `업무 앱` 메뉴에서 **실제 연결이 있을 때** 앱 하나를 선택하고 `접속 요청` 결과의 판정·사유·시각을 확인합니다. 기존 서버 연결이 없으면 실제 판정은 미확인으로 남깁니다.

- [학생 구현 코드](../../../on-client/student/extension.mjs)
- [14단계 공식 프롬프트가 포함된 학생 안내](../../../on-client/docs/STUDENT_PROMPTS.md)
- [제공 UI의 업무 앱 요청 처리](../../../on-client/public/app.js)
- [14단계 평가 기준 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/025d93d1f58ddd5f8693781889cd945f8ba4bf0f)

이 문서는 **공식 통과 이후 작성한 포트폴리오 기록**이므로 문서만 추가한 이후의 커밋을 14단계 공식 평가 커밋으로 오인하지 않습니다.
