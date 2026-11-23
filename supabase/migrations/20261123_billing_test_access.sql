-- Explicit free test access. This is not a subscription, invoice, or payment proof.
-- expires_at null means no end date has been chosen. A set revoked_at ends access
-- immediately. The table starts empty. Assignment is a later manual SQL statement.

create table public.billing_test_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  test_plan text not null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_test_access_plan_check
    check (test_plan in ('basic', 'pro', 'elite'))
);

alter table public.billing_test_access enable row level security;

revoke all on table public.billing_test_access from public;
revoke all on table public.billing_test_access from anon;
revoke all on table public.billing_test_access from authenticated;
revoke all on table public.billing_test_access from service_role;

grant select on table public.billing_test_access to service_role;
