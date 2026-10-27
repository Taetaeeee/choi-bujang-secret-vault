# BYTE BACK 방어전 시작 틀 R5

이 저장소는 BYTE BACK 방어전 R5의 1단계에서 만들어졌고, 현재 `aleph.config.json`의 단계는 **2**입니다. 처음 공개했던 메모 네 건은 모두 실습용 가상 자료이며, 현재는 학습용 Supabase DB로 옮기고 최신 소스의 정적 JSON에서 제거했습니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 1단계 기록 — 학생이 했던 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

1단계 당시 `/`에서 점령된 가상 자료실을 볼 수 있었고 `/data.json`에도 같은 가상 메모가 공개됐습니다. 2단계 최신 배포에서는 정적 `/data.json`을 더 이상 제공하지 않습니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 현재 본인 GitHub 저장소 및 운영 Vercel 주소로 설정되어 있고, `step`은 2입니다. 제출 묶음 실행 전 Git 원격·실제 배포와 다시 대조합니다.

로컬에서 정적 화면/빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 기존 `src/attack-check.mjs`는 아직 1단계 자기 점검 방식이므로 2단계 심판 판정으로 사용하지 않습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계에서 `public/data.json` 복사 흐름을 제거했으며, 이후 단계에서도 이를 되살리지 않습니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계 — 서버 API로 가상 자료 조회

- 공개 화면 `/`은 브라우저에서 **`GET /api/notes`**를 호출하여 네 카드의 제목과 내용을 표시합니다. 정적 `data.json`과 `public/data.json`은 최신 코드 및 빌드 결과물에 없습니다.
- Vercel 서버 함수 `api/notes.js`만 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY` 환경변수를 읽어 Supabase의 `public.vault_notes`에서 미할당(`owner_id IS NULL`) 가상 메모 4건을 조회합니다. 키를 웹페이지·API 응답·로그·Git에 기록하지 않습니다.
- **남은 약점:** 아직 인증·접근 통제가 없으므로 **`/api/notes`는 로그인하지 않은 사람도 호출할 수 있는 공개 주소**입니다. 가상 자료만 보관하세요. 사용자를 확인하고 자료를 막는 작업은 다음 단계에서 수행합니다.
- 과거 공개 커밋 또는 Vercel 배포 이력에는 1단계 가상 메모가 남아 있을 수 있습니다. 현재 파일을 지웠다고 과거 이력이 없어지는 것은 아닙니다.

### 배포 설정 (실제 키를 코드·채팅에 붙여넣지 마세요)

1. Supabase 프로젝트의 **Settings → API Keys**에서 서버 전용 Secret key를 확인합니다.
2. Vercel 프로젝트 **Settings → Environment Variables**에 `SUPABASE_URL`(Supabase 프로젝트 URL)과 `SUPABASE_SECRET_KEY`(서버 전용 Secret key)를 추가하고 **Production**에 적용합니다. 실제 값은 Vercel의 비밀 입력란에만 입력합니다.
3. 새 Production 배포 후 시크릿 창에서 `/`, `/api/notes`, `/data.json`, `/aleph.json`을 확인합니다. `/`과 `/api/notes`는 네 건, `/data.json`은 404, `/aleph.json`은 현재 Git 커밋과 `step: 2`가 기대 결과입니다.

로컬 정적 빌드는 `npm run build -- --local`로 확인할 수 있습니다. 서버 함수는 Vercel 환경변수와 DB에 연결해야 실제로 동작하며, 로컬 빌드 성공만으로 API 성공을 뜻하지 않습니다.

## 2단계 제작 3 — 공개 자료 잔존 검사 기록

**검사 범위:** GitHub `main`의 최신 추적 파일과 현재 Vercel 운영 도메인의 정적 경로(`/`, `/data.json`, `/aleph.json`)입니다. **서버 API(`/api/notes`)는 정적 파일 검사가 아니라 별도의 공개 접근 검사 대상**입니다. 비밀번호나 서버 전용 키는 출력하거나 저장하지 않습니다.

### 1. GitHub 최신 파일에서 메모 본문 검색 (Windows PowerShell)

프로젝트 폴더에서 다음을 실행합니다. 네 개의 가상 메모 본문을 코드에서 조합하여 검색하므로 README 자체에 네 문장을 그대로 다시 공개하지 않습니다.

```powershell
cd "$HOME\Projects\choi-bujang-secret-vault"
git status --short
git fetch origin
git rev-parse HEAD
git rev-parse origin/main

$sentences = @('과제', '포트폴리오', '리추얼', '행정') |
  ForEach-Object { '실습용 가상 ' + $_ + ' 기록' }
$grepArgs = @('grep', '-n', '-F')
foreach ($sentence in $sentences) { $grepArgs += @('-e', $sentence) }
$grepArgs += @('origin/main', '--', '.')
& git @grepArgs
if ($LASTEXITCODE -eq 1) { '최신 GitHub 추적 파일: 메모 본문 일치 0건' }
elseif ($LASTEXITCODE -eq 0) { '주의: 최신 GitHub 파일에서 메모 본문이 발견됨' }
else { '검사 오류: git grep 결과를 확인하세요' }
```

`git rev-parse HEAD`와 `origin/main`이 다르면 먼저 변경 이력을 확인합니다. 검색에서 파일명과 줄 번호가 출력되면 그 파일에 본문이 남은 것이므로 0건이라고 기록하지 않습니다. 이 검색은 최신 브랜치만 검사하며 과거 커밋은 검사 범위에 포함하지 않습니다.

### 2. 운영 배포 정적 경로 검색 (Windows PowerShell)

비로그인 상태에서 운영 도메인을 요청합니다. **출력은 경로·HTTP 상태·본문 일치 개수뿐**이고 응답 본문이나 비밀값은 출력하지 않습니다.

```powershell
$base = 'https://choi-bujang-secret-vault-alpha-drab.vercel.app'
$sentences = @('과제', '포트폴리오', '리추얼', '행정') |
  ForEach-Object { '실습용 가상 ' + $_ + ' 기록' }
foreach ($path in @('/', '/data.json', '/aleph.json')) {
  $status = '요청실패'; $body = ''
  try {
    $response = Invoke-WebRequest -Uri ($base + $path) -UseBasicParsing -ErrorAction Stop
    $status = [int]$response.StatusCode
    $body = [string]$response.Content
  } catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
  }
  if ($status -eq '요청실패') { "$path : 요청 실패 (미확인)"; continue }
  $count = @($sentences | Where-Object { $body.Contains($_) }).Count
  ('{0} : HTTP {1}, 정적 메모 문장 {2}건' -f $path, $status, $count)
}
```

**정상 기대값:** `/`은 HTTP 200이고 HTML 원본에 네 본문이 없어 0건, `/data.json`은 HTTP 404, `/aleph.json`은 HTTP 200이고 메모 본문이 0건입니다. `404`는 파일이 없다는 확인이지 과거 배포까지 삭제됐다는 뜻이 아닙니다. 화면에 보이는 네 카드는 별도 서버 API 응답으로 생성되므로 이 검사와 모순되지 않습니다.

### 3. 공개 서버 API 약점 확인 (비로그인)

시크릿 창에서 `/api/notes`를 열거나 PowerShell에서 아래 명령을 실행합니다. 메모 본문은 출력하지 않습니다.

```powershell
$response = Invoke-WebRequest -Uri ($base + '/api/notes') -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
'HTTP={0}; 가상메모={1}건; 표시값일치={2}' -f [int]$response.StatusCode, @($data.notes).Count, ($data.sampleMarker -eq 'SAMPLE_NOTE_1')
```

**정상 기대값:** 인증 없이 HTTP 200, 가상 메모 4건, 표시값 일치 `True`. 이는 **로그인·접근 통제가 없는 `/api/notes`를 누구나 호출할 수 있다는 남은 약점**을 확인하는 것이지 방어 성공이나 개인정보 보호 완료를 의미하지 않습니다.

### 4. 현재까지의 확인 결과와 남은 위험 (2026-10-27)

| 확인 대상 | 관찰 결과 | 범위·한계 |
| --- | --- | --- |
| GitHub `main` (`311efaf`) | 저장소 목록에서 `data.json`, `public/data.json` 없음. `public/index.html`에도 네 메모의 본문을 하드코딩하지 않음 | **전체 최신 파일의 본문 일괄 검색은 위 명령으로 별도 실행 후 확인** |
| 운영 배포 `/data.json` | 앞서 제출한 시크릿 창 캡처에서 HTTP 404 | 캡처는 `e4fad7e` 배포 당시의 확인 결과. 복구 커밋 `311efaf` 배포도 재확인 필요 |
| 운영 화면 `/` | 앞서 제출한 시크릿 창 캡처에서 카드 네 개 표시 | 화면은 서버 API 응답으로 구성되며, 정적 HTML에 본문이 있다는 증거는 아님 |
| 공개 `/api/notes` | 앞서 제출한 비로그인 검사에서 가상 메모 네 건 반환 | **접근 통제 미구현. 임의 방문자가 자료를 열람할 수 있음** |
| 옛 공개 커밋·옛 배포 | 최초 커밋 `ea8ed82`는 정적 메모를 포함했고, 과거 배포 기록도 존재했음 | **과거 노출은 해소되지 않음.** 최신 파일 삭제로 과거 Git 기록이나 이전 Vercel 배포가 자동 삭제되지는 않음 |

검증할 때는 실제 실행한 명령의 결과와 검사한 커밋을 기록합니다. **과거 공개 커밋과 배포 이력이 남아 있는 한 '과거 노출 해소' 또는 '모든 자료 비공개'라고 쓰지 않습니다.** 3단계 전까지는 실제 학생 자료·개인정보를 저장하지 않고 실습용 가상 메모 네 건만 유지합니다.

## 2단계 저장점

- **현재 기능:** Vercel 공개 화면이 `GET /api/notes`로 Supabase의 실습용 가상 메모 네 건을 표시합니다. 서버는 환경변수 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 사용하며, 원문 키를 Git이나 응답에 보관하지 않습니다.
- **현재 방어:** 최신 GitHub 파일과 현재 정적 배포에서 `data.json` 메모 원본을 제외합니다. `/aleph.json`은 배포 커밋과 `step: 2`를 표시합니다.
- **남은 약점:** `/api/notes`는 로그인 없이 호출할 수 있습니다. 옛 공개 커밋과 옛 배포에 남은 가상 메모는 현재 배포에서 파일을 지워도 없어지지 않습니다.
- **다시 실행:** 프로젝트 폴더에서 `npm.cmd run build -- --local`로 정적 빌드를 확인하고, `npm.cmd run test:r5` 및 `npm.cmd run test:package`로 시작 틀 테스트를 실행합니다. 실제 API·배포 동작은 운영 Vercel의 `/`, `/api/notes`, `/data.json`, `/aleph.json`을 비로그인으로 확인합니다.
- **제출 묶음:** 변경 파일을 커밋한 뒤 로컬 Git 작업 폴더에서 `npm.cmd run bundle`을 실행하고, 성공하면 Git에 포함하지 않는 `artifacts/submission.json`과 실행 요약을 확인합니다. 실행하지 않은 검사는 성공으로 기록하지 않습니다.
