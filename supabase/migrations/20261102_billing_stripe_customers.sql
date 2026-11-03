-- Binds an Autoaffi user to a Stripe customer before any paid subscription row exists.

create table public.billing_stripe_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  constraint billing_stripe_customers_customer_id_key unique (stripe_customer_id)
);

alter table public.billing_stripe_customers enable row level security;

revoke all on table public.billing_stripe_customers from public;
revoke all on table public.billing_stripe_customers from anon;
revoke all on table public.billing_stripe_customers from authenticated;
revoke all on table public.billing_stripe_customers from service_role;

grant select, insert on table public.billing_stripe_customers to service_role;
