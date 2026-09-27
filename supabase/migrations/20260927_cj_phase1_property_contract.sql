-- CJ Phase 1: promotional property PID mapping and admin program review.
-- Customer product search and save stay fail-closed.
-- No advertiser seed. Linus reviews programs explicitly later.
--
-- user_social_accounts lifecycle:
-- - Disconnect updates the row in place and clears username, account_id, and meta.
-- - Instagram data deletion deletes the user_social_accounts row.
-- A foreign key with ON DELETE CASCADE would drop the PID mapping during deletion.
-- A foreign key with ON DELETE RESTRICT would make that deletion fail.
-- social_account_id is therefore stored without a foreign key.
-- The mapping row remains, owned by the canonical user UUID.

create table if not exists public.cj_promotional_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  social_account_id uuid null,
  social_account_identifier text not null,
  social_media_handle text not null,
  cj_social_platform text not null,
  cj_pid text not null,
  property_type text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cj_promotional_properties_status_check
    check (status in ('ACTIVE', 'ARCHIVED', 'TERMINATED')),
  constraint cj_promotional_properties_user_property_key
    unique (user_id, platform, social_account_identifier),
  constraint cj_promotional_properties_pid_key
    unique (cj_pid)
);

create index if not exists cj_promotional_properties_user_idx
  on public.cj_promotional_properties (user_id);

create table if not exists public.cj_program_reviews (
  advertiser_id text primary key,
  advertiser_name text null,
  status text not null,
  permitted_methods text[] not null default '{}',
  notes text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null,
  updated_at timestamptz not null default now(),
  constraint cj_program_reviews_status_check
    check (status in ('allowed', 'disabled'))
);

alter table public.cj_promotional_properties enable row level security;
alter table public.cj_program_reviews enable row level security;

revoke all on table public.cj_promotional_properties from public;
revoke all on table public.cj_promotional_properties from anon;
revoke all on table public.cj_promotional_properties from authenticated;

revoke all on table public.cj_program_reviews from public;
revoke all on table public.cj_program_reviews from anon;
revoke all on table public.cj_program_reviews from authenticated;

grant select, insert, update, delete on table public.cj_promotional_properties to service_role;
grant select, insert, update, delete on table public.cj_program_reviews to service_role;
