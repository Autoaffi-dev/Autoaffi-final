-- Paid subscription snapshot for server-side entitlement.
-- Access is not granted by pending_plan. No invoice ledger and no event-order columns.

create table public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  stripe_price_id text not null,
  paid_plan text not null,
  paid_until timestamptz not null,
  subscription_status text not null,
  cancel_at_period_end boolean not null default false,
  pending_plan text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_paid_plan_check
    check (paid_plan in ('basic', 'pro', 'elite')),
  constraint billing_subscriptions_pending_plan_check
    check (pending_plan is null or pending_plan in ('basic', 'pro', 'elite')),
  constraint billing_subscriptions_status_check
    check (subscription_status in (
      'active',
      'past_due',
      'trialing',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )),
  constraint billing_subscriptions_subscription_id_key
    unique (stripe_subscription_id),
  constraint billing_subscriptions_customer_id_key
    unique (stripe_customer_id)
);

alter table public.billing_subscriptions enable row level security;

revoke all on table public.billing_subscriptions from public;
revoke all on table public.billing_subscriptions from anon;
revoke all on table public.billing_subscriptions from authenticated;
revoke all on table public.billing_subscriptions from service_role;

grant select, insert, update on table public.billing_subscriptions to service_role;
