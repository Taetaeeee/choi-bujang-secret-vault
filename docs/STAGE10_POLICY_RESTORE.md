# 10단계 제작 2 — 검증된 시험 정책만 복원

1. 제작 1에서 만든 백업과 변조 사본(`artifacts/stage10/`)을 **보존**하세요. `backup`을 재실행하거나 백업 파일을 덮어쓰지 마세요.
2. `node scripts/stage10-restore.mjs plan` — 실제 수정 없이 사전 백업 커밋·SHA-256·복원 전후 한 줄·대상·보존 범위를 표시합니다. 백업 누락·해시 불일치·예상 밖의 변조는 여기서 중단합니다.
3. `node scripts/stage10-restore.mjs restore` — 범위를 표시만 하고 복원하지 않습니다. 확인 후 **별도 명령** `node scripts/stage10-restore.mjs restore --confirm`으로 시험 사본 한 개만 복원합니다.
4. 복원 성공 시 `artifacts/stage10/drill/decider.mjs`가 백업 원문과 일치하는지 SHA-256으로 확인합니다. `artifacts/stage10/audit.jsonl`에는 복원 시작/완료 사건만 **추가 기록**하고 과거 항목을 삭제하거나 덮어쓰지 않습니다.
5. `node scripts/stage10-restore.mjs retest` — 복구된 가상 판정기로 A의 정상 자료 요청 허용, 미등록 기기·다른 서비스 거부를 검사하고, 기존 `src/api-resource-access.mjs`의 서버 소유권 로직으로 B의 A 자료 접근 거부를 별도 확인합니다.

**범위 제한:** 운영 `src/decider.mjs`, `aleph.config.json` 전체, 실제 메모·Supabase RLS/GRANT, 실제 계정·감사 서버는 수정하지 않습니다. 이번 백업의 DB 정책 항목은 과거 README 정책 **기록**이며 현재 운영 DB 정책의 실측 백업이 아닙니다. 정상 A와 금지 B는 가상 UUID를 사용한 로컬 단위 시험이며 실계정 API 교차 접근 실측이 아닙니다. 운영 DB 정책의 자동 복원 기능도 아닙니다.

**재현 시험:** `node --test test/stage10-policy.test.mjs test/stage10-restore.test.mjs`, `npm.cmd run decider:test`, `node --test test/stage8-api-access.test.mjs test/stage8-zones.test.mjs`.
