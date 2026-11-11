# 19단계 | 케셰브 — AI 조치 제안과 서버 접수·실제 효과 관측의 구분

**기록 출처:** 사용자가 제공한 19단계 공식 과제 안내·ALEPH 평가 결과, [19단계 학생 구현 코드](../../../on-client/student/extension.mjs), [공식 단계별 과제 안내](../../../on-client/docs/STUDENT_PROMPTS.md), 제공 [앱 UI](../../../on-client/public/app.js), 사용자 PowerShell 검증·Git 실행 로그. 코드 분석, 모의 DOM 검사, 로컬 테스트, 공식 AI 판정, 실제 운영 환경 관측은 서로 다른 근거로 구분합니다.

**공식 결과:** **2026-11-11 12:49(KST) 접수**, 필수 확인 **8/8 통과**(사용자가 제공한 ALEPH 판정 결과). 평가 대상 커밋은 [`4b87982bcaa0ce21b259b31f8d3a042fc8b355fe`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/4b87982bcaa0ce21b259b31f8d3a042fc8b355fe)입니다. **100/100점 등 별도의 수치 점수는 확인되지 않았습니다.**

## 과제와 입력 계약

**목표:** AI의 보안 조치 **제안**, 사용자의 **확인**, 서버의 **요청 접수(ACK)**, 연동 시스템의 **실제 효과 관측**을 서로 혼동하지 않도록 학생 화면에 표시하는 것입니다.

- **수정 범위:** `on-client/student/extension.mjs`의 `renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error })`만 구현했습니다. 기존 13~18단계 학생 함수와 제공 서버·`public/app.js`·판정 코드·인증 설정은 변경하지 않았습니다.
- **상태 계약:** `idle`, `loading`, `prepared`, `executing`, `pending`, `succeeded`, `denied`, `failed`, `unknown`, `error`, `expired` 등 11개 상태를 처리합니다.
- **현재 사건·대상 정보:** `event.id`, `event.evidence[].id`, `actionId`, `target.id`, `target.generation` 등 전달된 필드만 사용합니다.
- **서버 접수·관측 정보:** `receipt.requestId`, `receipt.receiptId`, `receipt.eventId`, `receipt.actionId`, `receipt.version`, `receipt.replayed`, `observation.observedAt`, `observation.effectApplied`를 전달받은 경우에 한해 검토·표시합니다.
- **책임 분리:** 제공 UI가 **「조치 준비」, 사람 확인, 서버 요청, 결과 재조회, 「조치 화면 취소」**를 담당합니다. 학생 함수는 `document.createElement`와 `textContent`만 사용해 상태를 표시하며, 실행 버튼·POST 요청·확인 티켓 발급/보관을 추가하지 않습니다.
- **현재 사용 가능 범위:** 실제 사건의 `supportedActions=[]`여서 조치 준비 버튼이 나오지 않는 것이 정상입니다. SDP 설정 `.json` 파일은 학생 제출에 필요하지 않습니다. 실제 학생 계정·SDP 집행기·효과 재조회 연동은 **미완료/미확인(UNV)**이며, 운영자 권한이나 집행기를 학생이 임의로 마련할 필요가 없습니다.

## 문제 → 해결 방법

1. **상태별 표현:** 기존 `renderAction`의 학생 구현 대기 문구를 11개 상태별 한국어 안내로 교체했습니다. `idle`은 미실행, `loading`은 준비·조회 중, `prepared`는 준비됨·미실행, `executing`은 서버 전송 중, `pending`은 서버 접수·처리 중으로 구분했습니다. `denied`/`failed`는 거절·실패 사유, `expired`는 확인 기한 만료와 재준비, `error`는 안전한 오류 코드·메시지를 안내합니다.
2. **ACK와 효과 분리:** `executing` 및 `pending`에는 **결과 미확인**을 명시합니다. 요청이 접수됐다는 ACK를 보안 조치의 실행 성공이나 실제 효과로 표시하지 않습니다. `receipt.replayed === true`인 경우에도 이전 접수 기록의 재사용이지 신규 집행 증거가 아니라고 안내합니다.
3. **효과 관측 조건:** **`status === 'succeeded' && observation?.effectApplied === true`**인 경우에만 `효과 확인(succeeded)`을 표시하고 `observedAt`, `effectApplied: true`, `receiptId`를 표시합니다. `succeeded`라는 상태만 있거나 `effectApplied`가 참이 아니면 **결과 불명(unknown)**으로 처리하며 연동 시스템 결과만 재조회하도록 안내합니다.
4. **현재 사건과 응답 연결:** 현재 `event.id`·`actionId`가 `receipt.eventId`·`receipt.actionId`와 맞지 않는 경우 이전/다른 사건의 응답을 현재 요청의 결과로 사용하지 않습니다. 전달된 사건·근거·대상·세대·요청·접수·버전 식별자만 글자로 표시하고, 확인 번호 등 입력에 없는 값은 만들지 않습니다. 검증된 현재 입력의 사건 ID·요청 ID를 각각 `data-student-action-event`, `data-student-action-request`에 표시합니다.
5. **이전 화면 초기화:** 학생 함수는 전달받은 상태마다 새로운 DOM을 반환합니다. 제공 앱의 기존 `clearAction()`과 `renderStudent('action')`가 새 입력·취소·사건 변경·다시 불러오기에서 이전 내용을 교체합니다. **「조치 화면 취소」는 이미 서버에 전달된 조치 효과를 되돌리는 기능이 아님**을 안내합니다.

## 검증 — 실행 범위와 근거 구분

| 검증 구분 | 실제 확인한 결과 | 판단 |
|---|---|---|
| 학생 코드 변경 범위 | 사용자 스테이징 출력에서 `on-client/student/extension.mjs` **1개 파일, 100줄 추가·1줄 삭제** | 변경 범위 확인 |
| 문법·공백 | 사용자 PC의 `node --check`, `git diff --check`, `git diff --cached --check` 오류 없음. LF→CRLF는 Windows 줄바꿈 경고 | 정적 검사 통과 |
| 단계별 모의 DOM | 조치 상태·효과·현재 요청 연결에 대한 **37/37 통과로 보고된 로컬 모의 검사**. 실제 서버 요청 아님 | 모의 검사 결과 (공식 채점 아님) |
| 전체 회귀 테스트 | 사용자 PC에서 `node --test` **121건 중 121건 통과, 실패 0건** | 기존 기능에 대한 로컬 회귀 검사 통과 |
| 화면 갱신과 서버 역할 | 제공 앱의 `clearAction`, `renderAction`, `renderStudent` 및 학생 함수의 새 DOM 생성 코드를 확인. 실제 늦은 응답·실제 서버 처리의 브라우저 재현은 수행하지 않음 | 코드 확인, 실측 미확인 |
| GitHub 반영 | 사용자 `git push origin main` 성공, `git status -sb`가 `## main...origin/main`, `rev-parse HEAD`가 `4b87982bcaa0ce21b259b31f8d3a042fc8b355fe` | GitHub 푸시·동기화 확인 |
| 실제 조치 준비·집행·효과 관측 | 현재 사건은 지원 조치가 없어 실제 집행 경로가 열리지 않음. 실제 SDP 연결·사람 승인·서버 처리·관측을 시험하지 않음 | **미실행/미확인(UNV)** |
| 공식 ALEPH 평가 | 사용자 제공 결과: **2026-11-11 12:49(KST) 접수, 필수 항목 8/8 통과** | **공식 코드 평가 통과** |

### 공식 필수 확인 항목

| 항목 | 공식 결과 |
|---|---|
| `student-source-changed` | 통과 |
| `proposal_execution_separation` | 통과 |
| `human_confirmation` | 통과 |
| `current_intent_binding` | 통과 |
| `observed_server_result` | 통과 |
| `duplicate_prevention` | 통과 |
| `unknown_not_success` | 통과 |
| `action_refresh` | 통과 |

**판정의 범위:** 공식 8/8 통과는 제출 커밋을 AI가 읽어 19단계 학습 계약을 충족한다고 판정한 것입니다. 공식 판정은 코드를 실행하지 않으며, 실제 SDP 대상의 정책 집행·중복 실행 방지의 운영 효과·서버 ACK나 조치 효과를 실측했다는 증거가 아닙니다.

## 선택과 학습

- **학습한 개념:** ACK(Acknowledgement)는 **요청을 받았다는 확인**이고, `observation.effectApplied === true`는 **실제 효과에 관한 별도의 관측 정보**입니다. 이를 하나의 성공 상태로 묶으면 접수 중인 조치를 이미 실행된 것으로 오판할 수 있습니다.
- **AI가 구현·제안한 내용:** `renderAction`의 상태별 문구, 결과 불명 처리, 대상·사건·조치 식별자 연결, 접수 ID/버전 표기, `replayed` 안내, 제공 UI의 실행 책임 분리 등을 구현하고 모의 입력으로 점검했습니다.
- **학습자가 직접 확인한 내용:** ZIP 수정본의 단계별 적용, SHA-256 기반 이전 버전 일치 확인, JavaScript 문법·Git diff 검사, 로컬 회귀 테스트 121/121, Git 스테이징·커밋·푸시, 공식 8/8 판정을 확인했습니다.
- **실무 연결:** 방화벽 차단, 세션 회수, 계정 잠금 등의 보안 운영에서는 **조치 요청 → 사람 승인 → 접수 → 처리 → 실제 효과 관측**을 서로 구분해야 합니다. 특히 타임아웃과 `unknown`을 효과 없음으로 간주하고 무작정 재집행하면 중복 조치 위험이 있으므로, 먼저 기존 요청의 결과만 조회해야 합니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** AI 조치 제안과 서버의 접수 ACK를 실제 보안 조치 완료로 오인하거나, 다른 사건의 접수 결과를 현재 요청의 성공으로 표시할 위험이 있었습니다.
- **해결:** `renderAction`에서 상태 11종을 구분하고, `succeeded`와 `effectApplied === true`를 동시에 충족할 때만 효과 확인을 표시했습니다. 사건·조치·대상·요청 식별자, 확인 기한, 중복 접수 표기를 연결하고 결과 불명 상태에는 재조회 안내를 제공했습니다.
- **검증:** JavaScript 문법·Git 변경 범위·공백 확인, **로컬 회귀 테스트 121/121 통과**, **2026-11-11 12:49 접수된 공식 필수 8/8 통과**를 확인했습니다. 실제 SDP 조치 집행과 효과 관측은 **미실행/미확인(UNV)**입니다.

## 재현 및 관련 자료

저장소 최상위의 PowerShell에서 아래 비용 없는 정적·로컬 검사를 수행할 수 있습니다.

```powershell
node --check .\on-client\student\extension.mjs
node --test
git show --stat 4b87982bcaa0ce21b259b31f8d3a042fc8b355fe
```

공식 과제의 실제 조치 집행 및 효과 관측은 현재 학생 환경에서 연결되지 않았습니다. 확인을 위해 **실제 집행 요청을 시험 삼아 보내거나** 운영자 권한·인증 티켓을 임의로 만들지 않습니다.

- [19단계 평가 기준 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/4b87982bcaa0ce21b259b31f8d3a042fc8b355fe)
- [학생 구현 코드](../../../on-client/student/extension.mjs)
- [19단계 공식 과제 안내](../../../on-client/docs/STUDENT_PROMPTS.md)
- [제공 앱의 조치 처리·상태 갱신 로직](../../../on-client/public/app.js)
- [18단계 포트폴리오](stage-18.md)

이 문서는 **19단계 공식 평가 통과 후 별도로 작성한 포트폴리오 기록**입니다. 문서 전용 커밋은 공식 제출·채점 대상인 `4b87982bcaa0ce21b259b31f8d3a042fc8b355fe`와 구분합니다.
