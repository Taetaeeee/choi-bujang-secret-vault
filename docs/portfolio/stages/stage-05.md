# 5단계 | Supabase 직접 Data API 접근 권한 회수

**기록 출처:** [기존 루트 README — 5단계 저장점](../../../README.md)  
**문장 상태:** 당시 포트폴리오용 3줄 기록 원문을 확인하지 못해, README에 남은 실행 사실을 **새로 요약**했습니다.

## 과제 개요

메모 조회·수정은 Vercel 서버 API에서 처리하면서, `public.vault_user_notes` 테이블에 대한 `PUBLIC`·`anon`·`authenticated`의 직접 접근 권한을 회수하는 단계입니다.

## 3줄 요약 — 당시 원문 아님

- **문제:** 서버 API에서 접근을 제어하더라도 Supabase Data API를 통한 직접 테이블 접근 가능성을 별도로 점검해야 했습니다.
- **해결 방법:** `vault_user_notes`의 직접 테이블 권한을 `REVOKE ALL`로 회수하고, 기존 RLS 정책과 서버 API의 사용자 소유권 검사는 그대로 유지했습니다.
- **검증:** SQL Editor에서 해당 역할의 SELECT·INSERT·UPDATE·DELETE 등 7개 테이블 권한이 모두 `false`임을 확인했습니다. 공개용 키를 사용한 원본 Data API GET은 HTTP 401이었고, 권한 회수 후에도 A의 메모 조회·추가·수정·삭제가 유지됐습니다.

## 구현 범위와 주의사항

- 권한 회수 대상은 `public.vault_user_notes` **한 테이블**이며 다른 테이블을 변경했다고 기록하지 않습니다.
- 인증과 세션 관리용 Supabase Auth 연결은 유지했습니다.
- **5단계 권한 회수 이후** B의 CRUD 및 A/B 교차 접근 요청은 다시 실측하지 않았습니다.
- 브라우저 공개 인증 키 제거까지 달성했다고 주장하지 않습니다. 실제 운영 심판 판정은 별개입니다.

## 코드 및 재실행 근거

- [루트 README의 5단계 저장점](../../../README.md)
- [메모 API](../../../api/notes.js)
- [방어전 설정 파일](../../../aleph.config.json)

참고 재실행 명령: `npm.cmd run build -- --local`, `npm.cmd run test:r5`, `npm.cmd run test:package`. 운영 DB 권한과 API 동작은 별도 환경 점검이 필요합니다.
