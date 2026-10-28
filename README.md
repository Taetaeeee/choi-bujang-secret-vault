# BYTE BACK 방어전 시작 틀 R5

이 저장소는 BYTE BACK 방어전 R5의 1단계에서 만들어졌고, 현재 `aleph.config.json`의 단계는 **4**입니다. 처음 공개했던 메모 네 건은 모두 실습용 가상 자료이며, 현재는 학습용 Supabase DB로 옮기고 최신 소스의 정적 JSON에서 제거했습니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 1단계 기록 — 학생이 했던 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

1단계 당시 `/`에서 점령된 가상 자료실을 볼 수 있었고 `/data.json`에도 같은 가상 메모가 공개됐습니다. 2단계 최신 배포에서는 정적 `/data.json`을 더 이상 제공하지 않습니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 현재 본인 GitHub 저장소 및 운영 Vercel 주소로 설정되어 있고, `step`은 4입니다. 제출 묶음 실행 전 Git 원격·실제 배포와 다시 대조합니다.

로컬에서 정적 화면/빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. `src/attack-check.mjs`는 4단계의 공개 경로에 직접 비인증 요청을 보내 결과를 기록합니다. 이 학생 자기 점검은 공식 심판 판정이 아닙니다.

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
## 3단계 저장점 (2026-10-28)

### 현재 기능

- Supabase Auth 이메일·비밀번호 로그인/로그아웃과 로그인 실패 이유 표시.
- 서버는 기존 `src/verify-login.mjs`로 Bearer 토큰을 검증하고, 사용자 ID는 검증 결과에서만 사용. 비로그인 요청은 `401 UNAUTHORIZED`.
- 신규 가상 메모는 `public.vault_user_notes`에 UUID와 `owner_id`로 저장. 목록은 로그인 사용자의 `owner_id`로 필터링.
- 메모 추가 `POST /api/notes`는 `{id,title,body}`를 받고 `id` 생략 시 UUID 생성, 응답 `{id}`. 단건 조회·수정·삭제는 `GET/PUT/DELETE /api/notes/:id`, 단건 조회 성공 응답 `{id,title,body}`. 삭제 후 인증된 GET은 `404 NOT_FOUND`.
- 기존 `public.vault_notes`의 실습용 가상 자료 4건은 별도 읽기 전용 카드로 보존.

### 설정과 검증

- `aleph.config.json`: `step: 3`, `repoUrl`과 `publicAppUrl`은 실제 저장소·Vercel 주소. `identityProvider`에는 Supabase Auth issuer·JWKS URL·audience를 공개 정보로 기록. `judgeIssuer`는 변경하지 않음.
- `allowedRoutes`: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`.
- 사용자 화면에서 A 계정 로그인, 로그아웃, 실패 안내, 메모 추가·수정·삭제와 새로고침 유지를 확인. 비로그인 `GET /api/notes`는 실제 `401 UNAUTHORIZED`와 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`를 확인. 삭제된 UUID에 인증된 GET을 보내 `404 NOT_FOUND` 확인.
- **현재 남은 취약점:** 단건 GET·PUT·DELETE에서는 로그인 여부만 검사하고 `owner_id`는 검사하지 않음. 다른 로그인 사용자가 UUID를 알면 접근할 수 있는 허점을 4단계에서 수정. B 계정의 실제 교차 접근 시험은 4단계에서 수행.
- 정적 `/data.json`은 최신 빌드에서 제외. 이전 공개 커밋이나 과거 배포에 가상 자료가 남아 있을 수 있으므로 실제 개인정보를 넣지 않음.
- 로컬 자동 테스트와 학생의 자체 점검은 공식 심판 판정이 아님.

### 재실행·제출 절차

1. `npm.cmd run build -- --local`, `npm.cmd run test:r5`, `npm.cmd run test:package`로 기존 기능을 확인. 실제 배포 기능은 Vercel에서 별도로 확인.
2. 로그인 없이 `/api/notes`의 401을 확인하고 A 로그인 후 메모 CRUD, 삭제 후 인증된 단건 GET 404를 확인. `/aleph.json`의 `step: 3`, `/`의 `nosniff`도 확인.
3. 저장점 커밋 후 로컬의 Git 제외 파일 `bundle-notes.json`에 실습 내용만 적고 `npm.cmd run bundle`을 실행. `artifacts/submission.json`과 실행 요약을 확인하되 JSON은 Git에 커밋하지 않음. 실패 시 첫 오류만 수정.
## 4단계 저장점 (2026-10-28)

### 현재 기능과 3단계 대비 변경

- 앞의 1~3단계 기록은 각 당시 상태를 설명한 이력입니다. **현재** `aleph.config.json`은 `step: 4`이며 배포 주소와 Supabase Auth 발급자 설정을 유지합니다. `judgeIssuer`는 변경하지 않습니다.
- Supabase Auth 로그인 토큰을 기존 `src/verify-login.mjs`로 확인하고, 비로그인 `GET /api/notes`는 HTTP 401 JSON `UNAUTHORIZED`로 거부합니다. 서버는 URL·본문의 `userId`·`role`·`owner_id`를 신뢰하지 않습니다.
- `public.vault_user_notes`의 목록·단건 GET·PUT·DELETE는 **서버에서 검증한 사용자 ID와 DB `owner_id`가 일치하는 행**만 대상으로 합니다. 타인 UUID 접근은 메모의 존재 여부를 공개하지 않도록 404 `NOT_FOUND`로 응답합니다.
- POST는 `{id,title,body}` (`id` 생략 시 UUID 생성), 응답 `{id}`이고, `owner_id`는 검증된 ID로 지정합니다. PUT은 `{title,body}`만 허용하고 수정 전후 소유권을 유지하며 단건 응답은 `{id,title,body}`입니다. 본문으로 소유자 변경을 시도하면 400 `INVALID_NOTE`입니다.
- `public.vault_notes`의 기존 네 건은 A 계정 소유로 연결해 **A에게만 읽기 전용**으로 표시합니다. B에게는 이 네 건이 표시되지 않습니다. 기존 4건의 테이블 권한·RLS는 이번 제작에서 변경하지 않았습니다.
- `aleph.config.json` 허용 경로: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`.

### 학습 DB 정책 (SQL Editor에서 실행·검증)

- `public.vault_user_notes`에 한해 `REVOKE ALL ... FROM PUBLIC, anon, authenticated` 후 `authenticated`에 SELECT·INSERT·UPDATE·DELETE만 GRANT했습니다. `anon`에는 테이블 권한이 없습니다.
- RLS 활성화 상태 `true`. `authenticated` 역할의 4개 정책을 적용했습니다: SELECT·DELETE는 `USING (auth.uid() = owner_id)`, INSERT는 `WITH CHECK (auth.uid() = owner_id)`, UPDATE는 기존 행 `USING`과 새 행 `WITH CHECK`를 모두 검사합니다.
- SQL Editor에서 `information_schema.role_table_grants`와 `has_table_privilege`를 적용 전후 비교했고, 적용 후 `anon` 7개 권한 모두 `false`, `authenticated`는 CRUD 4개 `true` / TRUNCATE·REFERENCES·TRIGGER `false`를 확인했습니다.
- 서버 API는 서버 전용 키의 `service_role`로 DB에 접근할 수 있어 RLS를 우회할 수 있습니다. 따라서 **앱 소유자 검사 결과와 RLS 정책 정의·GRANT 검증은 별개의 근거**입니다. `authenticated` 역할의 직접 Data API 점검을 했다고 주장하지 않습니다.

### 학생이 실제 확인한 동작과 한계

- A/B 로그인 후 본인 목록만 보임: A는 기존 읽기 전용 4건과 자신의 UUID 메모, B는 자신의 시험 메모만 조회됨. B의 새 메모 POST·PUT·DELETE는 4단계 API 변경 후 확인했습니다.
- B 로그인으로 A의 UUID에 GET·PUT·DELETE 요청을 보내 각각 HTTP 404 `NOT_FOUND`를 확인했고, 이후 A가 로그인해 원본 보존을 확인했습니다. A 로그인으로 B UUID에 GET을 보내 HTTP 404를 확인했습니다.
- A가 PUT 본문에 `owner_id`를 보낸 시험은 HTTP 400 `INVALID_NOTE`로 거부됐습니다.
- RLS 적용 후 A/B 자기 목록이 유지되었고 B의 새 시험 메모 POST·PUT·DELETE 동작을 확인했습니다. RLS 적용 후 A의 POST·PUT·DELETE 실측 및 A→B PUT·DELETE 실측은 수행하지 않았습니다.
- 직접 점검(`src/attack-check.mjs`)은 **토큰 없이 공개 URL로 다시 보낸 요청** 4개만 기록합니다: `/data.json`, `/api/notes`, `/aleph.json`, `/` 보안 헤더. 위 A/B 수동 실측을 번들 실행 과정에서 재현했다고 기록하지 않습니다.
- 옛 공개 Git 커밋·Vercel 배포에는 가상 자료가 남을 수 있으며 실제 개인정보는 넣지 않습니다. 공식 심판의 성공 판정은 별도입니다.

### 재실행과 제출 묶음

1. `npm.cmd run build -- --local`, `npm.cmd run test:r5`, `npm.cmd run test:package`로 기존 빌드와 회귀 검사를 실행합니다.
2. 배포가 최신 Git 커밋인지 `/aleph.json`에서 확인하고, 비로그인 목록의 401 JSON 오류, `/data.json` 404, 첫 화면의 `nosniff`를 확인합니다. 로그인된 A/B의 본인 조회와 상대 UUID GET 거부를 점검합니다. 5단계 후에도 화면에서 재검증합니다.
3. `bundle-notes.json`의 `explanation`을 4단계의 실제 구현 내용으로 갱신하되 토큰·이메일·메모 본문은 제외합니다. `4단계 저장점`을 커밋·Push한 다음 `npm.cmd run bundle`을 실행해 `artifacts/submission.json`의 실제 결과와 출력 요약을 확인합니다. 두 파일(`bundle-notes.json`, `artifacts/submission.json`)은 Git에 올리지 않습니다.
