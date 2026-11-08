-- Checkout attempts. Creating a session or opening the return page does not grant paid access.
-- service_role is the only API role. The partial unique index blocks a second purchase
-- while an attempt is pending, open, unknown, expiring, or complete.

alter table public.billing_stripe_customers
  add constraint billing_stripe_customers_user_customer_key unique (user_id, stripe_customer_id);

create table public.billing_checkout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  row_version bigint not null default 1,
  status text not null,
  idempotency_key uuid not null,
  create_anchor_at timestamptz not null,
  stripe_customer_id text not null,
  stripe_account_id text not null,
  plan text not null,
  stripe_price_id text not null,
  unit_amount integer not null,
  currency text not null,
  quantity integer not null default 1,
  livemode boolean not null,
  success_url text not null,
  cancel_url text not null,
  mode text not null default 'subscription',
  adaptive_pricing_enabled boolean not null,
  automatic_tax_enabled boolean not null,
  stripe_session_id text null,
  stripe_session_url text null,
  observed_late_session_id text null,
  supersede_plan text null,
  expire_idempotency_key uuid null,
  expire_anchor_at timestamptz null,
  successor_attempt_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_sessions_status_check
    check (status in ('pending', 'open', 'expiring', 'complete', 'expired', 'unknown')),
  constraint billing_checkout_sessions_plan_check
    check (plan in ('basic', 'pro', 'elite')),
  constraint billing_checkout_sessions_supersede_plan_check
    check (supersede_plan is null or supersede_plan in ('basic', 'pro', 'elite')),
  constraint billing_checkout_sessions_amount_check
    check (
      (plan = 'basic' and unit_amount = 700)
      or (plan = 'pro' and unit_amount = 1900)
      or (plan = 'elite' and unit_amount = 3900)
    ),
  constraint billing_checkout_sessions_currency_check
    check (currency = 'usd'),
  constraint billing_checkout_sessions_quantity_check
    check (quantity = 1),
  constraint billing_checkout_sessions_mode_check
    check (mode = 'subscription'),
  constraint billing_checkout_sessions_flags_check
    check (adaptive_pricing_enabled = false and automatic_tax_enabled = false),
  constraint billing_checkout_sessions_account_check
    check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  constraint billing_checkout_sessions_version_check
    check (row_version >= 1),
  constraint billing_checkout_sessions_expiring_check
    check (
      status <> 'expiring'
      or (expire_idempotency_key is not null and supersede_plan is not null and stripe_session_id is not null)
    ),
  constraint billing_checkout_sessions_idempotency_key unique (idempotency_key),
  constraint billing_checkout_sessions_session_id_key unique (stripe_session_id),
  constraint billing_checkout_sessions_expire_key unique (expire_idempotency_key),
  constraint billing_checkout_sessions_successor_key unique (successor_attempt_id),
  constraint billing_checkout_sessions_customer_binding_fkey
    foreign key (user_id, stripe_customer_id)
    references public.billing_stripe_customers (user_id, stripe_customer_id),
  constraint billing_checkout_sessions_successor_fkey
    foreign key (successor_attempt_id)
    references public.billing_checkout_sessions (id)
);

create unique index billing_checkout_sessions_one_blocking_per_user
  on public.billing_checkout_sessions (user_id)
  where status in ('pending', 'open', 'unknown', 'expiring', 'complete');

alter table public.billing_checkout_sessions enable row level security;

revoke all on table public.billing_checkout_sessions from public;
revoke all on table public.billing_checkout_sessions from anon;
revoke all on table public.billing_checkout_sessions from authenticated;
revoke all on table public.billing_checkout_sessions from service_role;

grant select, insert, update on table public.billing_checkout_sessions to service_role;

-- One transaction: the parent leaves the blocking index before the successor insert.
-- close_without_successor never inserts. reserve_successor inserts only when the
-- local subscription check is clear. A failing insert raises and rolls the update back.
create function public.billing_checkout_finish_expiring(
  p_user_id uuid,
  p_attempt_id uuid,
  p_row_version bigint,
  p_stripe_account_id text,
  p_action text,
  p_close_status text,
  p_successor jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.billing_checkout_sessions%rowtype;
  v_successor_id uuid;
  v_idempotency_key uuid;
  v_plan text;
  v_price text;
  v_amount integer;
  v_success text;
  v_cancel text;
  v_updated integer;
begin
  if p_action = 'close_without_successor' then
    if p_successor is not null or p_close_status not in ('expired', 'complete') then
      raise exception 'CHECKOUT_FINISH_REJECTED';
    end if;
  elsif p_action = 'reserve_successor' then
    if p_successor is null or p_close_status is not null then
      raise exception 'CHECKOUT_FINISH_REJECTED';
    end if;
  else
    raise exception 'CHECKOUT_FINISH_REJECTED';
  end if;

  select *
    into v_row
  from public.billing_checkout_sessions
  where id = p_attempt_id
    and user_id = p_user_id
    and row_version = p_row_version
    and status = 'expiring'
    and stripe_account_id = p_stripe_account_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  if p_action = 'close_without_successor' then
    update public.billing_checkout_sessions
      set status = p_close_status,
          row_version = row_version + 1,
          updated_at = clock_timestamp()
    where id = v_row.id
      and user_id = v_row.user_id
      and row_version = v_row.row_version
      and status = 'expiring';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'CHECKOUT_FINISH_CONFLICT';
    end if;
    return jsonb_build_object('outcome', 'closed_without_successor', 'status', p_close_status);
  end if;

  if exists (
    select 1
    from public.billing_subscriptions
    where user_id = p_user_id
      and subscription_status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
  ) then
    update public.billing_checkout_sessions
      set status = 'expired',
          row_version = row_version + 1,
          updated_at = clock_timestamp()
    where id = v_row.id
      and user_id = v_row.user_id
      and row_version = v_row.row_version
      and status = 'expiring';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'CHECKOUT_FINISH_CONFLICT';
    end if;
    return jsonb_build_object('outcome', 'closed_without_successor', 'status', 'expired', 'reason', 'local_subscription');
  end if;

  v_successor_id := (p_successor->>'id')::uuid;
  v_idempotency_key := (p_successor->>'idempotency_key')::uuid;
  v_plan := p_successor->>'plan';
  v_price := p_successor->>'stripe_price_id';
  v_amount := (p_successor->>'unit_amount')::integer;
  v_success := p_successor->>'success_url';
  v_cancel := p_successor->>'cancel_url';

  if v_plan is distinct from v_row.supersede_plan
     or v_successor_id = v_row.id
     or v_idempotency_key = v_row.idempotency_key
     or v_price is null
     or v_price !~ '^price_[A-Za-z0-9]+$'
     or v_success is null
     or v_cancel is null
     or left(v_success, 8) <> 'https://'
     or left(v_cancel, 8) <> 'https://'
     or position('/billing/checkout/return?attempt=' in v_success) = 0
     or position('/billing/checkout/return?attempt=' in v_cancel) = 0
     or position(v_successor_id::text in v_success) = 0
     or position(v_successor_id::text in v_cancel) = 0
  then
    raise exception 'CHECKOUT_SUCCESSOR_REJECTED';
  end if;

  update public.billing_checkout_sessions
    set status = 'expired',
        row_version = row_version + 1,
        updated_at = clock_timestamp()
  where id = v_row.id
    and user_id = v_row.user_id
    and row_version = v_row.row_version
    and status = 'expiring';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'CHECKOUT_FINISH_CONFLICT';
  end if;

  insert into public.billing_checkout_sessions (
    id,
    user_id,
    row_version,
    status,
    idempotency_key,
    create_anchor_at,
    stripe_customer_id,
    stripe_account_id,
    plan,
    stripe_price_id,
    unit_amount,
    currency,
    quantity,
    livemode,
    success_url,
    cancel_url,
    mode,
    adaptive_pricing_enabled,
    automatic_tax_enabled
  ) values (
    v_successor_id,
    v_row.user_id,
    1,
    'pending',
    v_idempotency_key,
    clock_timestamp(),
    v_row.stripe_customer_id,
    v_row.stripe_account_id,
    v_plan,
    v_price,
    v_amount,
    'usd',
    1,
    v_row.livemode,
    v_success,
    v_cancel,
    'subscription',
    false,
    false
  );

  update public.billing_checkout_sessions
    set successor_attempt_id = v_successor_id,
        updated_at = clock_timestamp()
  where id = v_row.id
    and user_id = v_row.user_id
    and status = 'expired'
    and row_version = v_row.row_version + 1
    and successor_attempt_id is null;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'CHECKOUT_FINISH_CONFLICT';
  end if;

  return jsonb_build_object('outcome', 'reserved_successor', 'successor_id', v_successor_id);
end;
$$;

revoke all on function public.billing_checkout_finish_expiring(uuid, uuid, bigint, text, text, text, jsonb) from public;
revoke execute on function public.billing_checkout_finish_expiring(uuid, uuid, bigint, text, text, text, jsonb) from public;
revoke execute on function public.billing_checkout_finish_expiring(uuid, uuid, bigint, text, text, text, jsonb) from anon;
revoke execute on function public.billing_checkout_finish_expiring(uuid, uuid, bigint, text, text, text, jsonb) from authenticated;

grant execute on function public.billing_checkout_finish_expiring(uuid, uuid, bigint, text, text, text, jsonb) to service_role;
