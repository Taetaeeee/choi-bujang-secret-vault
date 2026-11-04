# 10단계 제작 1 — 안전 정책 사본과 침공 재현

**대상:** `src/decider.mjs` 전체 규칙, `aleph.config.json`의 `allowedRoutes` 배열, `README.md`에 기록된 4~5단계 DB 접근 정책(RLS·GRANT/REVOKE). 실사용 메모와 토큰·비밀키는 읽거나 보관하지 않습니다.

**중요한 한계:** 저장소에는 Supabase 현재 `pg_policies` 및 실제 테이블 권한의 원본 덤프가 없습니다. 따라서 DB 정책 항목은 README에 남은 *과거 검증 기록*이며 운영 DB의 현재 백업이라고 말할 수 없습니다. 운영 DB 정책 복원은 별도 읽기 전용 현행 정책 조회와 검증 전에는 금지합니다.

## 실행 순서 (Windows PowerShell)

1. `git status --short`로 다른 작업이 없는지 확인합니다.
2. `node scripts/stage10-policy.mjs backup` — 변경 범위와 기준 커밋을 **먼저 표시**하고 `artifacts/stage10/verified-policy.json` 및 `verified-policy.sha256`을 새로 생성합니다. 저장 직후 다시 읽어 해시를 확인합니다.
3. `node scripts/stage10-policy.mjs verify` — 백업 사본 및 SHA-256 재검증. 어느 하나라도 없거나 불일치하면 중단합니다.
4. `node scripts/stage10-policy.mjs simulate` — 백업 재검증 및 현재 원본 해시 확인 후 **`artifacts/stage10/drill/decider.mjs` 한 파일만** 시험 변조합니다. 원본 정책·설정·DB는 수정하지 않습니다.
5. `node scripts/stage10-policy.mjs diff` — 검증된 백업과 변조 사본 사이의 **정확히 한 줄 차이만** 표시합니다.

이번 제작에서는 **복구하지 않습니다.** 실제 복원 및 정상·금지 요청 재검증은 이후 공식 제작 요청에서 다룹니다. `artifacts/`는 Git에서 제외되어 있으며 백업을 덮어쓰지 않습니다. 사본과 해시를 모두 바꾸는 공격까지 방어하는 서명/외부 보관 수단은 아니므로 별도 보호된 저장소 없이 이것만으로 운영 복원을 보장하지 않습니다.

## 성공·중단 기준

- 정상: 백업 생성·재검증 통과, 시험 사본 1줄 변조 감지, 변경 범위 `artifacts/stage10/drill/decider.mjs`만 출력.
- 중단: 사본 없음, 해시 불일치, DB 정책 근거 누락, 사본 덮어쓰기 시도, 백업 후 원본 변경, 예고하지 않은 시험 변조.
- 운영 DB의 현재 정책 검증: **미수행**. 이 단계의 시험 성공과 구분합니다.
