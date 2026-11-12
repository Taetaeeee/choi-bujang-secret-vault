# 22단계 | 케셰브 — 최종 커밋의 새 환경 재현과 릴리스 인수인계

**기록 출처:** 사용자가 공유한 22단계 공식 과제 안내·ALEPH 평가 결과, [22단계 제출 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/0053986ca310b608e1bfd0d9275af940baf69f0d)의 [`on-client/docs/STUDENT_RELEASE_RECORD.md`](../../../on-client/docs/STUDENT_RELEASE_RECORD.md), 이전 [21단계 실행 설명서](../../../on-client/docs/STUDENT_RUNBOOK.md), 제공 `on-client/package.json`·`tools/start-alekov.ps1`·`docs/STUDENT_PROMPTS.md`와 루트 `README.md`, 사용자 PC의 Git/PowerShell 출력 및 브라우저 화면 캡처. **소스 대조·학생 직접 재현·기존 단계 공식 판정·22단계 공식 AI 판정을 분리**합니다.

**공식 결과:** **2026-11-11 17:19(KST) 접수**, 필수 확인 **6/6 통과**(사용자가 제공한 ALEPH 판정 결과). 평가 대상은 [`0053986ca310b608e1bfd0d9275af940baf69f0d`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/0053986ca310b608e1bfd0d9275af940baf69f0d)입니다. **별도의 100점 만점 점수와 운영 서비스 인증은 확인되지 않았습니다.**

## 과제 목표와 변경 범위

- **목표:** 기존 작업 폴더·이력을 보존한 채 공개 GitHub 저장소를 **새 빈 폴더에 복제**하고, 같은 커밋을 기준으로 런타임·실행·UI·종료·재실행 결과를 기록합니다. 13~21단계의 화면 관측 및 미확인 기능을 구분하고, 이동 가능한 구성·데이터 보존·릴리스 범위를 문서화합니다.
- **제출 변경 파일:** `on-client/docs/STUDENT_RELEASE_RECORD.md` **1개 신규 작성(103줄 추가)**. 기존 학생 `student/extension.mjs`, 제공 `public/`, `src/`, `tools/`, 인증·판정 관련 코드는 수정하지 않았습니다.
- **제출 버전:** `on-client/package.json`의 **`0.2.21` — 검증 중**. `v1.0` 태그·배포·실운영 인증을 선언하지 않았습니다.
- **검증 커밋 구분:** 최초 별도 폴더 재현은 `9eaeed80ad8c8d01de292494b07b8162c7d5902b` 기준입니다. 이후 문서를 추가해 **최종 제출 후보** `0053986ca310b608e1bfd0d9275af940baf69f0d`를 만들었고, 해당 커밋으로 검증 복제본을 갱신하여 **서버·기본 화면을 다시 확인**했습니다. 13~20단계 모든 메뉴·버튼을 최종 커밋에서 재실행했다고 주장하지 않습니다.

## 문제 → 해결 방법

1. **여러 단계·여러 커밋의 성공 이력을 한 번의 릴리스 성공으로 오인할 위험:** 원본 저장소의 `main`, 원격 URL, HEAD, 변경 0건을 확인하고, 별도 `choi-bujang-secret-vault-stage22-repro` 폴더에 GitHub 저장소를 복제했습니다. `checkout --detach`로 특정 40자리 커밋을 고정했습니다.
2. **실제 실행 가능성과 코드 존재를 혼동할 위험:** 새 복제본 `on-client`에서 `node --version` **`v24.22.1`**, 앱 버전 **`0.2.21`**, 핵심 파일 **5/5 존재**를 확인했습니다. `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost -Port 5191`로 로컬 서버를 시작하고, `http://127.0.0.1:5191/`의 기본 UI를 브라우저로 확인했습니다. `-NoNativeHost`와 UI의 `연결 없음`을 실제 SDP 연결 성공으로 간주하지 않았습니다.
3. **기능별 시연·실제 운영 데이터 경계:** `renderIdentity`·`renderDecision`·`renderEvents`·`renderStatus`·`renderAiConnection`·`renderExplanation`·`renderAction`·`renderVulnerabilities`에 대해 **관측한 초기 상태, 연결 오류, 미설정 응답**만 기록했습니다. 실제 업무 앱 판정·XDR 사건·AI 모델 호출·보안 조치·패키지별 OSV 조회는 별도로 **미확인(UNV)**으로 남겼습니다.
4. **종료·재시작 누락:** 서버 종료 후 `Test-NetConnection 127.0.0.1 -Port 5191 -InformationLevel Quiet` → **`False`**를 확인하고 동일 명령으로 재실행했습니다. **재실행 후 브라우저 재접속 화면**에서도 제목·세 메뉴·`연결 없음`·신원 실패 표시가 유지됨을 확인했습니다.
5. **최종 제출 커밋의 원문 일관성:** 문서 커밋을 GitHub `main`에 푸시한 후 검증 복제본에서 `fetch` 및 `checkout --detach 0053986…`를 실행했습니다. `git diff --name-status 9eaeed8… 0053986…`에서 **재현 문서 1개 추가**만 확인했고, `on-client/student`, `public`, `src`, `tools`의 두 커밋 간 변경은 없었습니다. **최종 커밋의 로컬 시작 신호·HTTP 응답·브라우저 기본 화면**도 다시 확인했습니다.
6. **이동 시 사라지는 데이터·인증 설정:** `.gitignore`의 `artifacts/`, `.env`, `.env.*`, `node_modules/` 및 프로젝트 밖의 개인 설정·자격 보관소를 **Git Clone에 포함되지 않는 항목**으로 구분했습니다. 10단계의 해시 검증 기반 가상 백업·시험 복원은 실제 Supabase 운영 DB 백업·복원이 아니며, 원본 백업을 덮어쓰거나 운영 시스템 복원 명령을 실행하지 않았습니다.

## 새 환경에서 직접 확인한 기록

| 검증 항목 | 사용자 실행·화면에서 확인한 사실 | 판정 범위 |
|---|---|---|
| 기존 원본 보존 | `main`의 HEAD `9eaeed80…`, 원격 URL 일치, 변경 0건. GitHub 복제 후 원본 상태 `## main...origin/main` | **Git 상태 확인**. 운영 DB 보존 검증 아님 |
| 독립 복제 | `git clone --no-checkout --single-branch --branch main` 성공 후 `checkout --detach 9eaeed80…`, 복제본 `## HEAD (no branch)` | **별도 폴더 복제 확인** |
| 버전·파일 | 새 폴더에서 Node.js `v24.22.1`, 앱 `0.2.21`, 필수 5개 파일 `True`. PowerShell `5.1.26100.9711`은 21단계 실측이고 22단계에서 별도로 재측정하지 않음 | **실행 환경 확인**. 수업 기준 Node.js `24.19.0`과 구분 |
| 최초 서버·브라우저 | 새 복제본에서 5191 서버 시작 메시지 및 HTTP 응답, 케셰브 제목·「보호 현황」·「업무 앱」·「보안 기록」 메뉴 화면, 상단 `연결 없음` 확인 | **로컬 UI 재현**. 외부 연동 미확인 |
| 종료·재실행 | `Ctrl+C` 후 5191 TCP 접속 `False`, 같은 복제본에서 동일 명령으로 다시 시작 | **종료·재시작 확인** |
| 재시작 후 화면 | **2026-11-11 16:49:19(KST) 표시 화면**에서 5191 브라우저 재접속, 기본 메뉴와 `renderIdentity` 실패 상태 확인 | **재접속 화면 실측** |
| 최종 커밋 동기화 | 22단계 문서 **1개 신규**, 제출 SHA `0053986ca310b608e1bfd0d9275af940baf69f0d`를 원격 푸시하고 복제본에서 같은 커밋으로 체크아웃 | **제출 후보 원문 일치 확인** |
| 최종 커밋 코드 비교 | `git diff --name-status`는 문서 1개 추가만 표시. `git diff --quiet`로 `student`·`public`·`src`·`tools` 변경 없음 확인. 복제본 작업 상태 `## HEAD (no branch)` | **해당 두 커밋 간 코드 불변** |
| 최종 커밋 재실행 | 새 복제본 `0053986…`에서 5191 서버 실행·HTTP 응답 안내 재확인, **2026-11-11 17:15:58(KST) 표시 화면**에서 케셰브 로고·세 메뉴·`연결 없음` 확인 | **기본 화면 재실측**. 전체 기능 재클릭·외부 실동작 아님 |
| 기존 테스트 | 20단계 당시 `node --test` **121/121 통과** 기록 | **과거 로컬 회귀 결과**. 22단계 새 복제본에서 재실행했다고 기록하지 않음 |
| 공식 평가 | 사용자가 제시한 **2026-11-11 17:19(KST) 접수**, 필수 6/6 통과 | **ALEPH 원문 AI 검토 통과**. 서버에서 앱을 직접 실행했다는 뜻 아님 |

### 13~21단계 화면 관측 범위

| 단계 | 실제로 확인한 화면 상태 | 확인하지 못한 기능 |
|---|---|---|
| 13 | `renderIdentity`: 로그인·기기·세션 `연결 없음` | 운영 신원·등록 기기/세션 실조회 |
| 14 | `renderDecision`: 「업무 앱」 요청 전 초기 화면 | `allow`/`deny`/`challenge` 실제 판정 |
| 15 | `renderEvents`: XDR 기록 연결 실패 화면 | 사건 원천 목록·필터·상세 데이터 |
| 16 | `renderStatus`: `ENGINE_NOT_CONNECTED` 경고·수동 재시도 안내 | 운영 기기·세션·알림 진단 |
| 17 | `renderAiConnection`: AI 연결 점검 전 안내 | 실제 AI 승인·모델 점검 |
| 18 | `renderExplanation`: 사건 미선택 안내 | 실제 사건 설명·근거 ID 대조 |
| 19 | `renderAction`: `아직 미실행(idle)` | 실제 보안 조치 요청·ACK·집행 효과 확인 |
| 20 | `renderVulnerabilities`: `ok` 응답 및 **`not_configured` / `PROJECT_NOT_CONFIGURED`** 표시, `checkedAt` **`2026-11-11T07:42:01.118Z`** | 실제 OSV 패키지별 조회·버전·취약점·취소 경합 |
| 21 | 학생 설명서 존재, 실행·종료·재실행·브라우저 재접속 과정 수행 | 다른 PC·운영 환경의 전체 설치/연결 검증 |

위 표의 **13~21단계 상세 화면 관측은 문서 작성 전 `9eaeed8…` 복제본**에서 수행했습니다. 22단계 제출 후보 `0053986…`은 **학생 코드와 제공 실행 코드가 동일함을 Git으로 대조**하고 **기본 실행/UI만 다시 확인**했습니다. 상세 기능의 새로운 실측으로 중복 계산하지 않습니다. `npm run demo`는 실행하지 않았습니다.

## 공식 필수 확인 항목

| 항목 | 공식 결과 |
|---|---|
| `cumulative_source_consistency` | 통과 |
| `portable_package_readiness` | 통과 |
| `reproduction_record_consistency` | 통과 |
| `data_preservation_plan` | 통과 |
| `demo_self_report_distinction` | 통과 |
| `version_scope_honest` | 통과 |

**평가 범위:** 공식 **6/6 통과**는 22단계 제출 커밋의 소스·이식 가능 구성·학생 재현 진술·데이터 보존 계획·버전 표기가 과제 요건에 맞는다는 **AI 원문 검토 결과**입니다. ALEPH 서버가 새 폴더를 직접 복제·실행한 결과, 실제 19단계 보안 조치 집행 성공, 운영 서비스 인증 또는 정식 `v1.0` 승인이라는 의미는 아닙니다.

## 보존 계획과 남은 미확인(UNV)

- **Git 이력·원본:** 제출과 문서화는 별도 커밋으로 남기고 기존 작업 폴더의 기록·학생 소스·제공 파일·인증 설정은 삭제하거나 덮어쓰지 않습니다. 새 검증용 복제본은 특정 커밋에 고정하여 실제 시연의 근거를 보존합니다.
- **비밀·사본:** `.env*`, `artifacts/`, 개인 자격 저장소 및 실제 사용자 데이터는 공개 Git 기록에 포함하지 않습니다. 10단계 로컬 가상 시험 데이터는 기존 **해시 검증·사본·소유자·감사 기록**을 기준으로 보호하며, 새 복제본에서 사본이 없다는 사실을 백업 손실이나 복원 성공으로 해석하지 않습니다.
- **운영 백업:** Supabase RLS/DB, 외부 SDP·XDR·AI 운영 데이터의 스냅샷·권한·복원 가능성은 **미확인**입니다. 코드 롤백·Git 복제가 운영 DB 복원을 대신하지 않습니다. 22단계에서 운영 복원이나 로컬 시험 사본 재생성은 수행하지 않았습니다.
- **13~20단계 외부 동작:** 정상 SDP 사용자 판정·실제 사건 원천 조회·CLCO AI 모델 호출·실제 조치 집행/효과 관측·OSV 패키지 조회는 **미확인(UNV)**입니다. 특히 19단계 실집행 연결은 공식 안내상 아직 준비되지 않았습니다.
- **릴리스 상태:** 앱 `0.2.21`을 **검증 중**으로 유지합니다. **22단계 공식 통과만으로 `v1.0`을 붙이지 않습니다.**

## 선택과 학습

- **학습자가 직접 수행한 일:** 기존 작업 폴더·Git 이력 확인, 별도 Git Clone, 정확한 커밋 고정, Node.js·파일 경로 확인, 5191 로컬 서버와 UI 관측, 13~21단계 학생 화면 상태 캡처, 종료 후 TCP 포트 확인, 재실행/재접속, 최종 제출 커밋 재동기화 및 코드 변경 범위 대조, ALEPH 제출 결과 확인.
- **AI가 도운 일:** 원본 코드와 공식 과제 계약을 대조하고, 재현 결과와 제한을 `STUDENT_RELEASE_RECORD.md`에 구조화했습니다. 사용자가 제시하지 않은 실제 연결·유료 AI 요청·조치·운영 백업 완료를 만들어 기록하지 않았습니다.
- **실무 연결:** 릴리스 인수인계에는 **커밋 식별자·환경·명령·검증 증거·제한 사항·데이터 보존**을 함께 남겨야 다른 작업자가 동일 소스를 재현하고 미확인을 장애 또는 성공으로 잘못 해석하지 않습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** 누적 단계별 합격을 동일한 최종 소스의 새 환경 실행 성공 또는 운영 서비스 인증으로 오인하면 인수인계의 재현성이 떨어집니다.
- **해결:** 기존 폴더를 보존하고 커밋 고정 별도 복제본에서 케셰브를 실행했습니다. 단계별 초기·오류 상태, 데이터 백업 제한, `0.2.21` 검증 중 상태를 학생 실행 기록 문서로 남겼습니다.
- **검증:** 새 복제본의 서버·UI·종료·재시작·재접속을 직접 확인하고 제출 후보 `0053986…`에서 코드 불변 및 기본 UI 재실행을 확인했습니다. **2026-11-11 17:19 접수된 공식 필수 확인 6/6 통과**. 실제 SDP/AI·보안 조치·OSV 실조회는 **미확인(UNV)**입니다.

## 재현·관련 자료

아래 명령은 사용자 PC에서 수행한 **코드 비교·실행 점검을 다시 확인하기 위한 예시**입니다. 새로운 결과가 나올 때까지 22단계 공식 평가 또는 외부 연결 성공을 재현했다고 표시하지 않습니다.

```powershell
$repo = "$HOME\Projects\choi-bujang-secret-vault"
$clone = "$HOME\Projects\choi-bujang-secret-vault-stage22-repro"
$before = "9eaeed80ad8c8d01de292494b07b8162c7d5902b"
$after = "0053986ca310b608e1bfd0d9275af940baf69f0d"

git -C $clone rev-parse HEAD
git -C $clone diff --name-status $before $after
git -C $clone diff --quiet $before $after -- on-client/student on-client/public on-client/src on-client/tools
git -C $clone status -sb

# 서버 확인은 복제본 on-client에서, 미사용 포트를 선택해 실행
Set-Location "$clone\on-client"
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost -Port 5191
```

- [22단계 제출 원문](../../../on-client/docs/STUDENT_RELEASE_RECORD.md)
- [21단계 학생 실행 설명서](../../../on-client/docs/STUDENT_RUNBOOK.md)
- [21단계 포트폴리오 기록](stage-21.md)
- [기존 10단계 가상 백업·복원 기록](stage-10.md)
- [공식 제출 코드 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/0053986ca310b608e1bfd0d9275af940baf69f0d)
