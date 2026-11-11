# 18단계 | 케셰브 — 근거에 연결된 AI 보안 이벤트 설명

**기록 출처:** 사용자가 제공한 18단계 공식 과제 안내·ALEPH 평가 결과, 제출 커밋의 [학생 구현 코드](../../../on-client/student/extension.mjs), [공식 단계별 프롬프트](../../../on-client/docs/STUDENT_PROMPTS.md), 제공 [앱 UI](../../../on-client/public/app.js), 사용자 PowerShell 검증 로그. 아래 **코드 확인·모의 검사·실제 화면·공식 판정**은 서로 다른 근거로 취급합니다.

**공식 결과:** **2026-11-11 11:41(KST) 접수**, 필수 확인 **8/8 통과**(사용자가 공유한 ALEPH 판정 결과). 평가 대상은 [`2d2532c3bbd40dd9a4aa16809ec74acaff5b804b`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/2d2532c3bbd40dd9a4aa16809ec74acaff5b804b)입니다. **별도의 100/100점 점수는 확인되지 않았습니다.**

## 과제와 입력 계약

18단계의 목표는 AI 설명을 **선택한 보안 사건의 근거·탐지 규칙·현재 상태와 연결해 표시**하고, 없는 근거를 만들어 내지 않는 것입니다. AI 결과는 참고 정보이며 설명만으로 보안 조치가 실행되지는 않습니다.

- **수정 범위:** `on-client/student/extension.mjs`의 `renderExplanation({ event, explanation, checkedAt })`만 수정했습니다. 13~17단계 학생 함수·제공 서버·`public/app.js`·판정 코드·인증 설정은 변경하지 않았습니다.
- **사건:** `event`는 선택한 사건 또는 `null`; `event.id`, `event.evidence`의 `{id,text}`, `event.rules`의 `{id,text}`, `event.state.access/session/device`, `event.supportedActions`를 사용합니다.
- **AI 응답:** `explanation`은 `{status, mode, data?, error?}`이고, 성공 `data`는 `summary`, `evidenceIds`, `proposals:[{action,evidenceIds,reason}]`, `requiresHumanConfirmation:true`, `executed:false`를 가집니다.
- **제공 앱의 책임:** `validExplanation()`이 모든 근거 인용, 없는·중복 근거, 미지원 조치, 비밀 표기, 실행 주장 등을 확인합니다. 늦은 응답 취소·세대 검증과 학생 출력 영역 교체도 제공 앱이 담당합니다. 학생 함수는 전달받은 자료만 `createElement`·`textContent`로 표시하고 추가 API 호출이나 실행 버튼을 만들지 않습니다.
- **현재 연동 범위:** `supportedActions=[]`는 조치 지원이 없는 상태이므로 AI 제안 **0개가 정상**입니다. `unknown`은 확인 불가이며 안전 또는 정상으로 바꾸지 않습니다.

## 문제 → 해결 방법

1. **오류 우선 처리:** 기존에는 `event=null` 여부를 먼저 확인해 AI 요청 오류를 가릴 수 있었습니다. `explanation.status === 'error'`를 먼저 처리하도록 변경해 안전한 오류 코드·메시지, 근거 부족·불일치 또는 응답 형식 문제, 원래 기록 유지 안내를 표시합니다. 오류가 없고 사건도 없을 때만 기록 선택을 안내합니다. `loading`은 별도로 표시합니다.
2. **성공 조건과 사건 연결:** 정상 설명을 확인한 뒤에만 바깥 DOM 요소에 `data-student-explanation-event=event.id`를 설정하고 사건 ID와 `AI 사건 설명(참고용)` 요약을 표시합니다. 실패·미요청·근거 불일치에는 성공 속성을 설정하지 않습니다.
3. **근거·규칙 연결:** `explanation.data.evidenceIds`를 현재 `event.evidence`와 ID로 대조하고, 인용한 **`근거 ID — 근거 원문`**을 표시합니다. 근거 누락·중복·다른 사건의 ID를 유효한 설명으로 취급하지 않습니다. `event.rules`도 **`규칙 ID — 규칙 원문`**으로 표시합니다.
4. **확인 불가와 미실행 제안:** `event.state`에서 `unknown`인 접속·세션·기기를 각각 **`확인 불가(unknown)`**으로 표시합니다. `proposals`가 비어 있으면 `supportedActions`에 따라 제안이 없는 이유를 안내하고, 제안이 있으면 조치·이유·인용 근거·사람 확인 필요·미실행을 표시합니다. `executed !== false`나 `requiresHumanConfirmation !== true`인 응답은 성공 처리하지 않습니다.
5. **이전 결과 제거:** 학생 함수는 매 호출마다 새 DOM을 반환합니다. 제공 앱은 사건 변경·새로고침·취소 시 기존 설명을 비우고 `explanationGeneration` 및 `generation`으로 늦은 응답을 무시하며 `setChildren()`으로 화면을 교체합니다. 제공 앱은 수정하지 않았습니다.

**검토 중 보완:** 처음에는 같은 조치 ID가 여러 번 제안되면 전체 응답을 거부하는 조건이 있었지만, 제공 앱 `validExplanation()`의 공식 허용 조건보다 과도하다는 점을 발견했습니다. **계약에 없는 추가 차단 조건을 제거**하고 최종 커밋에 반영했습니다. 근거 ID 중복 및 미지원 조치 검사는 유지했습니다.

## 검증 — 코드·로컬·공식 결과 구분

| 범위 | 실제 확인한 내용 | 판단 |
|---|---|---|
| 제출 코드 범위 | 사용자 `git diff`에서 `renderExplanation`만 변경. 최종 커밋에 **1개 파일, 115줄 추가·7줄 삭제** | Git 변경 기록 확인 |
| 문법·공백 | 사용자 PC에서 `node --check` 및 `git diff --check`, `git diff --cached --check` 오류 없음. LF→CRLF는 Windows 줄바꿈 경고 | 통과 |
| 로컬 회귀 검사 | 사용자 PC `node --test` 결과 **전체 121건, 통과 121건, 실패 0건** | 로컬 테스트 통과. 공식 18단계 항목과 별개 |
| 모의 DOM 검사 | 학습 과정에서 상태별·근거별 모의 검사 통과를 확인했다고 기록했으나, 실제 사건에 대한 유료 AI 응답은 사용하지 않음 | 모의 검사. 실제 앱 실행 증거 아님 |
| 늦은 응답 무효화 | 제공 `public/app.js`의 `explanationGeneration` 비교(1112행), 학생 출력 교체(1344행), 새로고침 초기화(1440행)를 사용자 PowerShell `Select-String`에서 확인 | **코드 존재 확인**. 실제 경합 상황 실행은 미확인 |
| GitHub 반영 | `git push origin main` 성공, `git status -sb`: `## main...origin/main`, `rev-parse HEAD`: `2d2532c3bbd40dd9a4aa16809ec74acaff5b804b`. GitHub 저장소 `main`과 일치 | 확인 |
| 실제 선택 사건 AI 설명 | 실제 SDP 사건 선택·근거가 붙은 AI 설명 성공 화면은 관측하지 않음. 유료 AI 호출을 반복하지 않음 | **미확인** |
| 실제 보안 조치 | 이번 단계에서 제안은 참고용이고 실행 버튼을 추가하지 않음. 원천 조치의 실행·효과를 시험하지 않음 | **미실행** |
| ALEPH 공식 평가 | **2026-11-11 11:41(KST) 접수**, 제출 커밋 `2d2532c3bbd4`, 아래 필수 확인 **8개 전부 통과**(사용자 제공 결과) | **8/8 통과** |

### 공식 필수 확인 항목

| 항목 | 결과 |
|---|---|
| `student-source-changed` | 통과 |
| `evidence_binding` | 통과 |
| `unknown_evidence` | 통과 |
| `insufficient_evidence` | 통과 |
| `wrong_event_rejected` | 통과 |
| `proposal_not_executed` | 통과 |
| `non_ai_regression` | 통과 |
| `explanation_refresh` | 통과 |

**해석상의 경계:** 공식 평가는 **제출된 커밋의 코드를 AI가 읽어 판단**한 결과이며 코드를 실행하지 않습니다. 따라서 공식 8/8 통과가 실제 사건의 AI 설명 생성, SDP 연결 성공, 운영 시스템의 보안 조치 실행, 실시간 화면 재현까지 증명하는 것은 아닙니다.

## 선택과 학습

- **학습자의 판단:** “AI 요청이 `ok`여도 현재 사건에 존재하지 않는 근거 ID를 인용했다면 어떻게 처리할까?”라는 질문에서 **B: 근거 불일치로 설명 확인 불가**를 선택했습니다. API의 정상 응답과 분석 결과의 신뢰성은 다르다는 점을 확인했습니다.
- **AI가 제안·수정한 내용:** 오류 우선 표시, 근거 ID·규칙 원문 바인딩, `unknown` 상태 및 조치 미실행 안내를 단계별로 구현했습니다. 계약에 없는 중복 조치 거부 조건을 제거하는 수정도 수행했습니다.
- **직접 확인한 내용:** PowerShell의 문법·diff·해시 및 변경 범위, 제공 UI의 초기화 코드, 회귀 테스트 121건, Git 스테이징·커밋·푸시 결과를 확인하고 공식 판정을 제출했습니다.
- **실무 연결:** 보안관제(SOC)·사고 대응(IR)에서 AI의 요약을 원본 로그 및 탐지 규칙과 교차 검증하고, **확인 불가·조치 제안·사람 승인·실제 실행**을 분리해야 오탐 판단과 실행 오인을 줄일 수 있습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** AI가 선택한 사건에 없는 근거를 인용하거나 과거 사건의 설명을 현재 사건에 표시하면 보안 담당자가 잘못 판단할 수 있었습니다.
- **해결:** `renderExplanation`에 사건별 근거 ID·원문·탐지 규칙·`unknown` 상태를 연결하고, 실패·근거 불일치·미실행 조치 제안을 분리했습니다. 제공 API의 공식 입력 계약에 맞춰 검증 조건을 보완했습니다.
- **검증:** JavaScript 문법·Git 변경 범위·공백 검사를 확인하고 **로컬 회귀 121/121 통과**, **2026-11-11 11:41 접수된 공식 필수 8/8 통과** 결과를 받았습니다. 실제 AI 사건 설명 성공 화면 및 SDP 연동은 **미확인**입니다.

## 재현 및 관련 자료

저장소 최상위 PowerShell에서 아래 **비용 없는 정적·로컬 검사**를 다시 수행할 수 있습니다.

```powershell
node --check .\on-client\student\extension.mjs
node --test
git show --stat 2d2532c3bbd40dd9a4aa16809ec74acaff5b804b
```

실제 보안 사건 설명의 화면 확인에는 별도 원천 시스템·AI 사용 권한이 필요할 수 있습니다. 확인되지 않은 연결을 임의로 성공 처리하거나 유료 AI 호출을 반복하지 않습니다.

- [18단계 평가 기준 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/2d2532c3bbd40dd9a4aa16809ec74acaff5b804b)
- [학생 구현 코드](../../../on-client/student/extension.mjs)
- [단계별 공식 과제 안내](../../../on-client/docs/STUDENT_PROMPTS.md)
- [제공 UI와 설명 요청·초기화 로직](../../../on-client/public/app.js)
- [17단계 포트폴리오](stage-17.md)

이 문서는 **18단계 공식 평가 통과 후 작성한 포트폴리오 문서**입니다. 이후 문서 전용 커밋을 공식 평가 기준 커밋과 혼동하지 않습니다.
