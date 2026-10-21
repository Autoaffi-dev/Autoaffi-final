-- Provider-neutral inbound commission events.
-- This slice writes only Syllaby test postbacks.
-- Test identities are not seeded here.
--
-- Test isolation:
-- affiliate_test_identities.environment is only 'test'.
-- affiliate_inbound_events.environment is test or production.
-- is_test must equal (environment = 'test'), so a test event cannot
-- share the production environment and a production event cannot be
-- marked as a test.
-- Identity and event uniqueness both include provider, account_scope,
-- program_scope, and environment. The test route sets those values.
-- sub_id and external_event_id, when present, must be the full valid
-- identifier. A truncated value cannot be stored as an identifier.
--
-- Privileges, including grants that default privileges may have applied:
-- REVOKE ALL from PUBLIC, anon, authenticated, and service_role.
-- Then GRANT only SELECT and INSERT to service_role.
-- UPDATE and DELETE are not granted. A conflicting insert does not
-- overwrite the original row.

create table if not exists public.affiliate_test_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  account_scope text not null,
  program_scope text not null,
  environment text not null,
  platform text not null,
  tracking_code text not null,
  owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint affiliate_test_identities_environment_check
    check (environment = 'test'),
  constraint affiliate_test_identities_code_format_check
    check (tracking_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint affiliate_test_identities_code_key
    unique (provider, account_scope, program_scope, environment, tracking_code)
);

create table if not exists public.affiliate_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  account_scope text not null,
  program_scope text not null,
  environment text not null,
  platform text not null,
  external_event_id text null,
  event_type text null,
  sub_id text null,
  conversion_amount_text text null,
  reward_amount_text text null,
  conversion_amount_minor bigint null,
  reward_amount_minor bigint null,
  currency_code text not null,
  currency_source text not null,
  is_test boolean not null,
  match_status text not null,
  match_reason text not null,
  matched_owner_id uuid null,
  matched_identity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  constraint affiliate_inbound_events_environment_check
    check (environment in ('test', 'production')),
  constraint affiliate_inbound_events_test_isolation_check
    check (is_test = (environment = 'test')),
  constraint affiliate_inbound_events_sub_id_check
    check (sub_id is null or sub_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint affiliate_inbound_events_event_id_check
    check (
      external_event_id is null
      or external_event_id ~ '^[A-Za-z0-9_.:-]{1,128}$'
    ),
  constraint affiliate_inbound_events_amount_check
    check (
      (
        conversion_amount_minor is null
        or conversion_amount_minor between -1000000000000 and 1000000000000
      )
      and (
        reward_amount_minor is null
        or reward_amount_minor between -1000000000000 and 1000000000000
      )
    ),
  constraint affiliate_inbound_events_match_status_check
    check (match_status in ('matched', 'unresolved_review')),
  constraint affiliate_inbound_events_match_reason_check
    check (match_reason in (
      'matched',
      'duplicate_query_param',
      'missing_event_id',
      'invalid_amount',
      'missing_or_invalid_sub_id',
      'unknown_sub_id',
      'ambiguous_sub_id'
    )),
  constraint affiliate_inbound_events_owner_check
    check (
      (
        match_status = 'matched'
        and match_reason = 'matched'
        and matched_owner_id is not null
        and matched_identity_id is not null
      )
      or (
        match_status = 'unresolved_review'
        and match_reason <> 'matched'
        and matched_owner_id is null
        and matched_identity_id is null
      )
    )
);

create unique index if not exists affiliate_inbound_events_event_key
  on public.affiliate_inbound_events (
    provider,
    account_scope,
    program_scope,
    environment,
    external_event_id
  )
  where external_event_id is not null;

alter table public.affiliate_test_identities enable row level security;
alter table public.affiliate_inbound_events enable row level security;

revoke all on table public.affiliate_test_identities from public;
revoke all on table public.affiliate_test_identities from anon;
revoke all on table public.affiliate_test_identities from authenticated;
revoke all on table public.affiliate_test_identities from service_role;

revoke all on table public.affiliate_inbound_events from public;
revoke all on table public.affiliate_inbound_events from anon;
revoke all on table public.affiliate_inbound_events from authenticated;
revoke all on table public.affiliate_inbound_events from service_role;

grant select, insert on table public.affiliate_test_identities to service_role;
grant select, insert on table public.affiliate_inbound_events to service_role;
