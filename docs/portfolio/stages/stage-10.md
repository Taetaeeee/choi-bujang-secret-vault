# 10단계 | 백업에서 자료실을 되살립니다

**기록 출처:** 제작 1~4 공식 요청, 사용자 PowerShell 실행 결과, [10단계 저장점 `add9bc5`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/add9bc596d428da75ae73e60d846c1d777aefe84) 및 [최종 수정 커밋 `7349244`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/73492445b5e1aec967ad70015dd2a004df5d6696)
**기록 상태:** 제작 1~4 로컬 검증·제출 완료 · 2026-11-04 공식 심판 **100/100점**, 기본 조건 **5개 확인**·완결성 가점 **3개** (사용자 제공 결과)

## 과제와 목표

기존 1~9단계의 접근 정책이 변경되거나 가상 메모가 훼손된 상황을 **운영 환경이 아닌 별도의 시험 사본**에서 재현했습니다. 복원 전에 백업을 다시 읽어 SHA-256과 대상·기준 버전·변경 범위를 검증하고, **시험 정책 한 줄**과 **시험 계정 B의 가상 메모 한 건**만 복원하는 것이 목표였습니다. 기존 감사 이력, 다른 메모, 서비스별 접근 제한을 유지하고 복원 뒤 정상 요청과 금지 요청을 다시 판정했습니다.

## 제작 1 — 정책 사본·해시 생성과 격리된 변조

- **문제:** 안전 정책의 기준본이 명확하지 않은 상태에서 복원하면 잘못된 버전이나 의도하지 않은 다른 규칙까지 덮어쓸 수 있음.
- **해결 방법:** `src/stage10-policy.mjs`에서 `src/decider.mjs` 원문, `aleph.config.json`의 `allowedRoutes` 3개 및 README에 남은 과거 DB 권한 기록을 백업 대상으로 정했습니다. `artifacts/stage10/verified-policy.json`과 별도 SHA-256 파일을 생성한 뒤 **디스크에서 다시 읽어** 전체 및 내부 항목 해시를 확인했습니다. 파일 누락·해시 불일치·원본 변경 시 중단하며 기존 백업 덮어쓰기도 거부합니다. 변조는 격리된 `artifacts/stage10/drill/decider.mjs`에서 `deviceRegistered` 검사 조건 **한 줄만** 약화시켜 비교했습니다.
- **검증:** 사용자 PC의 `node --test test/stage10-policy.test.mjs` 관련 초기 **9/9 통과**. `backup` → `verify` → `simulate` → `diff`에서 기준 버전 `e6334b2`, 변조 범위 한 줄과 백업 SHA-256 일치를 확인했습니다. `src/decider.mjs` 원본 및 운영 DB는 수정하지 않았습니다.

## 제작 2 — 실행 전 계획과 선택적 정책 복원

- **문제:** 검증되지 않은 사본을 바로 적용하거나 복원 과정에서 다른 서비스 규칙·감사 이력을 변경하면 이전 접근 제한의 신뢰성을 잃을 수 있음.
- **해결 방법:** `scripts/stage10-restore.mjs plan`에서 **복원 기준 커밋, 백업/변경 전후 해시, 대상 파일, 변경할 한 줄과 보존 범위**를 쓰기 전에 표시하도록 했습니다. 별도 `restore --confirm`이 지정돼야 시험 사본을 복원하고, 실행 직전에 백업을 다시 읽어 무결성과 변경 범위를 재확인합니다. 누락·해시 오류·예상 밖의 변경은 중단하며 운영 정책은 복원 대상으로 받지 않습니다. `artifacts/stage10/audit.jsonl`에는 복원 시작·완료 사건만 **추가**하고 기존 기록을 삭제하지 않습니다.
- **검증:** 제작 1+2 초기 테스트 **17/17 통과**. 실제 로컬 `plan`에서 **미변경**을 확인한 뒤 `restore --confirm`을 실행해 시험 사본이 원래 SHA-256으로 돌아왔습니다. `retest`에서 가상 A의 정상 요청 허용, B의 A 자료 접근 거부(서버 소유권 검사), 미등록 기기 및 다른 서비스·강사 자료 거부를 확인했습니다. 운영 계정·DB의 실측은 아닙니다.

## 제작 3 — B 계정의 가상 메모 한 건만 복원

- **문제:** 여러 메모 중 특정 1건만 복원하면서 소유자나 내용이 바뀌거나, 타 계정이 복원을 요청할 위험이 있음.
- **해결 방법:** 서비스 `notes`의 **`POST /api/restore`**에 시험 계정 B의 가상 신원과 지정 메모 ID만 허용했습니다. 비공개 로컬 백업에서 ID·소유자·내용 SHA-256을 재확인한 다음 `artifacts/stage10/drill/virtual-notes.json`에서 **그 한 건만** 복원합니다. 요청의 임의 `role`·`owner_id`·본문, A의 B 메모 복원, 잘못된 해시·중복 복원은 거부합니다. 나머지 가상 메모 두 건과 감사 이력은 보존합니다.
- **검증:** 제작 1~3 테스트 **29/29 통과**. 사용자 PC에서 `prepare` → `plan` → 로컬 `post`(**HTTP 200**) → `verify`를 실행했으며, 메모 ID `bbbbbbbb-2222-4222-8222-000000000010`, 가상 B 소유자 및 본문 SHA-256이 백업과 일치했고 **다른 가상 메모 2건을 보존**했습니다. 메모 본문이나 토큰은 문서에 포함하지 않았습니다.

## 제작 4 — 복구 후 기존 정상·금지 요청의 회귀 검증

- **문제:** 복원 대상 자체가 정상이어도 앞선 단계에서 금지하던 메모 접근·기기·자료 구역·조회 폭주 규칙이 변했을 수 있음.
- **해결 방법:** 루트 `README.md`에 **정책/메모 복원 확인 → 1~5단계 접근·공개 파일 → 6~7단계 기기·추가 인증 → 8단계 구역·소유권 → 9단계 조회 폭주 → 10단계 회귀 검사** 순서를 기록했습니다. 사용자 PC에서 실제 실행한 결과와 실제 로그인·운영 DB·엔진의 **미실행 검사**를 명시적으로 구분했습니다.
- **검증:** 정책 `verify`·복원 `retest`·가상 메모 `verify` 통과. 사용자 PC에서 `test:r5` **2/2**, `test:package` **3/3**(신규 API 경로를 테스트 목록에 반영한 뒤), 8단계 종합 **13/13**, 9단계 단위 **13/13** 및 `detect:test` **6/6**, `decider:test` **4/4**, 10단계 저장점 관련 시험 최종 **33/33** 통과, 로컬 빌드 성공을 확인했습니다. 각 테스트 집합에는 중복 사례가 있어 수치를 단순 합산하지 않았습니다.

## 공식 평가에서 발견한 문제와 수정

최초 10단계 저장점 [`add9bc5`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/add9bc596d428da75ae73e60d846c1d777aefe84)은 17개 파일 변경, `step: 10`, 제출 묶음 **판정 규칙 5개·직접 점검 기록 18개**로 배포했습니다. 그러나 첫 공식 피드백은 **`S10_BACKUP_UNVERIFIED`** 및 `evidence_rejected`였고, 심판은 `restoreRoute: null`과 README의 복원 직전 검증 순서를 지적했습니다. 뒤이어 통과 인정 상태에서도 **24/100점**, 기록 코드 `UNV_AMBIGUOUS`가 표시됐습니다. 해당 코드는 심판이 검증을 끝까지 확인하지 못한 경우로 안내됐으며, 구현 기능 전체의 실패로 단정하지 않았습니다.

- **원인과 변경:** 구현된 가상 복원 POST와 제출 설정을 구분하다 `restoreRoute`가 `null`로 남았습니다. `aleph.config.json`을 **`"POST /api/restore"`**로 정정하고 README에 **백업 다시 읽기 → SHA-256 확인 → 기준 버전·변경 범위 확인 → 실패 시 중단 → 명시적 복원** 절차를 추가했습니다.
- **후속 호환성 문제:** 백업은 `step: 9`, `restoreRoute: null` 시점의 설정을 담고 있었습니다. 제출 설정을 정정하자 기존 검증이 `current_source_changed_since_backup`으로 중단돼, `src/stage10-policy.mjs`에서 **9→10 단계 번호 변경과 `null`→지정 POST 경로 변경만** 허용하도록 수정했습니다. 다른 설정·허용 경로 변조는 여전히 거부하고 기존 백업·감사 이력은 재생성하거나 덮어쓰지 않았습니다.
- **재검증과 결과:** 원래 백업의 해시 검증, 복원 후 가상 A 허용·B 교차 접근 거부, B 가상 메모 단건 해시·다른 2건 보존 검증이 다시 통과했습니다. 최종 관련 테스트 **33/33**, 판정기 **4/4**, 패키징 **3/3**, 빌드 성공을 확인하고 수정 커밋 [`7349244`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/73492445b5e1aec967ad70015dd2a004df5d6696)을 Push했습니다.
- **최종 공식 결과:** 같은 커밋 `73492445b5e1`로 재제출한 결과 **기본 조건 5개 모두 확인·완결성 가점 3개·100/100점**을 받았습니다(2026-11-04 사용자 제공 평가 메시지). 최초 `evidence_rejected` 기록과 최종 확인 완료 결과는 구분합니다.

## 최종 저장점·증거 범위

| 항목 | 확인 결과 |
|---|---|
| 복원 기준 사본 | `e6334b2` 기준 로컬 정책 백업을 재읽고 SHA-256 검증 통과. 현재 운영 DB 정책의 백업은 아님 |
| 주요 구현 커밋 | [`add9bc5`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/add9bc596d428da75ae73e60d846c1d777aefe84) — 10단계 저장점 |
| 최종 평가 커밋 | [`7349244`](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/73492445b5e1aec967ad70015dd2a004df5d6696) — 제출 경로·README·백업 호환성 수정 |
| 최종 제출 묶음 | 단계 10 · 커밋 `73492445b5e1` · 변경 3개 · 규칙 5개 · 직접 점검 **기록 18개** |
| Vercel 배포 | `/aleph.json`에서 `step: 10`, 최종 평가 커밋 일치 `True` 확인 |
| 새 Clone 설치 | 임시 폴더의 별도 `git clone` 후 `npm.cmd install` 성공(사용자 출력: 추가 패키지 10개, 취약점 0건); `decider:test` 4건·8단계 구역 시험 7건 통과 |
| 공식 심판 | **100/100점**, 조건 5/5 · 완결성 가점 3/3 (사용자 제공 결과) |

**18개는 제출 JSON에 들어간 점검 기록 수**이며 18건이 공식적으로 개별 통과했다는 의미는 아닙니다. 공식 평가에서 조건 5개와 가점 3개를 확인했다는 결과와 로컬 가상 시험은 별도의 증거입니다.

## 판단·한계·배운 점

- **검증 후 복원:** 백업의 존재만으로 신뢰하지 않고 디스크 재읽기·해시 검증·기준 버전 및 변경 범위 검토를 거친 다음 지정한 시험 사본만 복원했습니다. 백업 파일과 해시를 같은 로컬 환경에 보관하므로 **둘 다 공격자가 변경하는 경우까지 방어하는 외부 서명·독립 보관 방식은 아닙니다.**
- **권한과 복구 분리:** 가상 판정기의 정상/거부와 최종 메모 API 소유권 검사를 구분했고, 복구 시에도 A/B 간 소유자 제한과 다른 서비스의 금지 규칙이 유지되는지 확인했습니다.
- **운영 적용 한계:** 백업의 DB 정책 근거는 **과거 README 기록**이며 현재 Supabase의 RLS/GRANT를 직접 백업·복원하지 않았습니다. 시험 계정 B와 메모는 가상 데이터이고, 공개 Vercel에는 비공개 백업 파일이 배포되지 않습니다. 실제 운영 B 메모 복원, 운영 A/B 로그인 교차 요청, 세션 회수·현행 DB 정책 검증은 **미실행**입니다.
- **개별 기여 기록:** 공식 제작 요청에 따라 AI 도구와 함께 구현·수정한 내용을 사용자 PC의 실행 로그 및 Git 커밋으로 확인한 기록입니다. 실제 운영 환경에서 별도로 성능·보안을 실측했다고 과장하지 않습니다.

## 코드와 재현 절차

- [정책 백업·검증](../../../src/stage10-policy.mjs) / [정책 복원](../../../src/stage10-restore.mjs)
- [정책 백업 사용법](../../STAGE10_POLICY_BACKUP.md) / [정책 복원 사용법](../../STAGE10_POLICY_RESTORE.md)
- [시험용 B 메모 복원](../../../src/stage10-note-restore.mjs) / [POST 핸들러](../../../api/restore.js)
- [설정 파일](../../../aleph.config.json) / [루트 저장점·재시험 기록](../../../README.md)
- [10단계 정책 시험](../../../test/stage10-policy.test.mjs) / [정책 복원 시험](../../../test/stage10-restore.test.mjs)
- [메모 단건 복원 시험](../../../test/stage10-note-restore.test.mjs) / [제출 점검 시험](../../../test/stage10-savepoint-check.test.mjs)
- [최종 수정 커밋](https://github.com/Taetaeeee/choi-bujang-secret-vault/commit/73492445b5e1aec967ad70015dd2a004df5d6696)

로컬 재실행(기존 시험 사본이 남아 있는 작업 폴더): `node scripts/stage10-policy.mjs verify`, `node scripts/stage10-restore.mjs retest`, `node scripts/stage10-note.mjs verify`. 새로 Clone한 폴더에는 Git에서 제외된 시험 사본이 없으므로 이 3개 명령의 성공을 기대하지 않으며, 대신 `node --test test/stage10-policy.test.mjs test/stage10-restore.test.mjs test/stage10-note-restore.test.mjs test/stage10-savepoint-check.test.mjs`로 격리된 시험 사본을 생성하는 단위 테스트를 실행합니다. 이미 복원한 사본의 `backup`·`simulate`·`prepare`·`post`·`restore --confirm`은 중복 실행하지 않습니다.
