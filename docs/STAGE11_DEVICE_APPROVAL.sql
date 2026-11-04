-- 제작 2 운영 DB에 최초 1회 적용. 기존 메모·감사·정책 테이블은 변경하지 않습니다.
-- Supabase SQL Editor에서 승인 관리 권한을 가진 운영자만 실행합니다.
create table if not exists public.vault_device_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_digest text not null check (device_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (owner_id, device_digest)
);

alter table public.vault_device_approvals enable row level security;
revoke all on table public.vault_device_approvals from public, anon, authenticated;
grant select, insert, update on table public.vault_device_approvals to service_role;
-- 공개 클라이언트에 승인 정책을 만들지 않습니다. 서버 Secret key 전용입니다.

-- 실제 운영자가 별도 인증을 마친 후 요청 번호(id)와 소유자를 대조하여 승인:
-- update public.vault_device_approvals
--    set status = 'approved', approved_at = now()
--  where id = '<요청 번호>'::uuid and owner_id = '<로그인 사용자 UUID>'::uuid
--    and status = 'pending';
-- 반환된 변경 행이 정확히 1건인지 확인하고, 브라우저에서 [승인 상태 다시 확인] 클릭.
-- 승인 취소: status = 'revoked', approved_at = null (같은 id/owner_id 조건)
