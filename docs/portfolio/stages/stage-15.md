# 15단계 | 케셰브 — 접속 기록·기존 XDR 경보 목록과 상세 보기

**기록 출처:** 사용자가 제공한 15단계 공식 과제 안내, [학생 구현 코드](../../../on-client/student/extension.mjs), 제공 앱의 [보안 기록 조회·렌더링 코드](../../../on-client/public/app.js), 사용자 PowerShell·브라우저 확인 결과 및 사용자 제공 ALEPH 공식 판정.

**기록 상태:** 2026-11-09 13:48(KST) 공식 **필수 확인 항목 7/7 통과**. 평가 대상 커밋 [`e67624311460`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/e67624311460de29fe79040163befc120243c6d4). **별도의 100/100점 판정은 확인되지 않았습니다.**

## 과제와 목표

직원이 **본인의 최근 접속 기록(kind: `access`)과 기존에 저장된 XDR 경보(kind: `xdr`)**를 종류·업무 앱·접속 상태로 필터링하고, 기록별 발생 시각·근거·규칙·접속/세션/기기 상태를 구분해 확인하도록 학생 화면을 구현했습니다.

**관측 범위:** 제공 서버가 현재 등록 정보와 대조해 반환하는 본인의 최근 기록 **최대 40건**입니다. 전체 직원·전체 과거 로그가 아니며, 화면을 열 때 XDR 탐지를 새로 수행하지 않습니다. 서버가 반환한 전체/생략 건수와 확인 시각은 **제공 UI가 별도로 표시**하며, 학생 함수 입력에는 기록 배열만 전달됩니다.

## 문제 → 해결 방법

- **문제:** 사건 목록이 무작위 순서로 보이거나, 접속·XDR 경보의 근거와 규칙을 확인할 수 없다면 사용자가 사건의 의미를 파악하기 어렵습니다. 과거 기록의 `unknown` 상태를 정상으로 해석하거나, 조회 실패 뒤 이전 결과를 계속 표시하면 보안 현황이 왜곡될 수 있습니다.
- **입력 계약:** `renderEvents({ status, mode, data?, error? })`. `data`는 `{id,kind,at,appId,summary,evidence:[{id,text}],rules:[{id,text}],state:{access,session,device},supportedActions}` 형식의 기록 배열입니다. 기존 `public/app.js`가 `GET /api/events` 결과를 검증·전달합니다.
- **수정 범위:** `on-client/student/extension.mjs`의 `renderEvents` 함수만 구현하고 기존 13단계 `renderIdentity`, 14단계 `renderDecision`, 제공 서버·`public/app.js`·판정기·인증 설정을 보존했습니다. DOM 생성은 `document.createElement`, `textContent`와 안전한 속성 설정을 사용하고, `innerHTML`은 사용하지 않았습니다.
- **시간·목록:** `const records = [...data].sort((a,b) => Date.parse(b.at) - Date.parse(a.at))`로 원본을 건드리지 않고 발생 시각의 최신순으로 정렬합니다. 행에는 기록 `id`, 원본 `at`, `kind`의 한국어 종류, `appId`, `summary`를 텍스트로 출력하고 `data-student-event-id`를 붙입니다. 앱 ID가 없는 오래된 기록은 `앱 확인 불가`로 표시합니다.
- **필터:** 접근 가능한 이름이 `기록 종류`, `업무 앱`, `접속 상태`인 `label`/`select` 세 개를 제공하고, 전체는 `all`, 나머지 옵션 값은 서버가 준 원본 `kind`, `appId`, `state.access`를 유지합니다. 받은 배열 안에서만 필터링하고 결과 건수·해당 행을 다시 표시합니다. 필터마다 서버에 추가 요청하지 않습니다.
- **상세:** 행의 `<event.id> 상세` 버튼으로 상세를 열고 `data-student-event-detail`에 같은 ID를 지정합니다. 기록 ID·앱 ID, 근거 `evidence`와 규칙 `rules` 각각의 `id`·`text`, 세 상태 `access / session / device`의 한국어 설명과 원래 코드를 분리해 표시합니다. `unknown`은 `확인 불가(unknown)`으로 남기고 정상 상태로 보정하지 않습니다.
- **갱신·오류:** 필터 변경 때 기존 상세를 제거하고, 상위 제공 UI에서 새 자료가 오면 학생 영역을 새 DOM으로 교체하도록 했습니다. 빈 배열은 `표시할 기록이 없습니다.`, 조회 실패는 `기록을 불러오지 못했습니다: {message}`, 계약 불일치는 `기록 확인 불가`로 구분합니다. 기존 목록을 오류 화면에 남기지 않습니다.
- **안전 범위:** 원천이 지원하는 조치 `supportedActions`는 이 단계에서 **집행하지 않습니다**. 기록 상세에 실제 조치 실행 버튼이나 임의 POST 요청을 추가하지 않았습니다. 미지원 조치 안내는 다음 단계의 별도 요구사항입니다.

## 검증 — 코드·모의 자료·실제 화면·공식 판정 분리

| 범위 | 관찰 사실 또는 근거 | 결과 |
|---|---|---|
| 수정 파일 | 사용자 PC `git diff --name-only` / 스테이징 목록 / 커밋 출력 | `on-client/student/extension.mjs` **1개**, 185줄 추가·1줄 삭제 |
| 문법 | 사용자 PC `node --check` 오류 없이 종료 | 통과 |
| Git 공백 검사 | `git diff --check`, `git diff --cached --check` 오류 없이 종료. LF/CRLF 경고 출력 | 통과 |
| 모의 데이터 검사 | 구현 과정에서 정렬·필터·상세·갱신·오류·텍스트 출력 **22/22 통과로 보고**. 이 기록 작성 과정에서 별도 재실행은 하지 않음 | 보고된 모의 결과 |
| 실제 브라우저 | `보안 기록` 메뉴·학생 `renderEvents` 영역에서 연결 상태 `연결 없음` 및 `기록을 불러오지 못했습니다` 안내를 직접 확인 | 실패 안내 확인 |
| 실제 목록 필터·상세 | 기존 서버·에이전트 연결이 없어 실제 기록과 필터 선택·상세 열기는 관찰하지 못함 | **미확인** |
| 실제 빈 배열 | 서버에서 정상 응답 `ok`의 빈 `data: []`를 받는 상황은 직접 관찰하지 않음 | **미확인** |
| GitHub 반영 | `git push origin main` 성공, 작업 트리 `## main...origin/main`, 제출 커밋 `e67624311460de29fe79040163befc120243c6d4` 확인 | 확인 |
| 공식 ALEPH 판정 | 사용자 제공 2026-11-09 13:48 접수 결과, 아래 필수 항목 모두 통과 | **7/7 통과** |

### 공식 필수 확인 항목

| 항목 | 공식 결과 |
|---|---|
| `student-source-changed` | 통과 |
| `event_scope` | 통과 |
| `event_time` | 통과 |
| `event_filter` | 통과 |
| `event_detail` | 통과 |
| `events-refresh-replaces` | 통과 |
| `events-empty-error-distinct` | 통과 |

공식 7/7 결과는 **제출 커밋의 코드 기준 판정**이며 실제 SDP 연결, 전체 위협 탐지, 실제 기록 40건 수신 또는 조치 집행을 실측했다는 뜻이 아닙니다. SDP 설정 파일이 없는 것은 공식 안내상 제출·통과의 장애가 아닙니다.

## 선택과 학습

조회 범위와 기록 내용을 구분하고, 기존 배열을 불변으로 유지하면서 정렬·필터 결과만 화면에 반영했습니다. 기록의 `unknown`이나 앱 ID 누락을 임의의 정상 정보로 채우지 않고, 조회 실패와 빈 결과를 분리했습니다. **관측한 사실, 결측 상태, 탐지·차단 같은 실제 조치**를 서로 혼동하지 않는 보안 운영 화면 설계의 중요성을 학습했습니다.

## 포트폴리오 3줄 요약 — 문제 → 해결 → 검증

- **문제:** 본인의 접속 기록과 저장된 XDR 경보를 시각순으로 비교하고, 기록별 근거·규칙·보안 상태를 확인할 수 있어야 했습니다.
- **해결:** `renderEvents`에 원본 불변 정렬, 세 가지 클라이언트 필터, 기록별 상세 보기, 갱신 시 이전 상세 제거, 오류·빈 목록 분리 표시를 구현했습니다.
- **검증:** Node.js 문법 및 Git 범위 검사를 통과하고, 브라우저에서 서버 미연결에 따른 실패 안내를 확인했습니다. **2026-11-09 13:48 공식 필수 확인 항목 7/7 통과**를 받았으며, 실제 데이터 필터·상세 동작은 미확인입니다.

## 재현과 관련 파일

저장소 최상위 폴더에서:

```powershell
node --check .\on-client\student\extension.mjs
```

로컬 서버 실행(별도 PowerShell):

```powershell
cd .\on-client
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
```

브라우저 `http://127.0.0.1:5189/`에서 `보안 기록` 메뉴의 학생 구현 표시를 확인합니다. 기존 서버 연결이 없으면 오류 안내만 보이며 실제 기록 조회 성공으로 간주하지 않습니다.

- [학생 구현 코드](../../../on-client/student/extension.mjs)
- [공식 15단계 과제 설명](../../../on-client/docs/STUDENT_PROMPTS.md)
- [제공 UI의 기록 조회·렌더링](../../../on-client/public/app.js)
- [공식 15단계 평가 기준 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/e67624311460de29fe79040163befc120243c6d4)

이 문서는 **공식 통과 후 별도로 작성하는 포트폴리오 기록**입니다. 문서 전용 후속 커밋은 공식 평가 대상 커밋 `e67624311460`과 구분합니다.
