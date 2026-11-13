-- Test-mode Stripe webhook ledger.
-- The test receiver rejects signed livemode=true before calling this function,
-- so those events are not stored by the application. The live check below stays
-- as a backstop and does not apply live data. livemode=false does not by itself
-- isolate the database; a test-mode row is written to whichever database runs
-- this migration.
-- paid_until moves only from an accepted invoice.paid row.
-- subscription status moves only from customer.subscription events.
-- Equal event.created values are not Stripe's order. A denying status beats
-- active and past_due, trialing beats past_due, and cancel_at_period_end true
-- beats false when the status is the same. A recorded tie still needs a later
-- Stripe subscription read before it can be treated as reconciled.
-- This step does not replace one subscription id with another.
-- Discounts, credits, refunds, prorations, and trial access are not applied.
-- incomplete with a null status_event_id means no status event has been folded
-- in yet. getPaidPlan does not grant that placeholder.

alter table public.billing_subscriptions
  add column status_event_created timestamptz null,
  add column status_event_id text null,
  add constraint billing_subscriptions_status_event_check
    check (
      (status_event_id is null and status_event_created is null)
      or (
        status_event_id ~ '^evt_[A-Za-z0-9_]+$'
        and status_event_created is not null
      )
    );

comment on column public.billing_subscriptions.status_event_id is
  'Last applied customer.subscription event. Null means the status is still the unconfirmed placeholder.';

create table public.billing_stripe_events (
  event_id text primary key,
  event_type text not null,
  event_created timestamptz not null,
  livemode boolean not null,
  api_version text null,
  outcome text not null,
  user_id uuid null references auth.users (id) on delete cascade,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_invoice_id text null,
  subscription_status text null,
  cancel_at_period_end boolean null,
  created_at timestamptz not null default now(),
  constraint billing_stripe_events_event_id_check
    check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint billing_stripe_events_type_check
    check (event_type ~ '^[a-z0-9_.]+$'),
  constraint billing_stripe_events_customer_check
    check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_stripe_events_subscription_check
    check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  constraint billing_stripe_events_invoice_check
    check (stripe_invoice_id is null or stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$'),
  constraint billing_stripe_events_status_check
    check (
      subscription_status is null
      or subscription_status in (
        'active',
        'past_due',
        'trialing',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    ),
  constraint billing_stripe_events_live_check
    check (livemode = false or outcome = 'livemode_rejected'),
  constraint billing_stripe_events_pending_check
    check (
      outcome <> 'status_pending'
      or (
        subscription_status is not null
        and cancel_at_period_end is not null
        and stripe_subscription_id is not null
        and user_id is not null
      )
    ),
  constraint billing_stripe_events_outcome_check
    check (outcome in (
      'livemode_rejected',
      'api_version_mismatch',
      'not_payment_proof',
      'refund_not_applied',
      'ignored_type',
      'payload_rejected',
      'id_rejected',
      'customer_rejected',
      'metadata_mismatch',
      'discount_not_in_scope',
      'credit_not_in_scope',
      'payment_not_in_stripe',
      'paid_out_of_band',
      'amount_mismatch',
      'tax_not_in_scope',
      'proration_not_in_scope',
      'deleted_status_unexpected',
      'status_rejected',
      'subscription_mismatch',
      'customer_mismatch',
      'price_mismatch',
      'invoice_duplicate',
      'status_pending',
      'status_applied',
      'tie_applied_stricter',
      'tie_rejected_less_restrictive',
      'tie_unchanged',
      'stale_status',
      'invoice_applied'
    ))
);

create index billing_stripe_events_identity_idx
  on public.billing_stripe_events (user_id, event_created, event_id);

create index billing_stripe_events_pending_idx
  on public.billing_stripe_events (user_id, stripe_subscription_id, event_created, event_id)
  where outcome = 'status_pending';

alter table public.billing_stripe_events enable row level security;

revoke all on table public.billing_stripe_events from public;
revoke all on table public.billing_stripe_events from anon;
revoke all on table public.billing_stripe_events from authenticated;
revoke all on table public.billing_stripe_events from service_role;

grant select, insert on table public.billing_stripe_events to service_role;

create table public.billing_stripe_invoices (
  stripe_invoice_id text primary key,
  event_id text not null unique references public.billing_stripe_events (event_id),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  stripe_price_id text not null,
  paid_plan text not null,
  amount_paid integer not null,
  currency text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  livemode boolean not null,
  created_at timestamptz not null default now(),
  constraint billing_stripe_invoices_invoice_check
    check (stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$'),
  constraint billing_stripe_invoices_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoices_subscription_check
    check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoices_price_check
    check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoices_plan_amount_check
    check (
      (paid_plan = 'basic' and amount_paid = 700)
      or (paid_plan = 'pro' and amount_paid = 1900)
      or (paid_plan = 'elite' and amount_paid = 3900)
    ),
  constraint billing_stripe_invoices_currency_check
    check (currency = 'usd'),
  constraint billing_stripe_invoices_period_check
    check (period_end > period_start),
  constraint billing_stripe_invoices_livemode_check
    check (livemode = false),
  constraint billing_stripe_invoices_customer_binding_fkey
    foreign key (user_id, stripe_customer_id)
    references public.billing_stripe_customers (user_id, stripe_customer_id)
);

alter table public.billing_stripe_invoices enable row level security;

revoke all on table public.billing_stripe_invoices from public;
revoke all on table public.billing_stripe_invoices from anon;
revoke all on table public.billing_stripe_invoices from authenticated;
revoke all on table public.billing_stripe_invoices from service_role;

grant select, insert on table public.billing_stripe_invoices to service_role;

-- Locks the existing customer binding. service_role has no update grant on
-- that table, so the lock lives in a definer function that does not modify it.
create function public.billing_lock_stripe_customer(p_customer_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_customer_id is null or p_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    return null;
  end if;

  select user_id
    into v_user
  from public.billing_stripe_customers
  where stripe_customer_id = p_customer_id
  for update;

  return v_user;
end;
$$;

-- Higher rank wins at the same event.created. Ranks 30 and above are exactly
-- the statuses getPaidPlan denies, so they beat past_due (20) and active (10).
create function public.billing_status_rank(p_status text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_status
    when 'incomplete_expired' then 80
    when 'canceled' then 70
    when 'unpaid' then 60
    when 'paused' then 50
    when 'incomplete' then 40
    when 'trialing' then 30
    when 'past_due' then 20
    when 'active' then 10
    else null
  end;
$$;

create function public.billing_status_conflict(
  p_stored_status text,
  p_stored_cancel boolean,
  p_stored_created timestamptz,
  p_stored_event_id text,
  p_next_status text,
  p_next_cancel boolean,
  p_next_created timestamptz,
  p_next_event_id text
) returns table (
  subscription_status text,
  cancel_at_period_end boolean,
  event_created timestamptz,
  event_id text,
  outcome text
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_stored_rank integer;
  v_next_rank integer;
begin
  if p_next_status is null or p_next_cancel is null or p_next_created is null or p_next_event_id is null then
    raise exception 'BILLING_STATUS_REJECTED';
  end if;
  if public.billing_status_rank(p_next_status) is null then
    raise exception 'BILLING_STATUS_REJECTED';
  end if;

  if p_stored_created is null or p_next_created > p_stored_created then
    subscription_status := p_next_status;
    cancel_at_period_end := p_next_cancel;
    event_created := p_next_created;
    event_id := p_next_event_id;
    outcome := 'status_applied';
    return next;
    return;
  end if;

  if p_next_created < p_stored_created then
    subscription_status := p_stored_status;
    cancel_at_period_end := p_stored_cancel;
    event_created := p_stored_created;
    event_id := p_stored_event_id;
    outcome := 'stale_status';
    return next;
    return;
  end if;

  v_stored_rank := public.billing_status_rank(p_stored_status);
  v_next_rank := public.billing_status_rank(p_next_status);
  if v_stored_rank is null then
    raise exception 'BILLING_STATUS_REJECTED';
  end if;

  if v_next_rank > v_stored_rank then
    subscription_status := p_next_status;
    cancel_at_period_end := p_next_cancel;
    event_created := p_stored_created;
    event_id := p_next_event_id;
    outcome := 'tie_applied_stricter';
    return next;
    return;
  end if;

  if v_next_rank < v_stored_rank then
    subscription_status := p_stored_status;
    cancel_at_period_end := p_stored_cancel;
    event_created := p_stored_created;
    event_id := p_stored_event_id;
    outcome := 'tie_rejected_less_restrictive';
    return next;
    return;
  end if;

  if p_next_cancel and not p_stored_cancel then
    subscription_status := p_stored_status;
    cancel_at_period_end := true;
    event_created := p_stored_created;
    event_id := p_next_event_id;
    outcome := 'tie_applied_stricter';
    return next;
    return;
  end if;

  if p_stored_cancel and not p_next_cancel then
    subscription_status := p_stored_status;
    cancel_at_period_end := true;
    event_created := p_stored_created;
    event_id := p_stored_event_id;
    outcome := 'tie_rejected_less_restrictive';
    return next;
    return;
  end if;

  subscription_status := p_stored_status;
  cancel_at_period_end := p_stored_cancel;
  event_created := p_stored_created;
  event_id := p_stored_event_id;
  outcome := 'tie_unchanged';
  return next;
end;
$$;

create function public.billing_apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_event_created timestamptz,
  p_livemode boolean,
  p_api_version text,
  p_action text,
  p_outcome text,
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_cancel_at_period_end boolean,
  p_invoice_id text,
  p_price_id text,
  p_plan text,
  p_amount integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_metadata_user_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing text;
  v_user uuid;
  v_row public.billing_subscriptions%rowtype;
  v_have_row boolean := false;
  v_identity text;
  v_outcome text;
  v_create boolean := false;
  v_touch_status boolean := false;
  v_touch_paid boolean := false;
  v_write_invoice boolean := false;
  v_status text;
  v_cancel boolean;
  v_status_created timestamptz;
  v_status_event text;
  v_fold_status text;
  v_fold_cancel boolean;
  v_fold_created timestamptz;
  v_fold_event text;
  v_pending record;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     or p_event_type is null or p_event_type !~ '^[a-z0-9_.]+$'
     or p_event_created is null
     or p_livemode is null
     or p_action is null
     or p_action not in ('invoice', 'status', 'reject')
  then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));

  select outcome
    into v_existing
  from public.billing_stripe_events
  where event_id = p_event_id;
  if found then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  if p_livemode then
    insert into public.billing_stripe_events (
      event_id,
      event_type,
      event_created,
      livemode,
      api_version,
      outcome,
      stripe_customer_id,
      stripe_subscription_id
    ) values (
      p_event_id,
      p_event_type,
      p_event_created,
      true,
      p_api_version,
      'livemode_rejected',
      case when p_customer_id ~ '^cus_[A-Za-z0-9]+$' then p_customer_id else null end,
      case when p_subscription_id ~ '^sub_[A-Za-z0-9]+$' then p_subscription_id else null end
    );
    return jsonb_build_object('outcome', 'livemode_rejected');
  end if;

  if p_customer_id is not null and p_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;
  if p_subscription_id is not null and p_subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;
  if p_invoice_id is not null and p_invoice_id !~ '^in_[A-Za-z0-9_]+$' then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;

  if p_action = 'reject' then
    if p_outcome is null or p_outcome not in (
      'api_version_mismatch',
      'not_payment_proof',
      'refund_not_applied',
      'ignored_type',
      'payload_rejected',
      'id_rejected',
      'customer_rejected',
      'metadata_mismatch',
      'discount_not_in_scope',
      'credit_not_in_scope',
      'payment_not_in_stripe',
      'paid_out_of_band',
      'amount_mismatch',
      'tax_not_in_scope',
      'proration_not_in_scope',
      'deleted_status_unexpected',
      'status_rejected'
    ) then
      raise exception 'BILLING_EVENT_REJECTED';
    end if;
    v_outcome := p_outcome;
    if p_customer_id is not null then
      v_user := public.billing_lock_stripe_customer(p_customer_id);
    end if;
  else
    if p_customer_id is null or p_subscription_id is null then
      raise exception 'BILLING_EVENT_REJECTED';
    end if;

    v_user := public.billing_lock_stripe_customer(p_customer_id);
    if v_user is null then
      return jsonb_build_object('outcome', 'binding_missing');
    end if;

    if p_metadata_user_id is not null and p_metadata_user_id is distinct from v_user::text then
      v_outcome := 'metadata_mismatch';
    else
      select *
        into v_row
      from public.billing_subscriptions
      where user_id = v_user
      for update;
      v_have_row := found;

      if v_have_row then
        v_identity := v_row.stripe_subscription_id;
        if v_row.stripe_customer_id is distinct from p_customer_id then
          v_outcome := 'customer_mismatch';
        end if;
      else
        select e.stripe_subscription_id
          into v_identity
        from public.billing_stripe_events e
        where e.user_id = v_user
          and e.stripe_subscription_id is not null
          and e.outcome in (
            'status_pending',
            'status_applied',
            'tie_applied_stricter',
            'tie_rejected_less_restrictive',
            'tie_unchanged',
            'stale_status',
            'invoice_applied',
            'invoice_duplicate',
            'price_mismatch'
          )
        order by e.event_created asc, e.event_id asc
        limit 1;
      end if;

      if v_outcome is null and v_identity is not null and v_identity is distinct from p_subscription_id then
        v_outcome := 'subscription_mismatch';
      end if;

      if v_outcome is null and p_action = 'status' then
        if p_status is null
           or p_cancel_at_period_end is null
           or public.billing_status_rank(p_status) is null
        then
          raise exception 'BILLING_EVENT_REJECTED';
        end if;
        if not v_have_row then
          v_outcome := 'status_pending';
        else
          select
            d.subscription_status,
            d.cancel_at_period_end,
            d.event_created,
            d.event_id,
            d.outcome
          into
            v_status,
            v_cancel,
            v_status_created,
            v_status_event,
            v_outcome
          from public.billing_status_conflict(
            case when v_row.status_event_id is null then null else v_row.subscription_status end,
            case when v_row.status_event_id is null then null else v_row.cancel_at_period_end end,
            case when v_row.status_event_id is null then null else v_row.status_event_created end,
            v_row.status_event_id,
            p_status,
            p_cancel_at_period_end,
            p_event_created,
            p_event_id
          ) as d;
          if v_outcome in ('status_applied', 'tie_applied_stricter') then
            v_touch_status := true;
          end if;
        end if;
      elsif v_outcome is null and p_action = 'invoice' then
        if p_invoice_id is null
           or p_price_id is null
           or p_price_id !~ '^price_[A-Za-z0-9]+$'
           or p_plan is null
           or p_amount is null
           or p_period_start is null
           or p_period_end is null
           or p_period_end <= p_period_start
           or p_plan not in ('basic', 'pro', 'elite')
           or (p_plan = 'basic' and p_amount <> 700)
           or (p_plan = 'pro' and p_amount <> 1900)
           or (p_plan = 'elite' and p_amount <> 3900)
        then
          raise exception 'BILLING_EVENT_REJECTED';
        end if;

        if v_have_row and (
          v_row.stripe_price_id is distinct from p_price_id
          or v_row.paid_plan is distinct from p_plan
        ) then
          v_outcome := 'price_mismatch';
        elsif exists (
          select 1
          from public.billing_stripe_invoices
          where stripe_invoice_id = p_invoice_id
        ) then
          v_outcome := 'invoice_duplicate';
        elsif not v_have_row then
          v_fold_created := null;
          v_fold_event := null;
          v_fold_status := null;
          v_fold_cancel := null;
          for v_pending in
            select event_id, event_created, subscription_status, cancel_at_period_end
            from public.billing_stripe_events
            where user_id = v_user
              and stripe_subscription_id = p_subscription_id
              and outcome = 'status_pending'
            order by event_created asc, event_id asc
          loop
            select
              d.subscription_status,
              d.cancel_at_period_end,
              d.event_created,
              d.event_id,
              d.outcome
            into
              v_fold_status,
              v_fold_cancel,
              v_fold_created,
              v_fold_event,
              v_outcome
            from public.billing_status_conflict(
              case when v_fold_created is null then null else v_fold_status end,
              case when v_fold_created is null then null else v_fold_cancel end,
              v_fold_created,
              v_fold_event,
              v_pending.subscription_status,
              v_pending.cancel_at_period_end,
              v_pending.event_created,
              v_pending.event_id
            ) as d;
          end loop;
          v_status := coalesce(v_fold_status, 'incomplete');
          v_cancel := coalesce(v_fold_cancel, false);
          v_status_created := v_fold_created;
          v_status_event := v_fold_event;
          v_create := true;
          v_write_invoice := true;
          v_outcome := 'invoice_applied';
        else
          v_touch_paid := true;
          v_write_invoice := true;
          v_outcome := 'invoice_applied';
        end if;
      end if;
    end if;
  end if;

  if v_outcome is null then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;

  insert into public.billing_stripe_events (
    event_id,
    event_type,
    event_created,
    livemode,
    api_version,
    outcome,
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_invoice_id,
    subscription_status,
    cancel_at_period_end
  ) values (
    p_event_id,
    p_event_type,
    p_event_created,
    false,
    p_api_version,
    v_outcome,
    v_user,
    p_customer_id,
    p_subscription_id,
    p_invoice_id,
    case when p_action = 'status' then p_status else null end,
    case when p_action = 'status' then p_cancel_at_period_end else null end
  );

  if v_create then
    insert into public.billing_subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      paid_plan,
      paid_until,
      subscription_status,
      cancel_at_period_end,
      status_event_created,
      status_event_id
    ) values (
      v_user,
      p_customer_id,
      p_subscription_id,
      p_price_id,
      p_plan,
      p_period_end,
      v_status,
      v_cancel,
      v_status_created,
      v_status_event
    );
  elsif v_touch_status then
    update public.billing_subscriptions
      set subscription_status = v_status,
          cancel_at_period_end = v_cancel,
          status_event_created = v_status_created,
          status_event_id = v_status_event,
          updated_at = clock_timestamp()
    where user_id = v_user
      and stripe_subscription_id = p_subscription_id;
    if not found then
      raise exception 'BILLING_EVENT_CONFLICT';
    end if;
  elsif v_touch_paid then
    update public.billing_subscriptions
      set paid_until = greatest(paid_until, p_period_end),
          updated_at = clock_timestamp()
    where user_id = v_user
      and stripe_subscription_id = p_subscription_id;
    if not found then
      raise exception 'BILLING_EVENT_CONFLICT';
    end if;
  end if;

  if v_write_invoice then
    insert into public.billing_stripe_invoices (
      stripe_invoice_id,
      event_id,
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      paid_plan,
      amount_paid,
      currency,
      period_start,
      period_end,
      livemode
    ) values (
      p_invoice_id,
      p_event_id,
      v_user,
      p_customer_id,
      p_subscription_id,
      p_price_id,
      p_plan,
      p_amount,
      'usd',
      p_period_start,
      p_period_end,
      false
    );
  end if;

  return jsonb_build_object('outcome', v_outcome);
end;
$$;

revoke all on function public.billing_lock_stripe_customer(text) from public;
revoke execute on function public.billing_lock_stripe_customer(text) from public;
revoke execute on function public.billing_lock_stripe_customer(text) from anon;
revoke execute on function public.billing_lock_stripe_customer(text) from authenticated;

revoke all on function public.billing_status_rank(text) from public;
revoke execute on function public.billing_status_rank(text) from public;
revoke execute on function public.billing_status_rank(text) from anon;
revoke execute on function public.billing_status_rank(text) from authenticated;

revoke all on function public.billing_status_conflict(text, boolean, timestamptz, text, text, boolean, timestamptz, text) from public;
revoke execute on function public.billing_status_conflict(text, boolean, timestamptz, text, text, boolean, timestamptz, text) from public;
revoke execute on function public.billing_status_conflict(text, boolean, timestamptz, text, text, boolean, timestamptz, text) from anon;
revoke execute on function public.billing_status_conflict(text, boolean, timestamptz, text, text, boolean, timestamptz, text) from authenticated;

revoke all on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text) from public;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text) from public;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text) from anon;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text) from authenticated;

grant execute on function public.billing_lock_stripe_customer(text) to service_role;
grant execute on function public.billing_status_rank(text) to service_role;
grant execute on function public.billing_status_conflict(text, boolean, timestamptz, text, text, boolean, timestamptz, text) to service_role;
grant execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text) to service_role;
