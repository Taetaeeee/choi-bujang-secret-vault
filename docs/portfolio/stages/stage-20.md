# 20단계 | 케셰브 — 정확한 설치 패키지 버전과 OSV 취약점 조회 상태 구분

**기록 출처:** 사용자가 제공한 20단계 공식 과제 안내·ALEPH 평가 결과, [20단계 제출 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/12ba2f058e1742b32766f9529fab3913a665da62)의 `on-client/student/extension.mjs`, 제공 `on-client/public/app.js`·`on-client/public/vulnerabilities-view.mjs`, 저장소 루트 `package-lock.json`, 사용자 PowerShell 출력과 케셰브 브라우저 화면·개발자 도구 캡처. 코드 확인, 모의 검사, 로컬 테스트, 실제 화면 관측, 공식 AI 판정을 구분합니다.

**공식 결과:** **2026-11-11 14:18(KST) 접수**, 필수 확인 **9/9 통과**(사용자가 제공한 ALEPH 판정 결과). 평가 대상은 [`12ba2f058e1742b32766f9529fab3913a665da62`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/12ba2f058e1742b32766f9529fab3913a665da62)입니다. **100점 만점의 별도 점수는 확인되지 않았습니다.**

## 과제와 입력 계약

목표는 **프로젝트에 실제 설치된 공개 패키지의 정확한 버전**과 **OSV(Open Source Vulnerabilities) 조회 결과**를 연결하되, **조회하지 않음·일부 실패·확인 불가**를 취약점 미발견으로 오해하지 않도록 표시하는 것입니다.

- **수정 범위:** `on-client/student/extension.mjs`의 `renderVulnerabilities({ status, mode, data?, error? })`만 수정했습니다. 13~19단계 학생 함수, 제공 서버·`public/app.js`, 판정 코드, 인증 설정, 패키지 의존성 버전은 변경하지 않았습니다.
- **최상위 요청 상태:** `idle`, `loading`, `error`, `ok`. `ok`는 HTTP 응답을 받아 검증한 표시 상태일 뿐, 전체 패키지 조회 완료나 안전 보장을 뜻하지 않습니다.
- **전체 결과 `data.status`:** `complete`(모두 조회), `partial`(일부 조회 실패), `not_checked`(승인된 조회 대상 없음), `not_configured`(프로젝트 조회 설정 미완료), `unverifiable`(lock 파일 확인 불가).
- **전달 가능한 전체 메타데이터:** `data.lockfileVersion`, `data.lockfileHash`, `data.checkedAt`, `data.packages`. 설정·검증 불가 상태에서는 `packages`가 빈 배열일 수 있으며, `lockfileVersion`·`lockfileHash`가 전달되지 않을 수 있습니다.
- **패키지별 계약:** `{name, version, status, vulnerabilities, source, checkedAt}`. 패키지 상태는 `known_vulnerabilities`, `none_found`, `unverifiable`; 각 취약점은 `{id, modified}`입니다. `data-student-package-name`과 `data-student-package-version`을 패키지 행에 둡니다.
- **입력 검증의 책임:** 제공 앱은 `/api/vulnerabilities`를 명시적 사용자 요청으로 조회하며 `normalizeScan()`에서 입력 형식을 검증합니다. 학생 함수는 검증 후 전달된 결과를 **`document.createElement`·`textContent` 기반 읽기 전용 DOM**으로 표시합니다. 학생이 OSV에 직접 조회하거나 허용 목록·서버 설정을 변경하지 않습니다.
- **조회 대상:** 공식 안내상 서버는 프로젝트의 `package-lock.json`과 담당자가 허용한 **공개 패키지**만 조회합니다. 저장소 루트 `package-lock.json`의 `lockfileVersion`은 **3**으로 코드/파일에서 확인했지만, 개별 패키지에 대한 **실제 조회·표시 버전 대조는 수행하지 못했습니다.**

## 문제 → 해결 방법

1. **요청 생명주기와 이전 결과 분리:** 기존 `renderVulnerabilities()`의 구현 대기 문구를 대체하고 `idle`, `loading`, `error`, `ok`를 구분했습니다. 매 호출에 새 DOM을 만들고 `loading`/`error`에서는 과거 패키지 표를 재사용하지 않습니다. 오류 안내는 비밀값 형태와 제어문자를 걸러 안전하게 표시합니다.
2. **조회 범위의 성공·미조회·실패 구분:** `ok`인 경우에도 `data.status` 원본 값을 한국어 의미와 함께 표시합니다. `complete`, `partial`, `not_checked`, `not_configured`, `unverifiable`를 각각 구분하고, **미조회·설정 미완료·검증 불가를 `none_found`로 해석하지 않습니다.**
3. **실제 버전·출처·시각 바인딩:** 전달된 경우 `lockfileVersion`, `lockfileHash`, `checkedAt`을 표시합니다. 패키지별 `name`·**정확한 `version`**·상태·OSV 조회 `source`·확인 `checkedAt`을 표시하고, 각 행에 `data-student-package-name`, `data-student-package-version` 속성을 설정합니다. `^1.2.0`처럼 설치 버전이 아닌 범위는 화면에 정확한 설치 버전으로 표시하지 않습니다. 값을 추정해 만들지 않습니다.
4. **발견 항목과 불완전 조회 보존:** 각 `vulnerabilities` 항목의 `id`와 `modified`를 표시합니다. `partial` 또는 패키지별 `unverifiable`이더라도 이미 전달된 ID는 삭제하지 않고, **「일부 확인·전체 조회 확인 불가」**로 표현합니다. `none_found`는 **해당 조회 범위에 알려진 항목이 없음**이지 모든 취약점이 없거나 앱 전체가 안전하다는 뜻이 아닙니다.
5. **갱신·취소·복구 책임 분리:** 제공 앱의 `loadVulnerabilities()`, `cancelVulnerabilities()`, `clearVulnerabilities()`가 요청·취소·재조회 및 늦은 응답 무효화를 담당합니다. 학생 함수는 버튼·네트워크 요청·자동 재시도를 추가하지 않습니다. 기능의 실제 재현 여부는 아래 검증 표의 관측 범위로 제한합니다.

## 검증 — 실제로 확인한 범위

| 범위 | 실제 확인한 결과 | 판정 |
|---|---|---|
| 변경 파일·크기 | 사용자 `git diff --stat`, 스테이징 출력에서 **학생 `extension.mjs` 1개 파일, 130줄 추가·1줄 삭제**. GitHub 제출 커밋에서도 해당 함수 구현 확인 | 변경 범위 확인 |
| 적용·정적 검사 | 1~4번 수정본을 단계별 적용, 최종 SHA-256 `e0480218c983194f9b8cb0b0115e8b8b822a4fc494a3025220c800a44e8b480a` 일치. 사용자 PC의 `node --check`, `git diff --check`, `git diff --cached --check` 오류 없음. LF→CRLF는 Windows 줄바꿈 경고 | 통과 |
| 모의 DOM 검사 | 단계별 학습 과정에서 최종 수정본 **39/39 통과로 보고된 모의 검사**(가상 입력의 상태·버전·취약점 표시 검사) | 모의 결과. 실제 OSV 조회 아님 |
| 전체 로컬 회귀 테스트 | 사용자 PC `node --test`: **121건 통과 / 실패 0건 / 취소 0건** | 기존 기능 회귀 검사 통과. 20단계 실측 대체 아님 |
| 실제 기본 화면 | 보호 현황의 설치 패키지 조회에서 **「프로젝트 연결 준비 중」**, 코드 `PROJECT_NOT_CONFIGURED`, 조회 시각 `2026-11-11T04:52:12.972Z`, OSV 출처 주소 표시 | **`not_configured` 상태 화면 관측** |
| 실제 학생 화면 | 사용자가 제공한 브라우저 캡처에서 `renderVulnerabilities` 학생 표시 영역에 **`조회 준비 미완료(not_configured)`**, 설정 필요·취약점 없음 아님 안내 및 동일 조회 시각 확인 | **학생 화면 반영 관측** |
| 직접 재조회 네트워크 | 사용자 개발자 도구에서 `vulnerabilities` fetch 요청, **HTTP 200**, 약 2ms 응답을 확인. 반환된 의미 상태는 설정 미완료 | 새 요청·서버 응답 확인. 패키지 실제 조회 완료 아님 |
| 진행 중 취소 | 설정 미완료 응답이 빠르게 반환되어 취소 버튼이 조회 종료 후 비활성화됨. 제공 코드의 `status === 'loading'`에서만 취소 버튼 활성화 조건은 확인 | **취소·늦은 응답 차단 실측 미확인** |
| 오류 후 재조회 | `PROJECT_NOT_CONFIGURED`는 조회 설정 상태이지 `status: error`를 재현한 것이 아님. 실제 오류 발생 후 재시도는 관측하지 않음 | **미확인** |
| lock 버전·실제 OSV 취약점 | 서버 공개 조회 허용 대상 미설정으로 실제 패키지 행·CVE/GHSA ID가 화면에 표시되지 않음. 파일의 `lockfileVersion: 3`은 확인, **화면의 패키지별 설치 버전과 lock·node_modules 일치 여부는 미검증** | **미확인** |
| GitHub 반영 | 사용자 `git push origin main` 성공, `git status -sb`의 `## main...origin/main` 동기화, `git rev-parse HEAD` **`12ba2f058e1742b32766f9529fab3913a665da62`** 확인 | 제출 코드 푸시 확인 |
| ALEPH 공식 판정 | 사용자 제공 결과: **2026-11-11 14:18(KST) 접수**, 필수 항목 9개 모두 통과 | **공식 코드 평가 9/9 통과** |

### 공식 필수 확인 항목

| 항목 | 공식 결과 |
|---|---|
| `student-source-changed` | 통과 |
| `exact_lock_version` | 통과 |
| `osv_match` | 통과 |
| `lookup_unavailable` | 통과 |
| `no_results_distinction` | 통과 |
| `partial_preservation` | 통과 |
| `refresh_replaces` | 통과 |
| `request_recovery` | 통과 |
| `stale_response_blocked` | 통과 |

**공식 판정 범위:** ALEPH는 제출 커밋을 AI가 읽어 과제 계약과 대조해 판정하며 학생 코드를 실행하지 않습니다. 따라서 **공식 9/9 통과가 실제 OSV 조회 성공, 취약점 없음, 정확한 설치 버전의 실측 대조, 취소 경합 실험 또는 서비스 보안성 인증을 의미하지 않습니다.**

## 선택과 학습

- **학습한 개념:** `package.json`의 버전 범위(예: `^1.2.0`)와 `package-lock.json` 및 설치 메타데이터로 확인하는 **실제 버전**은 다릅니다. OSV 결과를 해석할 때는 정확한 버전, 조회 출처, 시각, 확인 가능한 범위를 함께 봐야 합니다.
- **AI가 구현한 내용:** 상태 4종·전체 결과 상태 5종·패키지별 상태 3종을 구분하는 한국어 안내, 정확한 버전 및 lock 메타데이터 바인딩, 취약점 `id`·`modified` 표시, `partial` 결과 보존, XSS를 피하는 `textContent` 출력을 1~4번에 나누어 구현했습니다.
- **학습자가 직접 확인한 내용:** 파일 해시·정적 검사·전체 회귀 테스트, 기본 화면과 학생 화면의 `not_configured` 일치, 개발자 도구의 실제 fetch/HTTP 200, Git 커밋·푸시 및 공식 9/9 판정을 직접 확인했습니다.
- **실무 연결:** SCA(소프트웨어 구성 분석)와 취약점 관리에서는 **미조회·부분 조회·알려진 취약점 미발견**을 명확히 구분해야 누락된 자산을 안전하다고 오판하지 않습니다. 비공개 패키지 이름을 무단 외부 조회하거나 취약점 사례를 만들기 위해 의존성을 낮추지 않습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** 설치 버전 범위를 실제 버전처럼 취급하거나, 조회 실패·미설정을 `취약점 없음`으로 오판하면 패키지 위험 상태가 부정확해집니다.
- **해결:** `renderVulnerabilities`에서 요청·전체 조회·패키지별 상태를 분리하고, 전달된 정확한 버전·lock 해시·OSV 출처·확인 시각·취약점 ID를 표시했습니다. 부분 실패 때도 이미 확인한 취약점은 유지합니다.
- **검증:** 로컬 회귀 테스트 **121/121 통과**, `not_configured` 기본/학생 화면 표시와 HTTP 재조회 확인, **2026-11-11 14:18 접수된 공식 필수 항목 9/9 통과**. 실제 OSV 조회 대상·설치 버전 대조 및 취소 경합은 **미확인**입니다.

## 재현 및 관련 자료

저장소 루트 PowerShell에서 실행 가능한 **비용 없는 정적·로컬 검사**입니다. 명령은 실제 조회 결과나 공식 평가를 재현하는 것이 아닙니다.

```powershell
node --check .\on-client\student\extension.mjs
node --test
git show --stat 12ba2f058e1742b32766f9529fab3913a665da62
```

케셰브 앱을 직접 확인할 때는 `on-client`에서 공식 `tools/start-alekov.ps1` 실행 안내를 따라 **보호 현황 → 설치 패키지 조회**를 사용합니다. `PROJECT_NOT_CONFIGURED`이면 담당자 설정 전이므로 취약점이 없다고 결론 내리지 않으며, 학생이 대상 경로나 허용 목록을 임의로 설정하지 않습니다.

- [20단계 평가 기준 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/12ba2f058e1742b32766f9529fab3913a665da62)
- [학생 구현 코드](../../../on-client/student/extension.mjs)
- [20단계 공식 과제 안내](../../../on-client/docs/STUDENT_PROMPTS.md)
- [제공 앱의 조회·취소·세대 검사](../../../on-client/public/app.js)
- [제공 OSV 정규화 및 렌더링](../../../on-client/public/vulnerabilities-view.mjs)
- [루트 lock 파일](../../../package-lock.json)
- [19단계 포트폴리오](stage-19.md)

이 문서는 **20단계 공식 평가 통과 후 작성한 별도 학습·검증 기록**입니다. 문서 전용 커밋은 공식 평가 기준 커밋 `12ba2f058e1742b32766f9529fab3913a665da62`와 구분합니다.
