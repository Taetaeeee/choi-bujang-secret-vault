# 4단계 | 메모 소유권 검사 및 접근 제어 강화

**기록 출처:** [기존 루트 README — 4단계 저장점](../../../README.md)  
**문장 상태:** 당시 포트폴리오용 3줄 기록 원문을 확인하지 못해, README의 실제 시험 기록을 **새로 요약**했습니다.

## 과제 개요

로그인 사용자 간 교차 접근을 막기 위해 서버의 `owner_id` 확인과 Supabase RLS 정책 및 테이블 권한을 점검했습니다.

## 3줄 요약 — 당시 원문 아님

- **문제:** 로그인 검증만으로는 다른 사용자의 UUID 메모에 접근하는 문제를 막을 수 없었습니다.
- **해결 방법:** 서버에서 검증된 사용자 ID와 메모 `owner_id` 일치를 목록·단건 GET·PUT·DELETE에 적용하고, 변경 요청의 `owner_id` 조작을 거부하도록 했습니다. 학습 DB에서는 RLS 정책과 역할별 권한을 구성했습니다.
- **검증:** B 계정으로 A의 UUID에 GET·PUT·DELETE를 보내 모두 HTTP 404를 확인하고, A 계정으로 B UUID의 GET도 HTTP 404를 확인했습니다. A 계정의 `owner_id` 변경 시도는 HTTP 400이었습니다.

## 확인된 세부 시험

- B의 본인 메모 POST·PUT·DELETE가 작동했고, A/B 본인 목록을 확인했습니다.
- RLS 활성화 및 `authenticated`의 CRUD 권한, `anon` 권한 부재를 SQL Editor에서 확인했습니다.
- API의 소유권 검사와 DB 정책 점검은 **서로 다른 검증 근거**입니다. 서버 전용 `service_role`은 RLS를 우회할 수 있습니다.

## 미실행·한계

RLS 적용 이후 A의 POST·PUT·DELETE와 A→B PUT·DELETE는 이 저장점에서 별도로 실측하지 않았습니다. 서버 API에서 수행한 A/B 수동 검사를 자동 번들 시험 결과로 주장하지 않습니다.

## 코드 및 근거

- [루트 README의 4단계 저장점](../../../README.md)
- [메모 API](../../../api/notes.js)
- [ZTNA 요청·응답 계약 참고](../../DECIDER_REQUEST.md)
