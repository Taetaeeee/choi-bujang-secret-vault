# BYTE BACK 방어전 시작 틀 R5

이 저장소는 BYTE BACK 방어전 R5의 1단계에서 만들어졌고, 현재 `aleph.config.json`의 단계는 **2**입니다. 처음 공개했던 메모 네 건은 모두 실습용 가상 자료이며, 현재는 학습용 Supabase DB로 옮기고 최신 소스의 정적 JSON에서 제거했습니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 1단계 기록 — 학생이 했던 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

1단계 당시 `/`에서 점령된 가상 자료실을 볼 수 있었고 `/data.json`에도 같은 가상 메모가 공개됐습니다. 2단계 최신 배포에서는 정적 `/data.json`을 더 이상 제공하지 않습니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 초기 자리표시자이며, 이후 제출 묶음 작업 전에 실제 주소와 대조해야 합니다. 이 제작 단위에서는 `step`만 2로 변경했습니다. `npm run bundle`은 현재 제작 단위에 포함하지 않았습니다.

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
