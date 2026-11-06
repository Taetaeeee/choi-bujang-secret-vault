# BYTE BACK 방어전 시작 틀 R5

이 저장소는 BYTE BACK 방어전 R5의 1단계에서 만들어졌고, 현재 `aleph.config.json`의 단계는 **12**입니다. 처음 공개했던 메모 네 건은 모두 실습용 가상 자료이며, 현재는 학습용 Supabase DB로 옮기고 최신 소스의 정적 JSON에서 제거했습니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 1단계 기록 — 학생이 했던 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

1단계 당시 `/`에서 점령된 가상 자료실을 볼 수 있었고 `/data.json`에도 같은 가상 메모가 공개됐습니다. 2단계 최신 배포에서는 정적 `/data.json`을 더 이상 제공하지 않습니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 현재 본인 GitHub 저장소 및 운영 Vercel 주소로 설정되어 있고, `step`은 12입니다. 제출 묶음 실행 전 Git 원격·실제 배포와 다시 대조합니다.

로컬에서 정적 화면/빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. `src/attack-check.mjs`는 5단계의 공개 경로 및 Supabase 원본 API에 직접 비인증 요청을 보내 결과를 기록합니다. 이 학생 자기 점검은 공식 심판 판정이 아닙니다.

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
## 5단계 저장점 (2026-10-28)

### 현재 기능과 변경 범위

- 브라우저의 메모 GET·POST·PUT·DELETE는 모두 `/api/notes` 및 `/api/notes/:id`의 Vercel 서버 함수로 전달됩니다. 브라우저에서 Supabase 메모 테이블을 직접 읽거나 수정하는 호출은 발견되지 않아 화면·로그인 코드는 변경하지 않았습니다.
- Supabase Auth의 로그인·로그아웃과 세션 관리는 브라우저에 유지하고, 기존 `src/verify-login.mjs`의 토큰 검증과 서버 API의 `owner_id` 소유자 검사는 그대로 유지합니다. 서버 전용 `SUPABASE_SECRET_KEY`는 Vercel 서버 환경변수로만 관리합니다.
- `public.vault_user_notes` 한 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 테이블 권한을 `REVOKE ALL`로 회수했습니다. 기존 RLS 정책 정의는 삭제하지 않았으며 다른 테이블의 권한은 건드리지 않았습니다.
- SQL Editor의 `information_schema.role_table_grants` 및 `has_table_privilege` 검사에서 회수 전 authenticated CRUD 4개 권한을 확인했고, 회수 후 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER가 `false`, 개별 GRANT는 `NULL`임을 확인했습니다.
- 원본 자료 경로 `https://tlfyygqfuqqfnmtxkghb.supabase.co/rest/v1/vault_user_notes`를 `aleph.config.json`의 `originalApiUrl`에 쿼리 없이 기록하고 `step: 5`로 설정했습니다. 기존 `allowedRoutes` 5개, `identityProvider`, `judgeIssuer`는 보존했습니다.

### 확인된 동작과 주의사항

- 권한 회수 전 A 계정의 조회·추가·수정·삭제를 화면에서 확인했습니다. 회수 후에도 A 자기 메모 조회와 별도 시험 메모의 추가·수정·삭제가 유지됨을 화면으로 확인했습니다. 기존 A 메모는 보존했습니다.
- 공개용 `sb_publishable_` 키만 사용한 원본 Supabase Data API GET 실측 결과는 **HTTP 401**이었습니다. 서버 함수가 대신 DB에 접근할 수 있는 것과 직접 Data API가 차단되는 것은 별도의 검사입니다.
- 4단계 A/B 소유권 검사 결과는 유지되지만, 5단계 권한 회수 후 B 계정의 CRUD 및 교차 접근 요청은 이 저장점에서 별도로 재실행하지 않았습니다. 자기 점검은 실제로 호출한 공개 경로 및 원본 GET만 기록하며, 인증 세션 시험을 자동 재실행한 것으로 주장하지 않습니다.
- 보너스 조건의 `allowedRoutes`는 5개를 유지하고 첫 화면의 `X-Content-Type-Options: nosniff`도 유지합니다. 브라우저의 공개 `sb_publishable_` 키는 Supabase Auth를 위해 남아 있으므로 **공개 키 완전 제거 보너스는 달성했다고 주장하지 않습니다.**

### 재실행 및 제출

1. `npm.cmd run build -- --local`, `npm.cmd run test:r5`, `npm.cmd run test:package`로 회귀 검사를 실행합니다. 운영 배포의 실제 메모 기능은 A 로그인 후 별도 확인합니다.
2. Vercel의 `/aleph.json`에서 `step: 5`와 커밋 일치를 확인하고, 공개 `/data.json` 404, 비로그인 `/api/notes`의 401 JSON, `/`의 `nosniff`, 원본 `originalApiUrl`에서 anon 공개 키 GET 401/403을 재점검합니다.
3. `bundle-notes.json`의 `explanation`을 5단계의 확인된 내용으로만 갱신하고, `5단계 저장점` 커밋 및 Push 후 `npm.cmd run bundle`을 실행합니다. `bundle-notes.json`과 `artifacts/submission.json`은 Git에 커밋하지 않습니다. 공식 심판 점수는 별도입니다.

## 보너스 xdr-01 저장점 (2026-10-30)

- 대상: `xdr/fixtures/brute-force.json`의 수업용 Wazuh 형식 경보 28건. 원본 경보는 변경하지 않았습니다.
- 구현: `xdr/brute-force/read-alerts.mjs` (5개 필드 추출), `patterns.json` (MITRE ATT&CK T1110.001 / T1110.003), `decide.mjs` (독립적인 block / alert / record 판단), `respond.mjs` (알림과 임시 거부 규칙 생성).
- 로컬 확인: `npm.cmd run xdr:run -- brute-force`로 `result.json` 생성. `block` 10건, `alert` 9건, `record` 9건이고 정상 이벤트 `bf-20`~`bf-28`의 오차단은 0건이었습니다.
- 대응 모듈: 근거 경보 ID와 만료 시각이 있는 15분 유효 규칙을 준비하고, 모듈 검사에서 공격 `deny`, 정상·만료 `continue`를 확인했습니다. `continue`는 기존 ZTNA의 최종 허용을 의미하지 않습니다.
- 한계: 현재 SDP 판정 요청 계약에는 신뢰할 수 있는 출발지 IP가 없으므로 실제 운영 ZTNA 엔진의 자동 IP 차단 연동은 구현·검증되지 않았습니다. `respond.mjs` 규칙은 `staged_only`이며 `src/decider.mjs`의 기존 규칙은 변경하지 않았습니다.
- 재현: 저장소 루트에서 `npm.cmd run xdr:run -- brute-force` 실행 후 `xdr/brute-force/result.json`의 `counts`와 각 `decisions`를 확인합니다. 심판은 결과 파일만 믿지 않고 `decide.mjs`를 독립적으로 재실행합니다.
- 관리: `xdr/alerts.log`, `xdr/*/deny-rules.json`은 실행 중 생성되는 자료이므로 Git 제출에서 제외했습니다. 실제 비밀값이나 개인정보는 제출하지 않습니다.

## 보너스 xdr-02 저장점 (2026-11-02)

- 대상: `xdr/fixtures/web-injection.json`의 수업용 Wazuh 형식 경보 26건. 원본 경보는 변경하지 않았습니다.
- 구현: `xdr/web-injection/read-alerts.mjs` (5개 필드 추출), `patterns.json` (MITRE ATT&CK T1190 기반 SQL 주입·스크립트 주입·경로 이탈), 독립형 `decide.mjs`, 알림과 임시 거부 규칙을 준비하는 `respond.mjs`.
- 로컬 확인: `npm.cmd run xdr:run -- web-injection`으로 `result.json`을 갱신해 `block` 8건, `alert` 9건, `record` 9건을 확인했습니다. 정상 이벤트 `wi-18`~`wi-26`의 오차단은 0건이었습니다.
- 대응 시험: `respond.mjs` 실행에서 `staged_only` 거부 규칙 7개와 로그 17줄을 생성했습니다. 로컬 검사에서 공격 `deny`, 정상·만료 `continue`를 확인했으며 `continue`는 ZTNA의 최종 허용이 아닙니다.
- 한계: 현재 ZTNA 판정 요청 계약에 신뢰된 출발지 IP가 없으므로 실제 운영 ZTNA 자동 차단 연동은 구현·검증하지 않았습니다. `src/decider.mjs`의 기존 규칙은 변경하지 않았습니다.
- 재현: 저장소 루트에서 `npm.cmd run xdr:run -- web-injection` 실행 후 `xdr/web-injection/result.json`의 `counts`와 `decisions`를 확인합니다. 심판은 `decide.mjs`를 격리 환경에서 다시 실행합니다.
- 관리: `xdr/alerts.log`, `xdr/*/deny-rules.json`은 생성 자료로 Git에 포함하지 않습니다. 실제 비밀값·개인정보는 제출하지 않습니다.

## 6단계 제작 3 — 등록 기기 판정기 로컬 확인 (2026-11-02)

이번 제작에서는 **설치 프로그램이나 새 인증서·개인키 없이** 기존 `src/decider.mjs`의 기기 등록 판정을 로컬 가상 요청으로 점검합니다. 이 기록은 6단계 **최종 저장점이나 공식 심판 결과가 아닙니다.**

### 확인 순서 (Windows PowerShell)

1. 저장소 루트에서 작업합니다. `src/decider.mjs`에는 `RULE_IDS`의 `device_registered` 규칙이 구현돼 있어야 합니다.
2. 다음 명령으로 제공된 로컬 시험을 실행합니다.

   ```powershell
   npm.cmd run decider:test
   ```

3. 다음 두 항목이 모두 `통과`인지 확인합니다.

   ```text
   통과 · 등록 기기의 정상 요청
   통과 · 미등록 기기의 가상 요청
   이 명령은 가상 요청으로 연습하며 심판 통과 증거가 아닙니다.
   ```

4. `decider:test`는 판정 및 이유 코드의 기대값을 **검사하지만 출력에는 '통과'만 표시**합니다. 실제 `decision`과 `reasonCode`를 눈으로 확인하려면 아래 명령을 별도로 실행합니다. 가상 요청만 사용합니다.

   ```powershell
   node --input-type=module -e "import { decide } from './src/decider.mjs'; import { fixtureRequests } from './scripts/fixture-7.mjs'; const { normal } = fixtureRequests(); for (const [name, input] of [['등록 기기', normal], ['미등록 기기', { ...normal, deviceRegistered: false }]]) { const result = await decide(input); console.log(name + ': ' + result.decision + ' / ' + result.reasonCode); }"
   ```

   예상 출력:

   ```text
   등록 기기: allow / approved
   미등록 기기: deny / device_not_registered
   ```

5. 시험 결과가 예상과 다르면 `src/decider.mjs`의 `deviceRegistered` 조건, 요청 경로 및 응답의 다섯 항목을 점검합니다. **미등록 기기의 실제 공격 시험은 심판이 수행**하며, 로컬 가상 시험을 운영 환경 차단의 증거로 기록하지 않습니다.

### 이번 제작의 검증 범위

- `npm.cmd run decider:test`의 제공 가상 요청 2건은 로컬에서 통과했고, 별도 응답 확인에서 등록 기기는 `allow / approved`, 미등록 기기는 `deny / device_not_registered`를 확인했습니다.
- `deviceRegistered` 값은 운영 엔진이 확인해 전달하는 필드입니다. `request.device`, `request.identity`, `request.role` 같은 계약 밖 필드는 사용하지 않습니다.
- 이번 제작에서 프로그램 설치, 인증서·CA·서명 키 생성, 운영 심판 판정은 수행하지 않았습니다.


## 6단계 저장점 (2026-11-02)

- **구현:** `src/decider.mjs`에 `device_registered`를 추가하여 반 엔진이 확인한 `request.deviceRegistered`가 `true`인 자료실 읽기 요청만 `allow / approved`로 판단합니다. 미등록 또는 등록값 누락은 `deny / device_not_registered`로 거부합니다. 그 외 요청에는 기존 `starter.deny`를 유지합니다.
- **로컬 확인:** `npm.cmd run decider:test`에서 등록·미등록 가상 요청 2건을 통과했고, 직접 출력에서 등록 `allow / approved`, 미등록 `deny / device_not_registered`를 확인했습니다. 미등록 기기의 실제 공격 시험과 공식 심판 결과는 아직 없습니다.
- **설정:** `aleph.config.json`의 `step`을 6으로 변경하고 기존 저장소·배포 주소·인증 발급자·허용 경로·원본 API 주소를 유지합니다.
- **제출 점검:** `src/attack-check.mjs`는 1~5단계의 실제 공개 경로 검사를 보존하며, 6단계에 대한 로컬 가상 기기 판정 결과를 추가로 기록합니다. 가상 기기 검사를 실제 운영 차단 증거로 사용하지 않습니다.
- **한계:** 이 단계에서는 새로운 접속 프로그램, CA, 인증서, 서명 키 또는 기기 등록 UI를 만들지 않았습니다. 실제 엔진이 미등록 기기를 선차단하는지 여부는 로컬 판정기로 검증하지 않습니다.
- **다시 실행:** 저장소 루트에서 `npm.cmd run decider:test`, `npm.cmd run build -- --local`, `npm.cmd run test:r5`, `npm.cmd run test:package`로 점검합니다. 커밋 후 배포가 최신 커밋에 도달했는지 `/aleph.json`을 확인하고 `npm.cmd run bundle`을 실행합니다. 제출 JSON과 비밀 설정값은 Git에 포함하지 않습니다.


## 7단계 저장점 (2026-11-03)

- **현재 기능:** 앞선 단계의 Supabase Auth 로그인, 본인 메모 CRUD·소유자 검사, 원본 Data API 직접 접근 제한 및 등록 기기 읽기 판정 규칙을 유지합니다.
- **제작 1 — 입력 검사:** `docs/DECIDER_REQUEST.md`의 `signals`·`recentEvents` 계약만 사용합니다. `source: none`은 관측 정보 없음, `judge_fixture`는 가상 시험 신호로 구분합니다. 출처가 불명확하거나 형식이 잘못된 입력은 기존 거부 규칙으로 처리하며, 클라이언트 헤더를 위치·네트워크 증거로 승격하지 않습니다.
- **제작 2 — 복합 사건:** 등록된 기기의 자료실 읽기 요청에서 가상 신호의 새벽 0~5시, 낯선 네트워크(`unusual`), 최근 300초 이내 `risk_signal` 10회 이상이 함께 나타나면 `step_up / step_up_required`를 반환합니다. 지역 하나만으로 차단하지 않습니다. 인증이 확인되고 경과 시간이 300초 이내이면 `allow / approved`입니다. 이 수치는 실습용 기준이며 `risk_signal.count`는 실제 메모 읽기 횟수를 뜻하지 않습니다.
- **제작 3 — 계약·로컬 검증:** `stepUp.verified`와 `stepUp.authAgeSeconds` 필드가 있으나, 실제 자료실에서 동일 계정 재로그인 및 자료 차단이 연동되는지는 확인되지 않았습니다. 학생의 로컬 가상 요청에서 `npm.cmd run decider:test` 4건 통과, `npm.cmd run fixture:7` 정상 `allow`·복합 이상 `step_up`, 인증 확인 전 `step_up`·60초 `allow`·301초 `step_up`을 확인했습니다. 이는 공식 심판 결과나 운영 자료 차단 실측이 아닙니다.
- **설정 및 제출:** `aleph.config.json`의 `step`은 7이고 기존 저장소·Vercel 주소·인증 발급자·허용 경로·원본 API 주소·`judgeIssuer`는 유지합니다. `src/attack-check.mjs`는 공개 경로 실측 결과와 별도로 7단계 가상 판정 결과를 기록합니다. 새 단계의 Vercel 배포 확인과 공식 심판 결과는 아직 미확인입니다.
- **재실행:** 저장소 루트에서 `npm.cmd run decider:test`, `npm.cmd run fixture:7`, `npm.cmd run test:r5`, `npm.cmd run test:package`, `npm.cmd run build -- --local`로 검사합니다. 저장점 커밋 후 `npm.cmd run bundle`을 실행하고 Git에 포함되지 않는 `artifacts/submission.json`의 예상·관측 결과를 확인합니다. 실제 결과와 미실행 검사는 구분하고 토큰·키·메모 본문은 제출하지 않습니다.


## 8단계 저장점 (2026-11-03)

- **제작 1 — 자원 ID 구분:** `src/resource-id.mjs`에서 개인 메모(`personal-note`)와 강사 공지(`instructor-notice`)의 자원 ID를 분리했습니다. 기존 `/api/notes`와 `/api/notes/:id` 주소, DB 메모 ID, 화면 메뉴와 응답 본문 형태는 유지합니다. `api/notes.js`에는 서버가 결정한 `X-Resource-ID` 헤더를 추가했습니다. 공지 데이터·API·메뉴는 새로 만들지 않았습니다.
- **제작 2 — 구역별 판정:** `src/decider.mjs`는 엔진이 검증한 `service`·`method`·`path`·`route`를 사용합니다. 단건 메모 `GET /notes/:id`와 반 공지 `GET /notices`, `GET /notices/:id`만 허용 후보로 두고, 메모 목록/쓰기·공지 쓰기·강사 자료·알 수 없는 경로와 쿼리 기능 요청을 거부합니다. 메모 ID가 UUID인지 판정기에서 강제하지 않습니다. 등록 기기 확인 및 7단계 복합 이상 요청의 `step_up`은 유지합니다. 반 공지 경로는 현재 **정책용 가상 경로**이며 운영 공지 API는 없습니다.
- **제작 3 — API 소유자 확인:** 기존 `api/notes.js`에서 서버 검증 사용자와 DB에서 읽은 `owner_id`를 재확인합니다. 목록에 타인 행이 섞이면 403, 타인 메모 단건/수정/삭제는 404를 반환합니다. 생성 직후 DB에 저장된 소유자도 비교하고, 요청 본문이나 메뉴의 `role`을 인가 근거로 사용하지 않습니다. 서버 측 강사 권한 저장소가 없어 강사 관리 API는 미구현입니다.
- **정책 설정:** `aleph.config.json`은 `step: 8`입니다. `allowedRoutes`는 `GET /api/notes/:id`, `GET /api/notices`, `GET /api/notices/:id`만 포함합니다. 기존 화면 호환을 위한 `/api/notes` 목록·쓰기 API는 유지하지만 판정기 허용 경로에서는 제외합니다. 현재 서버 API와 엔진 판정기의 **실제 연동 경로는 확인되지 않았습니다**.
- **검증:** 사용자 PC에서 자원 ID 3건, 구역 판정 7건, API 소유권 단위 시험 3건, 기존 판정기 4건, 패키징 3건이 통과했습니다. 로컬 테스트는 심판이나 A/B 실제 계정 직접 API 요청의 증거가 아닙니다. 실제 A/B 계정 접근·공지 관리 권한 검증은 미실행으로 기록합니다.
- **제출 점검:** `src/attack-check.mjs`는 비로그인 공개 경로 및 원본 Data API의 실제 HTTP 결과와 별도로 8단계 가상 구역/소유권 검사 결과를 기록합니다. `npm.cmd run decider:test`, `npm.cmd run fixture:7`, `node --test test/resource-id.test.mjs test/stage8-zones.test.mjs test/stage8-api-access.test.mjs`, `npm.cmd run test:r5`, `npm.cmd run test:package`, `npm.cmd run build -- --local`로 회귀 확인합니다. 저장점 커밋과 배포 확인 후 공개 키 환경변수를 현재 PowerShell 세션에 설정하여 `npm.cmd run bundle`을 실행합니다. 제출 JSON·토큰·키·본문은 Git에 넣지 않습니다.


## 9단계 저장점 (2026-11-03)

- **기존 기능 보존:** Supabase Auth 로그인·본인 메모 CRUD·소유권 재검사, 6~8단계 판정기의 등록 기기·추가 인증·자료 구역 규칙, XDR 실습을 유지합니다. `src/decider.mjs`, 메모 API, 기기 권한, DB 자료는 이번 단계에서 수정하지 않았습니다.
- **제작 1 — 탐지 사건 입력:** `docs/DETECT_EVENTS.md`에 정의된 `at`·`method`·`identity.sub`만 읽고 시각을 숫자로 변환합니다. 불완전한 사건은 원본 내용을 출력하지 않는 고정 오류로 처리합니다. 기기·IP·지역·토큰·메모 본문과 실명은 탐지 근거에 사용하지 않습니다.
- **제작 2 — `burst_read`:** 가명 사용자별 GET 사건의 `at`를 정렬하고 연속된 10분(양 끝 포함) 구간의 조회가 **120건을 초과**하면 탐지합니다. 정확히 120건, 다른 사용자끼리 합산한 요청, GET이 아닌 요청, 10분 밖에 분산된 요청은 회수 제안 대상이 아닙니다.
- **제작 3 — 반환 형식:** 정상은 `{ action: 'observe' }` 한 키만, 폭주는 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject: sub }` 세 키만 반환합니다. 탐지 결과는 접속 **회수 제안**이지 실제 세션·기기 권한 회수는 아닙니다.
- **설정 및 범위:** `aleph.config.json`의 `step`은 **9**이고 저장소·Vercel 배포 주소, Supabase Auth 설정, `allowedRoutes`, `originalApiUrl`, `judgeIssuer`는 기존 값을 유지합니다. 운영 엔진의 사건 전달·회수 집행 경로는 이번 단계에서 구현하거나 검증하지 않았습니다.
- **로컬 검증:** 사용자 PC에서 제작 1~3 단위 시험 **13/13**, `npm.cmd run detect:test` **6/6**, 기존 `npm.cmd run decider:test` **4/4** 통과. 가상 사건 결과이며 실제 운영 접속 회수나 공식 심판 결과가 아닙니다.
- **재검증·제출:** `node --test test/stage9-input.test.mjs test/stage9-burst.test.mjs test/stage9-output.test.mjs`, `npm.cmd run detect:test`, `npm.cmd run decider:test`, `npm.cmd run test:r5`, `npm.cmd run test:package`, `npm.cmd run build -- --local`을 다시 실행합니다. `src/attack-check.mjs`는 기존의 비인증 실제 HTTP 점검과 6~8단계 가상 검사를 보존하고 9단계 가상 탐지 기록을 추가합니다. 저장점 커밋·실제 배포 단계/커밋 확인 후 `npm.cmd run bundle`을 실행합니다. 제출 JSON·공개 키·비밀값·가상 메모 본문은 Git에 포함하지 않습니다.

## 10단계 제작 3 — B 계정 가상 메모 한 건 복원 연습 (2026-11-04)

- **서비스·POST 경로:** `notes` · **`POST /api/restore`** (`api/restore.js`). 요청 본문은 `{ "id": "bbbbbbbb-2222-4222-8222-000000000010" }` 한 필드만 허용하며, 인증된 시험 계정 B의 소유권을 확인합니다. 판정기의 `allowedRoutes`에는 추가하지 않았으며 이 경로가 일반 메모 읽기 권한을 확장하지 않습니다.
- **복원 대상 ID:** **`bbbbbbbb-2222-4222-8222-000000000010`**. 소유자는 **시험용 B 가상 UUID** `bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb`입니다. 실제 Supabase B 계정 ID가 아니며, 실제 사용자 토큰·본문을 여기에 기록하지 않습니다.
- **비공개 백업:** 로컬 실행 시 `artifacts/stage10/private/b-note.json` 및 별도 SHA-256 파일을 생성합니다. 해당 폴더는 Git에서 제외되며 사본의 메모 내용은 실행 시 임의로 생성한 **가상 데이터**입니다. `src/decider.mjs`, `aleph.config.json`, 운영 DB와 다른 메모를 수정하지 않습니다.
- **복원 방식:** 안전 정책 백업 해시와 비공개 가상 메모 사본 해시를 확인하고, 요청의 ID·검증 신원 B·저장된 소유자·본문 SHA-256을 비교한 뒤 `artifacts/stage10/drill/virtual-notes.json`의 **선택된 한 건만** 복원합니다. 다른 A/B 가상 메모와 기존 `artifacts/stage10/audit.jsonl`은 보존하고 복원 사건만 뒤에 추가합니다. 임의 owner_id·role·본문이 포함된 요청은 받지 않습니다.
- **로컬 실행:** 먼저 10단계 제작 1의 `backup`, 제작 2의 `restore --confirm`을 마친 뒤 `node scripts/stage10-note.mjs prepare` → `plan` → `post` → `verify`를 실행합니다. `post`는 `127.0.0.1`의 로컬 POST 핸들러로 **가상 B 신원**만을 시험하며 실제 Supabase DB에 쓰지 않습니다. `node --test test/stage10-note-restore.test.mjs`로 A 거부, 잘못된 ID·소유자·해시 거부와 다른 메모·감사 이력 보존을 확인합니다.
- **한계:** Vercel에는 Git에서 제외한 비공개 로컬 백업·시험 데이터가 배포되지 않으므로 공개 POST 경로는 복구 가능한 사본이 없으면 **503으로 중단**합니다. 이 단계는 운영 데이터나 실제 B 계정의 복원을 증명하지 않습니다. 현재 Supabase RLS/GRANT 정책 역시 README의 과거 기록만 보존했으며 운영 DB 실측 백업이 아닙니다.

## 10단계 제작 4 — 복원 뒤 1~9단계 정상·금지 요청 재시험 순서 (2026-11-04)

**목적:** 검증된 사본으로 복원한 정책과 시험 B 메모가 유지되는지 먼저 확인하고, 1~9단계에서 허용한 요청과 거부한 요청이 그대로 판정되는지 **아래 순서대로 다시 실행**합니다. 이 기록은 실행 절차입니다. **2026-11-04 사용자 PC에서 로컬 재실행을 확인**했으며, 이전 단계의 과거 통과 이력을 이번 시험 결과로 대신하지 않습니다. 실제 운영 환경 수동 검사는 미실행입니다.

**재실행 전 상태:** 제작 1에서 복원 기준 커밋 `e6334b2`의 정책 사본을 SHA-256으로 검증했고, 제작 2에서 시험 정책 한 줄을 되돌렸습니다. 제작 3에서는 `notes` · `POST /api/restore`로 시험 B의 가상 메모 `bbbbbbbb-2222-4222-8222-000000000010` 한 건을 로컬에서 복원했습니다(사용자 제공 실행 결과). 백업·감사 자료는 Git 제외 경로 `artifacts/stage10/`에 보존합니다. **이미 복원했으므로 `backup`, `simulate`, `prepare`, `post`, `restore --confirm`을 재실행하지 않습니다.** 새 변조·백업 생성은 별도 연습에서만 진행합니다.

### 0. 복구 상태와 보존 범위 먼저 검증 — 로컬 검증 통과

```powershell
cd C:\Users\User\Projects\choi-bujang-secret-vault
git status --short
git diff -- src/decider.mjs aleph.config.json api/notes.js
node scripts/stage10-policy.mjs verify
node scripts/stage10-restore.mjs retest
node scripts/stage10-note.mjs verify
```

- **정상 기대:** 검증 사본의 SHA-256 일치, 시험 정책 원상복원, A의 정상 요청 허용, B의 A 메모 소유권 검사 거부, 미등록 기기·다른 서비스 거부, 복원된 B 메모의 ID·소유자·내용 해시 일치 및 다른 가상 메모 2건 유지.
- **확인 범위:** `git status --short`에는 10단계 미커밋 파일이 표시될 수 있습니다. `git diff`의 세 **기존 운영 파일**은 변경이 없어야 합니다. `retest`는 가상 요청이고 `verify`는 로컬 시험 자료만 검사합니다. 감사 이력은 `artifacts/stage10/audit.jsonl`에 추가되며 기존 항목을 삭제해서는 안 됩니다.
- **중단:** 백업·해시 검증, 복원 검증 또는 소유권 검사가 하나라도 실패하면 뒤의 시험을 진행하지 않습니다. 원본·백업을 덮어쓰거나 Git 이력을 강제로 되돌리지 않습니다.

### 1. 1~2단계 — 공개 파일 잔존·초기 회귀 검사 (로컬 통과)

```powershell
npm.cmd run test:r5
npm.cmd run test:package
npm.cmd run build -- --local
```

- **정상 기대:** 테스트 통과, 로컬 빌드에서 공개 `data.json` 제외. **금지 기대:** 기존 가상 메모가 정적 공개 파일로 다시 배포되지 않음. 실제 운영 URL의 `/data.json` 404 여부는 아래 별도 수동 점검 전까지 **미실행**입니다.

### 2. 3~5단계 — 로그인·메모 소유권·DB 직접 접근 (로컬 소유권 검사 통과)

```powershell
node --test test/stage8-api-access.test.mjs
```

- **정상 기대:** 서버가 검증한 가상 A 신원으로 A 소유 메모 허용. **금지 기대:** 가상 B 신원으로 A 소유 메모 거부, 역할·소유자를 본문에서 조작한 요청 거부, 타인 행이 포함된 목록 거부.
- 이 로컬 소유권 함수 시험은 **실제 로그인·운영 API·RLS/GRANT 검증이 아닙니다.** 실제 A/B 계정으로 A 자기 메모 CRUD와 B→A 단건 GET/PUT/DELETE 거부(기대 HTTP 404), 비로그인 `/api/notes`(기대 401), Supabase 원본 Data API 직접 조회 차단(기대 401/403), 운영 DB 권한의 읽기 전용 확인은 **모두 미실행**으로 남깁니다. 비밀키·토큰·실제 본문은 출력하거나 Git에 넣지 않습니다.

### 3. 6~7단계 — 등록 기기와 복합 이상 접속 (가상 시험 통과)

```powershell
npm.cmd run decider:test
npm.cmd run fixture:7
```

- **정상 기대:** 등록된 기기의 허용 경로 GET은 `allow`; 재인증이 확인된 가상 복합 이상 요청은 `allow`. **금지·추가 확인 기대:** 미등록 기기 `deny / device_not_registered`, 가상 복합 위험의 미인증 요청 `step_up / step_up_required`.
- `fixture:7`은 가상 신호만 사용합니다. 운영 엔진의 실시간 기기 인증·재로그인 연결은 **미실행**입니다.

### 4. 8단계 — 자료 구역·경로 및 API 소유권 (로컬 통과)

```powershell
node --test test/resource-id.test.mjs test/stage8-zones.test.mjs test/stage8-api-access.test.mjs
```

- **정상 기대:** 개인 메모 단건 GET 및 반 공지 읽기는 **판정기 가상 요청에서** 허용. **금지 기대:** 메모 전체 목록/쓰기 경로, 공지 쓰기, 강사 자료, 쿼리 우회·알 수 없는 경로, 타인 메모는 거부.
- 반 공지는 판정 정책용 경로로 실제 운영 공지 API가 구현됐다는 뜻이 아닙니다. 운영 A/B API 교차 접근 실측은 **미실행**입니다.

### 5. 9단계 — 조회 폭주 탐지와 정상 요청 유지 (가상 시험 통과)

```powershell
node --test test/stage9-input.test.mjs test/stage9-burst.test.mjs test/stage9-output.test.mjs
npm.cmd run detect:test
```

- **정상 기대:** 같은 사용자의 10분 이내 GET 120건, 다른 사용자 혼합, 10분 밖에 흩어진 요청은 `observe`. **이상 요청 기대:** 같은 사용자 GET 121건 이상은 `propose_revocation / burst_read`로 **회수 제안만** 반환.
- 운영 엔진이 실제 세션을 회수했는지에 대한 검증은 **미실행**입니다.

### 6. 제작 1~3 복구 기능 회귀 검사 (로컬 29/29 통과)

```powershell
node --test test/stage10-policy.test.mjs test/stage10-restore.test.mjs test/stage10-note-restore.test.mjs
```

- **정상 기대:** 검증된 사본 복원, 시험 B 메모 한 건 ID·소유자·내용 해시 일치, 다른 두 메모와 기존 감사 이력 보존. **금지 기대:** 해시 위조·사본 누락 시 중단, A의 B 메모 복원 시도 거부, 미승인 정책 복원 거부, 중복 복원 거부.
- 테스트는 독립된 임시 가상 사본을 만들며, 실제 운영 DB 정책 복원을 검증하지 않습니다. 기존 **29/29 통과**를 확인했고, 이번 제작 4에서도 **29/29를 다시 실행하여 통과**했습니다. 운영 DB 복원 실측은 미실행입니다.

### 7. 운영 환경의 수동 확인 및 결과 기입 (모두 미실행)

| 재확인할 사항 | 정상·거부 기대 | 제작 4 관측 |
|---|---|---|
| 배포의 정적 `/data.json` | HTTP 404, 공개 메모 재노출 없음 | **미실행** |
| 비로그인 `/api/notes` | HTTP 401 | **미실행** |
| 실제 A 계정의 자기 메모 CRUD | 정상 사용 가능 | **미실행** |
| 실제 B 계정의 A 메모 GET·PUT·DELETE | HTTP 404 등 소유권 차단 | **미실행** |
| Supabase 원본 Data API의 비인가 조회·GRANT/RLS 현행 상태 | 직접 접근 차단, 읽기 전용 정책 확인 | **미실행** |
| 실제 ZTNA 기기 차단·step_up 및 9단계 세션 회수 | 운영 엔진의 별도 증거 필요 | **미실행** |
| 운영 POST `/api/restore` | 비공개 시험 사본 미배포로 실제 자료 복원 불가(503 예상); 운영 호출 미실행 | **미실행** |

**판정 기록 원칙:** 위 명령을 실행한 뒤 각 출력에서 실제 확인한 결과만 기입합니다. 통과하지 않은 항목과 실행하지 않은 운영 수동 시험은 계속 **미실행**으로 둡니다. 공식 심판 결과·로컬 가상 시험·운영 API 실측을 혼동하지 않습니다. 현재 `aleph.config.json`의 `step`은 10이며, 제출 묶음은 저장점 커밋·실제 배포 확인 후 생성합니다.


## 10단계 저장점 (2026-11-04)

- **복원 대상 및 사전 정책 사본:** 백업 기준은 `e6334b2`이며, `src/decider.mjs`, `aleph.config.json#allowedRoutes` 3개, README의 과거 DB 정책 근거를 `artifacts/stage10/verified-policy.json` 및 SHA-256으로 로컬에서 검증했습니다. **DB 정책 근거는 과거 기록이며 현재 운영 RLS/GRANT의 실측 백업이 아닙니다.** 안전 사본·가상 메모 본문은 Git에 포함하지 않습니다.
- **제작 1 — 가상 변조:** 시험 사본 `artifacts/stage10/drill/decider.mjs`에서 기기 등록 조건 **한 줄만** 변경하고 정책 사본과의 차이를 표시했습니다. 원본 판정기와 운영 DB에는 쓰지 않았습니다.
- **제작 2 — 안전 정책 복원:** 실행 전 대상·해시·변경 범위의 계획을 제시하고, `restore --confirm`에서 시험 사본을 백업의 원래 규칙으로 복원했습니다. 기존 감사 이력은 남기고 시작·완료 사건만 추가했습니다. 복원 후 가상 A 정상 허용, B→A 소유권 거부, 미등록 기기·강사 자료 거부 4항목을 재확인했습니다.
- **제작 3 — B 가상 메모 단건 복원:** `notes` · `POST /api/restore`, ID `bbbbbbbb-2222-4222-8222-000000000010`을 로컬 가상 B 신원으로 복원했습니다. 비공개 사본의 ID·소유자·내용 SHA-256이 일치했고 다른 가상 메모 2건과 감사 이력이 유지됐습니다. 운영 Vercel에는 비공개 사본이 없어 이 경로로 **실제 DB 메모를 복원할 수 없으며**, 운영 복구 성공으로 기록하지 않습니다.
- **제작 4 — 회귀 검사:** 사용자 PC에서 정책 백업 `verify`, 복원 `retest`, 메모 `verify` 통과, `test:r5` **2/2**, 패키징 테스트는 신규 `api/restore.js`를 목록에 반영한 뒤 **3/3**, API 소유권 **3/3**, 8단계 자원·구역·소유권 **13/13**, 9단계 단위 시험 **13/13**과 `detect:test` **6/6**, 10단계 복구 단위 시험 **29/29** 통과했습니다. `decider:test` **4/4**, `fixture:7` 정상 `allow`·복합 이상 `step_up`, `build -- --local` 성공도 확인했습니다. 중복 검사 항목은 합계에 중복 합산하지 않습니다.
- **운영 검증과 제한:** 실제 A/B 운영 계정의 GET·PUT·DELETE 교차 접근, 현행 Supabase RLS/GRANT, 실제 기기/세션 회수와 운영 복원 API 실측은 **미실행**입니다. 제출 설정 `restoreRoute`는 구현된 가상 복원 핸들러의 **`POST /api/restore`**로 지정합니다. 이는 복원 경로를 심판에 알리는 설정이며, 실제 운영 DB 복원 성공의 증거가 아닙니다. `allowedRoutes` 3개, 로그인 발급자, 기존 1~9단계 정책과 `step: 10`은 그대로 유지합니다.
- **재실행:** `node scripts/stage10-policy.mjs verify`, `node scripts/stage10-restore.mjs retest`, `node scripts/stage10-note.mjs verify`, `node --test test/stage10-policy.test.mjs test/stage10-restore.test.mjs test/stage10-note-restore.test.mjs`, `npm.cmd run decider:test`, `npm.cmd run detect:test`, `npm.cmd run test:package`, `npm.cmd run build -- --local`을 검사합니다. 이전 실행에서 생성한 사본은 덮어쓰지 않습니다. 실제 배포의 `step: 10`·커밋 일치 확인 후 `npm.cmd run bundle`로 제출 JSON을 생성합니다. 이때도 실제 HTTP 결과·로컬 가상 검증·미실행 작업을 구분합니다.

### `restore --confirm` 실행 직전 필수 백업 재검증 순서

**검증 목적:** 아래는 제작 2에서 적용한 안전 복원 절차를 명시한 것이며, 이 문서 수정 후 실제 복원을 새로 실행했다는 뜻이 아닙니다. 사전 백업은 Git에서 제외한 로컬 `artifacts/stage10/verified-policy.json` 및 `verified-policy.sha256`입니다.

1. 먼저 `node scripts/stage10-policy.mjs verify`를 실행해 **디스크의 검증 사본과 해시 파일을 다시 읽고** SHA-256 및 사본 내부 항목별 해시를 대조합니다. 백업이 없거나 해시 파일이 누락되거나, SHA-256·사본 구조 검증이 실패하면 **즉시 중단**합니다. 기존 사본을 덮어쓰거나 재생성하지 않습니다.
2. 다음 `node scripts/stage10-restore.mjs plan`을 실행해 검증 사본의 **기준 버전**(`e6334b2060886d836e6b9da11609d1afa2fabbaf`), **백업 SHA-256**(`62c7677f2638d0011fb483288dec1a201b707fe8612f35efb8915d373813d117`), 변경 대상(`artifacts/stage10/drill/decider.mjs`), 복원 전후 내용 해시와 **변경 범위 1줄**을 **실제 쓰기 전에** 확인합니다. 허용 경로 3개와 다른 서비스 규칙, 감사 이력 및 운영 DB는 변경 대상이 아니어야 합니다.
3. 위 두 명령의 검증이 모두 통과하고 대상·버전·해시·변경 범위를 확인한 경우에만 `node scripts/stage10-restore.mjs restore --confirm`을 실행합니다. 해당 명령도 실행 직전에 사본을 다시 읽고 해시와 원본 정책·시험 사본의 예상 변경 범위를 재검사하며, **사본 누락·무결성 오류·설정 불일치·예상하지 못한 변조라면 복원을 시작하지 않습니다.** 복원은 시험 정책 한 건에만 적용하며 기존 감사 기록은 보존합니다.
4. 복원 후 `node scripts/stage10-restore.mjs retest`, `node scripts/stage10-note.mjs verify`로 가상 A의 정상 요청 허용, B의 A 자료 요청 거부 및 B 메모 ID·소유자·내용 해시 일치를 확인합니다. 오류가 발생하면 그 상태에서 중단하고 **통과로 기록하지 않습니다**.

**실행 기록 구분:** 2026-11-04 사용자 PC에서 기존 시험 정책 복원, 백업 재검증 및 가상 요청 재시험 통과 로그를 확인했습니다. **이번 제출 정정 이후의 `restore --confirm` 재실행은 미실행**이며, 이미 복원된 시험 사본을 다시 변조하거나 복원하지 않습니다. 실제 A/B 운영 계정 및 Supabase 운영 DB 정책 복원은 **미실행**입니다. 공식 심판의 가상 메모 한 건 복원 판단은 **확인 못 함(실패 판정 아님)**으로 기록합니다.

## 11단계 저장점 준비 — 설치형 접속 앱 및 기기 승인 (2026-11-04)

- **제작 1:** `public/manifest.webmanifest`와 192·512px 아이콘을 추가하고 기존 자료실을 PWA 접속 화면으로 구성했습니다. 기기 승인 상태와 오프라인 안내를 표시하되, 설치 여부는 승인 근거로 쓰지 않습니다. 개인 자료를 오프라인 캐시에 저장하지 않습니다.
- **제작 2:** `/api/device`에서 로그인 계정의 승인 요청을 `pending`으로 생성하고, 별도 운영자가 Supabase SQL Editor에서 신청자·요청 ID를 확인한 뒤 `approved`로 변경하도록 했습니다. `/api/notes`는 매 요청마다 서버에서 승인 상태 및 자료 소유권을 검사하여 미승인 접근을 차단합니다. 로그인 토큰은 브라우저 저장소 대신 서버만 읽을 수 있는 암호화 HttpOnly 쿠키로 처리합니다.
- **운영 검증:** testA 실습 계정의 동일 브라우저에서 승인 요청 `pending`, 승인 전 `GET /api/notes` **HTTP 403 / DEVICE_NOT_APPROVED**를 확인했습니다. Supabase의 승인 테이블 RLS 활성화와 일반 사용자 직접 조회 권한 없음도 SQL Editor에서 확인했습니다. 운영자 승인 후 DB `approved`, 웹앱 서버 승인 확인 및 `GET /api/notes` **HTTP 200**, 메모 목록·기존 가상 자료 표시를 사용자 화면에서 확인했습니다. 실제 메모 추가·수정·삭제, 다른 기기 및 testB의 교차 요청은 **미실행**입니다.
- **승인 구현 한계:** 기기 식별은 서버 발급 불투명 HttpOnly 쿠키에 바인딩된 승인 기록으로, 하드웨어 기기 증명이 아닙니다. PWA 설치만으로 기기가 승인되거나 브라우저가 스스로 상태를 `approved`로 변경할 수 없습니다. 이 승인 기록과 외부 ZTNA 엔진 `deviceRegistered`의 운영 연동은 **미실측**입니다.
- **기존 단계 보존:** `src/decider.mjs`의 18개 요청 필드 계약과 `RULE_IDS`, 9단계 탐지, 10단계 비공개 백업·감사 이력을 유지합니다. 기존 백업을 재생성하거나 `restore --confirm`을 다시 실행하지 않습니다. 10단계 공식 심판은 커밋 `7349244`로 기본 조건 5개·완결성 가점 3개, **100/100점**을 받았습니다(사용자 제공 결과).
- **설정 및 재실행:** `aleph.config.json`은 `step: 11`로 올리고 `judgeIssuer`, `identityProvider`, 허용 경로 3개, `originalApiUrl`, `restoreRoute`를 보존합니다. `node --test test/stage11-device.test.mjs test/stage11-pwa.test.mjs test/stage11-savepoint.test.mjs test/stage10-savepoint-check.test.mjs` 및 `npm.cmd run decider:test`, `npm.cmd run fixture:7`, `npm.cmd run detect:test`, `npm.cmd run test:r5`, `npm.cmd run test:package`, `npm.cmd run build -- --local`로 재검증합니다. 새 Clone 설치와 Vercel 배포 단계·커밋 확인 후 `npm.cmd run bundle`로 제출 묶음을 생성합니다. 진행 전 아직 실행하지 않은 검사는 통과로 기록하지 않습니다.

## 11단계 포트폴리오 기록 — 설치형 접속 앱과 승인 기기 접근 제어 (2026-11-04)

**공식 평가: 100/100점.** 심판이 **조건 6개 모두 충족, 완결성 가점 3개 획득**을 확인했습니다. 평가 기준 커밋은 [`885cb7b8e7c4`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/885cb7b8e7c4)입니다. 이 기록은 사용자에게 반환된 공식 판정과 로컬·운영 검증을 구분합니다.

### 문제와 목표

기존 자료실에는 로그인 기능이 있었지만, **로그인한 계정이 어느 기기에서 접속하는지 별도 승인하는 흐름**이 필요했습니다. 기존 메모 화면·사용자별 소유권 검사·1~10단계 정책을 유지하면서, 설치 가능한 PWA 접속 앱과 서버 승인 절차를 더하는 것이 목표였습니다.

### 설계 판단 및 구현

- **설치와 권한을 분리:** `public/manifest.webmanifest`, 192·512px 아이콘과 오프라인 안내를 제공했습니다. 앱 설치 여부 자체는 승인 근거로 쓰지 않고, 개인 메모는 오프라인 캐시하지 않습니다.
- **승인 권한을 서버에 유지:** `POST /api/device`는 승인 요청을 Supabase `vault_device_approvals` 테이블에 `pending`으로 저장합니다. 운영자는 SQL Editor에서 승인 요청 번호와 소유자를 확인한 한 건만 `approved`로 바꿉니다. 브라우저에서 직접 승인할 수 있는 공개 API는 두지 않았습니다.
- **API에서 접근 차단:** `/api/notes`는 메모 조회·추가·수정·삭제 전에 서버에서 인증 신원과 기기 승인 상태를 확인합니다. 승인되지 않은 요청을 차단하면서 기존 자료 소유권 검사도 유지했습니다.
- **토큰 취급 개선:** 암호화한 `Secure`·`HttpOnly`·`SameSite=Strict` 세션 쿠키를 사용하고, 서버 발급 기기 식별자의 SHA-256 지문만 DB에 보관하도록 했습니다. Supabase 액세스·갱신 토큰을 브라우저 `localStorage`나 `sessionStorage`에 보관하지 않습니다.
- **이전 단계 보존:** `src/decider.mjs`의 18개 요청 필드 계약 및 `RULE_IDS`, `allowedRoutes`, 9단계 탐지 규칙, 10단계 로컬 비공개 정책 사본과 감사 기록을 유지했습니다.

### 직접 확인한 결과

| 구분 | 검증 결과 |
|---|---|
| 운영 환경 — 승인 전 | testA 기기 승인 요청 `pending` 확인. `GET /api/notes` → **HTTP 403 / `DEVICE_NOT_APPROVED`** |
| 운영 환경 — 승인 후 | Supabase `approved` 및 앱 서버 승인 상태 확인. 같은 브라우저 `GET /api/notes` → **HTTP 200**, 기존 메모와 가상 자료 표시 |
| 11단계·기존 정책 단위 검사 | 사용자 PC에서 관련 테스트 **27/27 통과**, 10단계 정책 사본 SHA-256·복원 가상 요청·가상 메모 보존 검증 통과 |
| 기존 기능 회귀 | `decider:test` **4/4**, `fixture:7` 정상 `allow`·복합 이상 `step_up`, `detect:test` **6/6**, `test:r5` **2/2**, `test:package` **3/3**, 로컬 빌드 성공 |
| 설치 및 배포 | 새 Clone에서 `npm install` 성공(취약점 보고 0건), Vercel `step: 11` 및 커밋 일치 확인 |
| 제출 묶음 | `npm run bundle` 성공. **단계 11 / 변경 파일 6개 / 규칙 5개 / 직접 점검 20개** |
| 공식 심판 | **조건 6개·완결성 가점 3개 모두 확인, 100/100점** (사용자가 전달한 공식 판정) |

### 성과와 검증 한계

기기 설치나 브라우저의 승인 표시를 권한 근거로 삼지 않고 **서버의 승인 기록을 실제 자료 API 접근 조건과 연결**했습니다. 운영 배포에서 동일한 시험 계정·브라우저의 승인 전 **403 → 승인 후 200** 전환을 확인했고, 기존 화면이 유지되는 것도 검증했습니다.

다만 서버 발급 쿠키에 기반한 기기 식별은 **하드웨어 수준 기기 증명이나 쿠키 복제 방지의 증거가 아닙니다**. 다른 기기·testB 교차 접근, 운영 메모 CRUD 전체, 외부 ZTNA 엔진과 실제 기기 승인 상태의 연동은 **직접 실측하지 않았습니다**. 로컬 테스트 및 공식 100점 판정과 별도로 구분해야 합니다.

**관련 근거:** [평가 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/885cb7b8e7c4) · [배포 앱](https://choi-bujang-secret-vault-alpha-drab.vercel.app/) · `docs/STAGE11_DEVICE_APPROVAL.md` · `test/stage11-device.test.mjs` · `test/stage11-pwa.test.mjs` · `test/stage11-savepoint.test.mjs`. 실제 메모 본문·토큰·비밀키·로컬 제출 JSON은 Git에 포함하지 않았습니다.


## 12단계 제작 3 — 탈환 작전실 재현·운영·중지·복구 안내 (2026-11-05)

**재현 기준:** 제작 2까지의 검사 대상은 [커밋 `0f5a896cfd4ea472d292108e2a45722e3fcb8a6c`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/0f5a896cfd4ea472d292108e2a45722e3fcb8a6c)입니다. 12단계 제작 3은 이 상태에 **설명만 추가**하며 기존 판정·탐지·자료실 API, 10단계 복구 사본을 변경하지 않습니다. 이 문서 작성 당시 설정은 `aleph.config.json`의 **`step: 11`**이었습니다. 12단계 저장점에서 `step: 12`로 올리지만 이는 공식 심판 통과 증거가 아닙니다.

### 기능별 출처·책임 구분

| 구성 | 학생 저장소에서 구현·수정한 영역 | 제공 엔진 및 검증 범위 |
|---|---|---|
| 접속 판정 | `src/decider.mjs`의 `RULE_IDS` 5개 및 `decide(request)` 정책, `docs/DECIDER_REQUEST.md` 계약 준수 | **ALEPH SDP 엔진 사용**. 신원·기기·경로 검증 후 계약에 맞는 요청을 판정기로 전달하는 제공 시스템. 로컬 `decider:test`는 가상 사건이며 실제 엔진 집행 증거가 아님 |
| 이상 탐지·회수 | `src/detect.mjs`의 가명 주체별 10분 GET 집계 및 `propose_revocation` 반환 | 사건 형식은 `docs/DETECT_EVENTS.md`에 따른 실습 입력. **회수 제안과 운영 엔진의 실제 세션 회수는 별개**이며 후자는 미실측 |
| 접속 앱·기기 승인 | `public/index.html`, `public/manifest.webmanifest`, `api/auth.js`, `api/device.js`, `src/device-approval.mjs`, `src/vault-session.mjs` | Supabase 인증·승인 테이블과 Vercel 서버 함수 사용. 실제 운영에서 동일 브라우저 승인 전 403·승인 후 200을 확인했으나 하드웨어 기기 증명은 아님 |
| 자료실·접근 제어 | `api/notes.js`, `src/api-resource-access.mjs`의 서버 인증·승인·소유자 검사 | Supabase 학습용 자료 저장소 사용. 실제 A/B 계정의 전체 교차 접근 및 모든 CRUD를 이번 단계에서 재실측하지 않음 |
| 탈환 작전실 | `api/operations.js`, `src/operations-summary.mjs`, `public/operations.html`, `public/operations-evidence.js`의 읽기 전용 요약과 HTTP 확인표 | 운영 API의 HTTP 상태·요청 ID·시각을 수집하되 메모 본문은 읽지 않음. **41종 총공세 판정·제공 엔진 집행 기록을 대신하지 않음** |
| 복구 | `scripts/stage10-policy.mjs`, `scripts/stage10-restore.mjs`, `scripts/stage10-note.mjs`의 비공개 로컬 사본 검증·가상 복원 연습 | 백업 근거 커밋 `e6334b2`는 과거 로컬 정책 기준. 운영 Supabase RLS/GRANT·실제 메모·실제 세션의 복구 기능이 아님 |

### 1. 설치 — 기준 커밋을 별도 폴더에서 재현

Windows PowerShell과 **Node.js 22 이상**을 사용합니다. 기존 작업 폴더를 덮어쓰지 않도록 다른 디렉터리에 새로 받습니다.

```powershell
cd C:\Users\User\Projects
git clone https://github.com/Taetaeeee/choi-bujang-secret-vault.git byteback-stage12-repro
cd .\byteback-stage12-repro
git switch --detach 0f5a896cfd4ea472d292108e2a45722e3fcb8a6c
node --version
npm.cmd install
```

기대: 설치 종료 코드 0, 의도한 `HEAD`가 `0f5a896`과 일치. 이 명령은 **로컬 원본 코드의 의존성만 설치**합니다. Vercel 환경변수·Supabase DB·운영 인증 정보나 10단계의 Git 제외 백업은 자동 복원되지 않습니다. 비밀값이 없어도 로컬 가상 판정/탐지 시험은 가능합니다.

### 2. 실행 — 로컬 검증 → 실제 API 확인

```powershell
npm.cmd run decider:test
npm.cmd run fixture:7
npm.cmd run detect:test
node --test test/stage12-operations.test.mjs test/stage12-evidence.test.mjs
npm.cmd run test:package
npm.cmd run test:r5
npm.cmd run build -- --local
```

- **로컬 검증:** 판정기 정상 `allow`·미등록 `deny`·복합 위험 `step_up`, 탐지기 정상 `observe`·폭주 `propose_revocation`, 작전실/확인표 단위 검사를 확인합니다. 이것들은 **가상 요청 또는 코드 검사**이며 ALEPH SDP 엔진의 실시간 차단·회수 성공이 아닙니다. `npm run build -- --local`은 정적 `data.json` 제거와 로컬 빌드만 검증합니다. 이 저장소에는 `npm start`로 실행하는 독립 로컬 API 서버가 없습니다.
- **운영 실행:** 기존 운영 주소 [자료실](https://choi-bujang-secret-vault-alpha-drab.vercel.app/)에서 로그인하고 승인된 기기인지 확인합니다. 브라우저가 지원하면 메뉴의 **앱 설치/홈 화면에 추가**로 PWA 접속 앱을 추가할 수 있습니다. 설치 자체가 자료 접근을 승인하지는 않습니다. 자료실의 **탈환 작전실 보기** 또는 [/operations.html](https://choi-bujang-secret-vault-alpha-drab.vercel.app/operations.html)로 이동합니다.
- **안전한 실측:** 작전실에서 **서버에서 새로 확인**으로 `GET /api/operations` 응답과 카드 수치를 비교합니다. 이어 **안전한 HTTP 실측 5건 실행**을 눌러 정상 요청 200, 비로그인 금지 요청 401, 정적 메모 파일 404의 **실제 HTTP 상태·요청 ID·확인 시각·출처**를 표에 남깁니다. 서버 요청 ID 헤더가 없는 API 응답은 확인 필요입니다. 자세한 절차는 `docs/STAGE12_HTTP_EVIDENCE.md`를 따릅니다.
- **검사된 결과의 한계:** 사용자 제공 2026-11-05 운영 화면에는 실측 일치 **5/5건**이 표시됐고, 그중 `/data.json` 404, 승인된 `/api/notes` 200, 비로그인 `/api/notes` 401의 개별 ID·시각을 대조했습니다. 나머지 두 작전실 요청의 개별 헤더는 화면 요약과 별개로 확인해야 합니다. **공식 41종 공격의 개별 실행·결과는 확인되지 않았으므로 미실행/미확인**으로 남깁니다.

### 3. 중지 — 재현 작업과 운영 서비스의 범위 구분

- 위의 테스트와 로컬 빌드는 실행 후 **자동 종료**합니다. 진행 중인 명령만 중단해야 한다면 해당 PowerShell에서 `Ctrl+C`를 누르며, 이것은 Vercel 운영 서비스를 중단하지 않습니다.
- 접속 앱에서는 **로그아웃** 후 창/PWA를 닫습니다. 앱 종료·로그아웃은 Supabase의 **기기 승인 기록 자체를 취소하는 동작이 아닙니다**. 기기 승인 취소나 전체 운영 서비스 중단은 운영자의 별도 권한·절차가 필요하며, 이 문서에서 임의로 DB 상태를 변경하지 않습니다.
- 작전실의 HTTP 확인은 읽기 전용 GET 5건만 수행합니다. 41종 공격 자동 실행, 세션 회수 집행, 복원 POST 또는 실사용 메모 수정은 중지/확인 절차에 포함하지 않습니다.

### 4. 복구 — 먼저 상태·사본 검증, 임의 덮어쓰기 금지

```powershell
# 기존 원래 작업 폴더에서, 수정·복원 없이 상태만 확인
git status --short
git diff --stat
git log -3 --oneline
node scripts/stage10-policy.mjs verify
node scripts/stage10-restore.mjs retest
node scripts/stage10-note.mjs verify
```

1. **첫 오류가 나면 거기서 중단**하고 변경 파일·백업 유무·해시·대상 범위를 먼저 확인합니다. 10단계의 로컬 `artifacts/stage10/` 사본은 Git 제외이므로 **새로 Clone한 폴더에는 없습니다**. 없는 사본을 재생성하거나 백업을 덮어써 성공으로 표시하지 않습니다.
2. 검증된 기존 사본이 있는 경우에만 위 **읽기/재시험 명령**으로 과거 백업 SHA-256, 복원된 가상 정책·B 메모, 다른 가상 메모의 보존을 확인합니다. 이미 복원 완료한 사본에는 `backup`, `simulate`, `restore --confirm`, `prepare`, `post`를 재실행하지 않습니다.
3. 코드·배포 장애가 있으면 먼저 Git 변경 내역 및 마지막으로 정상 확인된 커밋과 운영 HTTP 응답을 대조합니다. 운영 Vercel 이전 배포로의 재배포/롤백은 별도 승인과 배포 설정 검토 후 **운영자가 수행**해야 합니다. **코드 롤백은 Supabase 운영 DB의 정책·자료 복원을 뜻하지 않습니다.** `git reset --hard`로 다른 작업을 삭제하지 않습니다.
4. 복구 확인 후에는 가상 판정기 테스트와 승인 계정 HTTP 200·비인증 HTTP 401·정적 메모 HTTP 404를 다시 관측하고 요청 ID·시각을 별도로 기록합니다. 실제로 재실행하지 않은 것은 **미실행**으로 남깁니다.

### 비밀값·증거 포장 제외

- Vercel의 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `VAULT_SESSION_KEY`는 **설정 이름만 문서화**합니다. 실제 값은 권한 있는 운영자가 Vercel **Settings → Environment Variables**의 비밀 입력란에 직접 관리합니다. Supabase 관리자 SQL이나 인증 토큰·쿠키를 README, 화면 기록, 로그, 제출 JSON에 붙이지 않습니다.
- `.env`, `.env.*`, `artifacts/`, `bundle-notes.json`, `public/aleph.json`은 `.gitignore` 대상입니다. `artifacts/submission.json`도 Git에 포함하지 않습니다. **실제 개인정보, 가상 메모 본문, 서버 전용 키, 승인 쿠키·기기 지문, 계정 식별자**를 제출 묶음이나 포트폴리오 자료에 포장하지 않습니다.
- `aleph.config.json`의 심판 서버 `judgeIssuer`, 기존 `identityProvider`, `allowedRoutes`, 원본 API 주소는 임의 변경하지 않습니다. **12단계 제출 전 확인**에서 설정·배포 단계·새 Clone·`npm run bundle`을 별도 점검합니다. 이 문서 추가만으로 `step: 12`, 41종 방어 성공 또는 공식 12단계 점수를 주장하지 않습니다.

## 12단계 저장점 — 탈환 작전실·실측 근거·운영 재현 (2026-11-05)

- **기준과 범위:** 제작 1~3 마지막 구현·문서화 커밋은 `c52af319240c895ebab291874781a3cbe4f2ac7e`입니다. 이번 저장점은 `aleph.config.json`을 **`step: 12`**로 올리고, 기존 1~11단계 점검·비공개 복구 검증과 `npm run bundle`을 12단계에서도 실행하도록 조정합니다. 이전 심판 평가 커밋과 과거 기록은 변경하지 않습니다.
- **학생 구현:** `src/decider.mjs`의 판정 규칙 5개, `src/detect.mjs`의 가상 조회 폭주 탐지, 서버 인증·기기 승인과 개인 자료실, PWA 접속 앱, `/api/operations`의 읽기 전용 요약 및 `public/operations-evidence.js`의 안전한 HTTP 확인표를 보존합니다. `src/attack-check.mjs`는 1~11단계 점검을 포함하여 **최대 20개 항목**만 제출하며, 12단계에서는 비로그인 기기 API·작전실 API·공개 화면의 실제 HTTP 응답을 확인합니다.
- **제공 엔진과 차이:** **ALEPH SDP 엔진 사용**. 엔진의 신원·기기·경로 검증, 실제 세션 회수 집행, 공식 41종 총공세 판정은 이 학생 저장소의 로컬 `decider:test`, `detect:test`, HTTP 5건 검사나 요약 화면과 구별합니다. 탐지의 `propose_revocation`은 집행이 아닌 **제안**입니다.
- **직접 관측한 운영 결과:** 2026-11-05 사용자 화면에서 안전한 GET 5건에 대해 **실측 일치 5/5건**이 표시됐습니다. 제공된 개별 기록으로는 정적 `/data.json` **404**, 승인된 `/api/notes` **200**, 쿠키 없는 `/api/notes` **401**과 각각의 ID·시각을 대조했습니다. 작전실 API 2건은 화면의 5/5 요약만 확인했으므로 개별 헤더 재검증은 별도입니다. 다른 단계별 운영 집행 및 **41종 공격 각각의 실행·방어 결과는 확인되지 않았으며 통과로 계산하지 않습니다**.
- **백업 보존:** 10단계 기존 비공개 검증 사본·가상 B 메모·감사 이력은 재생성하거나 덮어쓰지 않습니다. `src/stage10-policy.mjs`는 기존 검증된 사본을 기준으로 **기존 10·11단계에 12단계 번호를 추가 허용**하되, `allowedRoutes`, `judgeIssuer`, `identityProvider`, `originalApiUrl`, `restoreRoute`, 원본 판정 규칙의 예기치 않은 변경은 계속 거부합니다. 운영 Supabase DB 복구는 수행하지 않습니다.
- **설치 및 재시험:** 공개 저장소를 별도 폴더로 Clone해 Node.js 22 이상에서 `npm install`을 실행합니다. 이어 `npm run decider:test`, `npm run fixture:7`, `npm run detect:test`, `node --test test/stage11-savepoint.test.mjs test/stage12-savepoint.test.mjs test/stage12-evidence.test.mjs test/stage12-operations.test.mjs`, `npm run test:package`, `npm run test:r5`, `npm run build -- --local`을 검사합니다. 원래 작업 폴더에서는 기존 비공개 사본에 한하여 `node scripts/stage10-policy.mjs verify`, `node scripts/stage10-restore.mjs retest`, `node scripts/stage10-note.mjs verify`를 **재실행 없이 검증 명령만** 사용할 수 있습니다. 명령이 실제로 통과하기 전에는 통과했다고 기록하지 않습니다.
- **배포·제출 순서:** 이번 저장점 커밋 후 Vercel의 `/aleph.json`에서 **`step: 12` 및 배포 커밋 일치**를 확인하고, Git 작업 폴더가 깨끗하고 `bundle-notes.json`에 이번 단계의 설명이 있는 상태에서만 `npm run bundle`을 실행합니다. `artifacts/submission.json`, `bundle-notes.json`, `.env` 및 운영 비밀값은 Git에 올리지 않습니다. 묶음의 `attackAttempts`는 **학생 자기 점검 20건 이내**이고 공식 41종 공격 통과 결과가 아닙니다.

## 보너스 xdr-03 저장점 — 알려진 취약점 악용 탐지 (2026-11-06)

- **범위:** CVE-2021-44228 / MITRE ATT&CK T1190 패턴 3개, 독립 `decide(alert)`, 임시 거부 규칙·알림 기록 연습을 보존합니다. 기존 ZTNA 판정기와 12단계 제출 코드는 변경하지 않습니다.
- **저장점 재검증:** `npm.cmd run xdr:run -- known-cve`로 교육용 경보 24건을 재판정한 결과 `xdr/known-cve/result.json`의 `counts`는 **block 8 · alert 8 · record 8**이며, 정상 경보 `kc-17`~`kc-24`의 block은 **0건**입니다. 기존 제작 1~4의 17/17 로컬 테스트는 앞선 별도 실행 결과입니다.
- **재현:** Windows PowerShell에서 `npm.cmd run xdr:run -- known-cve`, `Get-Content xdr/known-cve/result.json -Raw -Encoding UTF8`을 실행합니다. 결과가 기존과 같으면 재실행 후 파일 내용 차이가 없어도 정상입니다.
- **한계:** `block`은 교육용 경보의 분류 결과입니다. `respond.mjs`의 임시 거부 규칙은 `staged_only`이며 실제 운영 ZTNA 집행이나 공식 심판 점수와 다릅니다. 비밀값·`xdr/alerts.log`·`deny-rules.json`·`artifacts/submission.json`은 커밋하지 않습니다.

## 보너스 xdr-04 저장점 — 지속성 탐지 (2026-11-07)

- **범위:** MITRE ATT&CK T1543, T1053, T1547.001 기반 서비스·예약 작업·시작 폴더 탐지 패턴 3개와 독립 판정기, 대응 어댑터를 보존합니다.
- **재검증:** `npm.cmd run xdr:run -- persistence`로 모의 경보 24건을 재판정했습니다. `xdr/persistence/result.json`의 counts는 block 8 · alert 8 · record 8이며, 정상 이벤트 ps-17~ps-24의 오차단은 0건입니다.
- **재현:** 저장소 루트에서 `npm.cmd run xdr:run -- persistence` 실행 후 `Get-Content xdr/persistence/result.json -Raw -Encoding UTF8`로 확인합니다. 결과가 같으면 result.json의 Git 변경 사항이 없어도 정상입니다.
- **한계:** respond.mjs의 15분 만료 거부 규칙은 staged_only 후보이며 운영 ZTNA에 실제 집행되지 않았습니다. 로컬 검증은 공식 심판 점수와 구분합니다.
- **보안:** 기존 ZTNA 규칙과 설정은 유지합니다. alerts.log, deny-rules.json, 비밀값 및 제출 묶음은 커밋하지 않습니다.
