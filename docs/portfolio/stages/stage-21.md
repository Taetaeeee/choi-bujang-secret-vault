# 21단계 | 케셰브 — 다른 사람이 재현할 수 있는 실행 설명서와 시스템 구성도

**기록 출처:** 사용자가 제공한 21단계 공식 안내·ALEPH 평가 결과, [21단계 제출 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/ede8ed9818765bc2e82cb3d875a7a2072c795ae7)에 새로 추가한 [`on-client/docs/STUDENT_RUNBOOK.md`](../../../on-client/docs/STUDENT_RUNBOOK.md), 제공 `on-client/README.md`·`on-client/docs/STUDENT_LAUNCH_GUIDE.md`·`on-client/docs/STUDENT_PROMPTS.md`, `on-client/tools/start-alekov.ps1`, `on-client/package.json`, 제공 UI·서버 코드, 사용자 PowerShell 실행·정적 검사 출력과 브라우저 캡처. **소스 대조, 실제 PC 재현, 과거 단계 회귀 테스트, 공식 AI 판정을 구분**합니다.

**공식 결과:** **2026-11-11 15:39(KST) 접수**, 필수 항목 **6/6 통과**(사용자가 제공한 ALEPH 판정 결과). 평가 대상 커밋은 [`ede8ed9818765bc2e82cb3d875a7a2072c795ae7`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/ede8ed9818765bc2e82cb3d875a7a2072c795ae7)입니다. **별도의 100점 만점 점수는 확인되지 않았습니다.**

## 과제 목표와 변경 범위

**목표:** 새로운 작업자가 실제 작업 위치·실행 명령·구성 요소·오류 확인 순서를 따라 케셰브 로컬 앱을 실행하고, **작동을 확인한 부분과 확인하지 못한 외부 연동을 구분**할 수 있도록 만드는 것입니다.

- **학생 신규 문서:** `on-client/docs/STUDENT_RUNBOOK.md`를 생성했습니다(제출 커밋 기준 **1개 파일, 285줄 추가**). 기존 제공 문서 및 13~20단계 `on-client/student/extension.mjs`의 구현은 변경하지 않았습니다.
- **문서 범위:** 목적과 실행 환경, Git 저장소 최상위와 `on-client`의 작업 위치 구별, 필요 파일·실제 PowerShell 명령·로컬 브라우저 주소, 시작·종료·재실행, Mermaid와 텍스트 구성도, 학생 함수·제공 코드 경계, 장애별 확인·복구 순서, 확인/미확인 상태.
- **검증 대상의 경계:** 공식 21단계는 제출된 문서·구성도와 실제 소스·설정 견본의 **일치성에 대한 AI 판정**입니다. 서버가 문서의 PowerShell 명령을 실제 실행했다고 주장하지 않습니다. 실행 검증은 아래 **사용자 PC에서 별도로 수행한 기록**입니다.
- **보안 경계:** 토큰·비밀번호·API 키·개인 인증서·외부 비밀 설정 내용은 문서에 포함하지 않았습니다. 제공 `src/server.mjs`, `public/app.js`, 판정 코드와 인증 설정은 수정하지 않았습니다.

## 문제 → 해결 방법

1. **실행 위치 혼동 해소:** Git 작업과 커밋은 저장소 최상위에서, 케셰브 실행 명령은 `on-client`에서 수행하도록 구분했습니다. 실제 경로인 `tools/start-alekov.ps1`, `src/server.mjs`, `public/index.html`, `student/extension.mjs` 등의 역할을 설명했습니다.
2. **지원 버전과 실측 버전 분리:** 앱 시작 틀 `package.json` 버전은 **`0.2.21`**, 실행 스크립트가 허용하는 Node.js 메이저 버전은 **22~24**, 수업 기준 버전은 **24.19.0**입니다. **이 학습자 PC 실측:** Node.js **`v24.22.1`**, Windows PowerShell **`5.1.26100.9711`**. 수업 기준 버전을 실제 설치 버전으로 기록하지 않았습니다.
3. **실제로 재현한 실행 명령 기재:** `on-client`에서 `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost -Port 5190`을 실행했습니다. 기본 포트 `5189`는 이미 사용 중이었으므로 기존 프로세스를 종료하지 않고 공식 지원 옵션 `-Port 5190`을 사용했습니다. 브라우저 주소는 `http://127.0.0.1:5190/`입니다. 정상 시작 시 출력한 **「케셰브가 켜졌습니다」**와 **「서버가 응답한 것만 확인했습니다」**를 그대로 구분했습니다.
4. **실제 시스템 구성도:** 브라우저(`public/index.html`, `public/app.js`) → 로컬 HTTP 서버(`src/server.mjs`, `127.0.0.1`) → 조건부 기존 접근제어·XDR/SDP 연결(`student/engine-adapter.mjs`, `src/engine/sdp-host.mjs`) 또는 조건부 AI 게이트(`src/ai/service.mjs`)를 **Mermaid·ASCII·서술 텍스트**로 설명했습니다. 실제 확인하지 못한 외부 서버 주소나 연결 성공을 만들지 않았습니다. 로컬 `/api/events`, `/api/access`, `/api/ai/check`, `/api/vulnerabilities`의 역할도 제공 코드와 대조했습니다.
5. **제공/학생 작성 경계:** 제공 `public/app.js`가 요청·취소·상태 관리·학생 함수 호출을, 학생 `extension.mjs`의 `renderIdentity`, `renderDecision`, `renderEvents`, `renderStatus`, `renderAiConnection`, `renderExplanation`, `renderAction`, `renderVulnerabilities` **8개 함수**가 결과 **표시**를 담당한다고 명시했습니다. 학생 화면이 인증·실제 보안 조치·AI 추론을 직접 실행한다고 서술하지 않았습니다.
6. **장애 및 지원 범위:** `ENGINE_NOT_CONNECTED`, `ON_AI_PROVISIONING_PENDING`, `PROJECT_NOT_CONFIGURED`/`not_configured`, `error`, `unverifiable` 등의 의미·확인 순서를 표로 정리했습니다. 미조회·연결 없음·결과 불명은 안전/성공 판정으로 바꾸지 않았고, **실제 재현한 오류와 소스에서만 확인한 오류**를 구분했습니다.

## 검증 — 소스 대조, 실제 실행, 공식 판정의 분리

| 구분 | 수행·확인한 사실 | 판정 범위 |
|---|---|---|
| 신규 문서 단계별 적용 | 새 문서를 1~5번 수정본으로 순차 적용했고, 최종 학생 PC SHA-256은 `a410747c4a3772e338e25aa0f0e448de608a5840dc88c2d6a5e70c1413d5f8ae`로 예상값과 일치 | **파일 적용 확인** |
| 파일·화면 문구 정적 대조 | 사용자 PowerShell `Test-Path` 결과 실제 파일 경로 **13/13 True**. `public/index.html`의 메뉴·버튼 문구 `Select-String` **8/8 True** | **정적 확인**. 모든 버튼 동작 실측 아님 |
| 실제 실행 환경 | 새 PowerShell 창에서 실제 `on-client` 폴더 확인, `node --version` = **`v24.22.1`**, `$PSVersionTable.PSVersion` = **`5.1.26100.9711`**, 핵심 실행 파일 3개 존재 확인 | **사용자 PC 실측** |
| 기본 포트 충돌 | `-NoNativeHost` 기본 실행 시 **「포트 5189 를 다른 프로그램이 쓰고 있습니다」** 확인. 기존 프로그램은 종료하지 않음 | **오류 안내 실제 재현** |
| 5190 시작 | `-NoNativeHost -Port 5190`으로 **「케셰브 연결 확인」**, 시작 URL 및 HTTP 응답 확인 메시지 출력 | **사용자 PC 로컬 서버 시작 확인**. 외부 SDP·AI 연결 성공 아님 |
| 실제 브라우저 | 사용자가 `http://127.0.0.1:5190/`에서 케셰브 제목·로고·「보호 현황」·「업무 앱」·「보안 기록」 메뉴가 보이는 화면 캡처 제공 | **브라우저 기본 화면 실측** |
| 종료 | 실행 창의 `Ctrl+C` 후 `Test-NetConnection 127.0.0.1 -Port 5190 -InformationLevel Quiet` → `False` (연결 실패 경고 포함) | **해당 포트에서 연결을 받지 않음 확인** |
| 재실행 | 같은 폴더·명령으로 `5190` 시작 메시지와 HTTP 확인 메시지가 다시 출력됨 | **서버 재시작 확인**. 재실행 후 브라우저 재접속은 별도 미확인 |
| Git 변경 범위 | `git diff --cached --check` 오류 없음. 제출 커밋에서 **`on-client/docs/STUDENT_RUNBOOK.md` 1개, 285줄 추가**. GitHub 푸시 후 `## main...origin/main` 확인 | **문서만 수정·원격 동기화 확인** |
| 과거 로컬 회귀 검사 | 20단계 때 사용자 PC에서 `node --test` **121/121 통과**를 확인함 | **이전 단계의 회귀 테스트 결과**. 21단계에서 새로 재실행했다고 기록하지 않음 |
| ALEPH 공식 검토 | 사용자 제공 결과: **2026-11-11 15:39(KST) 접수**, 아래 공식 필수 항목 6개 모두 통과 | **공식 AI 문서·소스 일치성 평가 통과** |

### 공식 필수 확인 항목

| 항목 | 공식 결과 |
|---|---|
| `documentation_scope` | 통과 |
| `run_instructions_match_source` | 통과 |
| `architecture_matches_source` | 통과 |
| `provided_student_boundary` | 통과 |
| `failure_guide_matches_source` | 통과 |
| `support_scope_honest` | 통과 |

**판정 해석:** 공식 **6/6 통과**는 제출 커밋의 문서·실행 코드·구성도·지원 범위가 단계 계약에 부합한다는 AI 검토 결과입니다. 실제 운영 SDP 신원 확인·XDR 사건 수집·AI 모델 호출·보안 조치 집행·OSV 패키지 조회가 성공했다는 증거가 **아닙니다**.

## 미확인(UNV) 및 작업 경계

- **외부 연동:** 운영 SDP/접근제어·XDR 원천 연동, 실제 학생 계정·기기 승인, CLCO 앱 AI 승인·모델 점검·실제 사건 설명 생성은 직접 실측하지 않았습니다.
- **실제 집행:** 19단계의 정책·보안 조치 실행 및 `observation.effectApplied` 실효 검증은 직접 수행하지 않았습니다.
- **실제 공개 취약점 조회:** 20단계는 `PROJECT_NOT_CONFIGURED` 및 `not_configured` 화면과 재조회 HTTP 200을 관측했습니다. 실제 설치 패키지별 OSV 결과·버전 대조·취소 경합은 직접 실측하지 않았습니다.
- **21단계 검사의 한계:** 화면 문구 8개는 소스에 있는지 확인했으나 각 버튼의 실제 사용자 동작은 모두 눌러 보지 않았습니다. 실행한 5190 서버를 재시작한 뒤 같은 화면이 다시 나타나는지 브라우저 재접속까지 확인하지 않았습니다. 새 PC·운영 환경·설치형 전체 앱에서의 재현 역시 이 단계에선 수행하지 않았습니다.

## 선택과 학습

- **문서 설계:** 빠른 시작 안내를 단순히 복사하지 않고, 실제 파일 경로·명령·정상 시작 신호·종료 방법·구성도·오류 코드·검증 근거를 한 문서에서 교차 확인할 수 있도록 했습니다.
- **학습자가 직접 확인한 내용:** SHA-256을 확인하며 단계별 수정본 적용, 새 PowerShell에서 설치 버전·실행 위치 검증, 5189 포트 충돌 → 5190 대체 실행, 브라우저 캡처, `Ctrl+C` 종료·TCP 연결 실패, 재실행, 13개 경로·8개 문구 대조, Git 커밋·푸시와 공식 판정을 확인했습니다.
- **AI가 도운 내용:** 실제 코드를 바탕으로 학생 설명서 초안·Mermaid/ASCII 구성도·기능과 제공 코드 경계·장애 안내·검증 범위 표를 구조화했습니다. AI가 직접 사용자 PC에서 실행했다고 주장하지 않습니다.
- **실무 연결:** 온보딩·운영 인수인계 문서는 실행 절차뿐 아니라 **무엇을 관측하면 정상인지**, **어떤 실패를 어떻게 분류하는지**, **어떤 시스템이 연결되지 않았는지**를 기록해야 다른 사람이 미확인 상태를 정상으로 오해하지 않습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** 기존 보안 Agent는 학생·제공 코드, 로컬 앱과 외부 SDP/AI 연동, 실행 기준 버전과 실제 설치 버전의 구분이 없으면 새 사용자가 설치·실행 결과를 오해할 수 있습니다.
- **해결:** 새 `STUDENT_RUNBOOK.md`에 실행 위치·명령·버전·구성도·8개 학생 함수와 제공 코드 경계·오류 확인 순서·미확인 기능을 기록하고, 기존 코드와 제공 문서는 변경하지 않았습니다.
- **검증:** 사용자 PC에서 **파일 경로 13/13·문구 8/8**, Node.js **`v24.22.1`**, 5190 포트 **실행·화면·종료·재실행**, 공식 **2026-11-11 15:39 접수 필수 항목 6/6 통과**를 확인했습니다. 운영 SDP·AI·OSV·실제 조치 집행은 **미확인(UNV)**입니다.

## 재현과 관련 자료

**PowerShell 작업 위치:** 학생 PC의 프로젝트 `on-client` 폴더. 아래는 **실제로 실행한** 로컬 서버 명령입니다. `-NoNativeHost`는 승인·연동을 대신하지 않는 로컬 확인용 옵션입니다.

```powershell
$repo = "$HOME\Projects\choi-bujang-secret-vault"
Set-Location "$repo\on-client"
node --version
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost -Port 5190
```

위 명령으로 서버가 실행 중이라면 브라우저에서 `http://127.0.0.1:5190/`를 열 수 있습니다. 실행 창에서 `Ctrl+C`로 종료한 뒤, **별도 PowerShell**에서 다음 명령으로 해당 포트가 연결을 받지 않는지 확인할 수 있습니다.

```powershell
Test-NetConnection 127.0.0.1 -Port 5190 -InformationLevel Quiet
```

- [21단계 공식 평가 대상 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/ede8ed9818765bc2e82cb3d875a7a2072c795ae7)
- [21단계 학생 실행 설명서 및 시스템 구성도](../../../on-client/docs/STUDENT_RUNBOOK.md)
- [공식 실행 가이드](../../../on-client/docs/STUDENT_LAUNCH_GUIDE.md)
- [공식 단계별 과제 안내](../../../on-client/docs/STUDENT_PROMPTS.md)
- [앱 시작 PowerShell 스크립트](../../../on-client/tools/start-alekov.ps1)
- [제공 브라우저 UI](../../../on-client/public/app.js) / [제공 서버](../../../on-client/src/server.mjs) / [학생 화면](../../../on-client/student/extension.mjs)
- [20단계 포트폴리오](stage-20.md)

이 기록은 **21단계 공식 평가 통과 후 별도로 작성한 포트폴리오**입니다. 이후 문서 전용 커밋은 21단계 공식 판정 대상인 `ede8ed9818765bc2e82cb3d875a7a2072c795ae7`과 구분합니다.
