-- Pair invoice.paid with invoice_payment.paid before paid_until moves.
-- A lone invoice half or payment half never updates billing_subscriptions.
-- A matching pair may set paid_until before any subscription status event.
-- getPaidPlan still grants none until the row belongs to the user and the
-- status is active or past_due. Status ordering stays in billing_status_conflict:
-- an older or less restrictive status does not reactivate a finished subscription.
--
-- Stripe can attach one PaymentIntent to more than one invoice. The unique
-- payment_intent_id below is this product's narrower rule: one PaymentIntent
-- is proof for only one invoice. It is not a general Stripe uniqueness rule.
-- invoice_payment.id (inpay_) is Stripe's identity for one payment object on
-- one invoice. evt_ is only the delivery. A new evt_ for the same inpay_ is
-- the same proof only when currency, both amounts, invoice, PaymentIntent,
-- status, and is_default all match. The invoice half uses the same rule for
-- its commercial fields. Changed content is a conflict, not a duplicate.
--
-- Lock order, for every action that takes the later locks:
-- 1. event id advisory
-- 2. invoice id advisory, then invoice payment id, then payment intent id
-- 3. billing_lock_stripe_customer
-- 4. billing_subscriptions FOR UPDATE
-- Status events have no invoice id, so they start at step 3.
-- A payment event takes step 3 only while applying a stored invoice half.
-- It never inserts a customer binding.

alter table public.billing_stripe_events
  drop constraint billing_stripe_events_outcome_check;

alter table public.billing_stripe_events
  add constraint billing_stripe_events_outcome_check
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
    'invoice_applied',
    'invoice_awaiting_payment',
    'payment_awaiting_invoice',
    'invoice_already_recorded',
    'invoice_conflict',
    'payment_already_recorded',
    'payment_conflict',
    'payment_reused'
  ));

create table public.billing_stripe_invoice_proofs (
  stripe_invoice_id text primary key,
  invoice_event_id text null unique references public.billing_stripe_events (event_id),
  payment_event_id text null unique references public.billing_stripe_events (event_id),
  invoice_payment_id text null unique,
  payment_intent_id text null unique,
  user_id uuid null references auth.users (id) on delete cascade,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_price_id text null,
  paid_plan text null,
  amount_paid integer null,
  amount_requested integer null,
  currency text null,
  payment_status text null,
  is_default boolean null,
  period_start timestamptz null,
  period_end timestamptz null,
  livemode boolean not null default false,
  applied_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint billing_stripe_invoice_proofs_invoice_check
    check (stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$'),
  constraint billing_stripe_invoice_proofs_payment_id_check
    check (invoice_payment_id is null or invoice_payment_id ~ '^inpay_[A-Za-z0-9_]+$'),
  constraint billing_stripe_invoice_proofs_intent_check
    check (payment_intent_id is null or payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  constraint billing_stripe_invoice_proofs_customer_check
    check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoice_proofs_subscription_check
    check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoice_proofs_price_check
    check (stripe_price_id is null or stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  constraint billing_stripe_invoice_proofs_currency_check
    check (currency is null or currency = 'usd'),
  constraint billing_stripe_invoice_proofs_payment_status_check
    check (payment_status is null or payment_status = 'paid'),
  constraint billing_stripe_invoice_proofs_default_check
    check (is_default is null or is_default = true),
  constraint billing_stripe_invoice_proofs_livemode_check
    check (livemode = false),
  constraint billing_stripe_invoice_proofs_amounts_check
    check (
      (amount_paid is null or amount_paid in (700, 1900, 3900))
      and (amount_requested is null or amount_requested = amount_paid)
    ),
  constraint billing_stripe_invoice_proofs_plan_check
    check (
      paid_plan is null
      or (paid_plan = 'basic' and amount_paid = 700)
      or (paid_plan = 'pro' and amount_paid = 1900)
      or (paid_plan = 'elite' and amount_paid = 3900)
    ),
  constraint billing_stripe_invoice_proofs_period_check
    check (
      (period_start is null and period_end is null)
      or (period_start is not null and period_end is not null and period_end > period_start)
    ),
  constraint billing_stripe_invoice_proofs_user_check
    check (user_id is null or stripe_customer_id is not null),
  constraint billing_stripe_invoice_proofs_payment_shape_check
    check (
      invoice_payment_id is null
      or (
        payment_intent_id is not null
        and amount_paid is not null
        and amount_requested is not null
        and currency = 'usd'
        and payment_status = 'paid'
        and is_default = true
      )
    ),
  constraint billing_stripe_invoice_proofs_invoice_shape_check
    check (
      invoice_event_id is null
      or (
        user_id is not null
        and stripe_customer_id is not null
        and stripe_subscription_id is not null
        and stripe_price_id is not null
        and paid_plan is not null
        and amount_paid is not null
        and currency = 'usd'
        and period_start is not null
        and period_end is not null
      )
    ),
  constraint billing_stripe_invoice_proofs_applied_check
    check (
      applied_at is null
      or (
        invoice_event_id is not null
        and payment_event_id is not null
        and invoice_payment_id is not null
        and payment_intent_id is not null
      )
    ),
  constraint billing_stripe_invoice_proofs_customer_binding_fkey
    foreign key (user_id, stripe_customer_id)
    references public.billing_stripe_customers (user_id, stripe_customer_id)
);

comment on column public.billing_stripe_invoice_proofs.payment_intent_id is
  'Unique here by product rule. Stripe itself allows one PaymentIntent on multiple invoices.';

alter table public.billing_stripe_invoice_proofs enable row level security;

revoke all on table public.billing_stripe_invoice_proofs from public;
revoke all on table public.billing_stripe_invoice_proofs from anon;
revoke all on table public.billing_stripe_invoice_proofs from authenticated;
revoke all on table public.billing_stripe_invoice_proofs from service_role;

grant select, insert, update on table public.billing_stripe_invoice_proofs to service_role;

-- Replaces the 18-argument function created in 20261112_billing_stripe_events.sql.
-- The argument list below is that overload. Dropping it leaves no old call path.
drop function public.billing_apply_stripe_event(
  text,
  text,
  timestamptz,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  integer,
  timestamptz,
  timestamptz,
  text
);

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
  p_metadata_user_id text,
  p_invoice_payment_id text,
  p_payment_intent_id text,
  p_amount_requested integer,
  p_currency text,
  p_payment_status text,
  p_is_default boolean
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
  v_proof public.billing_stripe_invoice_proofs%rowtype;
  v_have_proof boolean := false;
  v_from_payment boolean := false;
  v_store_invoice_half boolean := false;
  v_store_payment_half boolean := false;
  v_complete_invoice boolean := false;
  v_complete_payment boolean := false;
  v_apply_pair boolean := false;
  v_saved_invoice_event text;
  v_ledger_event text;
  v_same_payment boolean := false;
  v_same_invoice boolean := false;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     or p_event_type is null or p_event_type !~ '^[a-z0-9_.]+$'
     or p_event_created is null
     or p_livemode is null
     or p_action is null
     or p_action not in ('invoice', 'status', 'reject', 'payment')
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
  if p_invoice_payment_id is not null and p_invoice_payment_id !~ '^inpay_[A-Za-z0-9_]+$' then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;
  if p_payment_intent_id is not null and p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'BILLING_EVENT_REJECTED';
  end if;

  if p_invoice_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('stripe-invoice:' || p_invoice_id, 0));
  end if;
  if p_invoice_payment_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('stripe-invoice-payment:' || p_invoice_payment_id, 0));
  end if;
  if p_payment_intent_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('stripe-payment-intent:' || p_payment_intent_id, 0));
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
  elsif p_action = 'payment' then
    if p_invoice_payment_id is not null then
      select *
        into v_proof
      from public.billing_stripe_invoice_proofs
      where invoice_payment_id = p_invoice_payment_id;
      v_have_proof := found;
    end if;

    if v_have_proof then
      v_same_payment :=
        v_proof.stripe_invoice_id is not distinct from p_invoice_id
        and v_proof.payment_intent_id is not distinct from p_payment_intent_id
        and v_proof.amount_paid is not distinct from p_amount
        and v_proof.amount_requested is not distinct from p_amount_requested
        and v_proof.currency is not distinct from p_currency
        and v_proof.payment_status is not distinct from p_payment_status
        and v_proof.is_default is not distinct from p_is_default
        and p_customer_id is null
        and p_subscription_id is null
        and p_metadata_user_id is null;
      if v_same_payment then
        v_outcome := 'payment_already_recorded';
      else
        v_outcome := 'payment_conflict';
      end if;
    elsif p_payment_intent_id is not null and exists (
      select 1
      from public.billing_stripe_invoice_proofs
      where payment_intent_id = p_payment_intent_id
        and stripe_invoice_id is distinct from p_invoice_id
    ) then
      v_outcome := 'payment_reused';
    elsif p_invoice_id is null
       or p_invoice_payment_id is null
       or p_payment_intent_id is null
       or p_amount is null
       or p_amount not in (700, 1900, 3900)
       or p_amount_requested is distinct from p_amount
       or p_currency is distinct from 'usd'
       or p_payment_status is distinct from 'paid'
       or p_is_default is distinct from true
       or p_customer_id is not null
       or p_subscription_id is not null
       or p_price_id is not null
       or p_plan is not null
       or p_period_start is not null
       or p_period_end is not null
       or p_metadata_user_id is not null
       or p_status is not null
       or p_cancel_at_period_end is not null
    then
      raise exception 'BILLING_EVENT_REJECTED';
    else
      select *
        into v_proof
      from public.billing_stripe_invoice_proofs
      where stripe_invoice_id = p_invoice_id;
      v_have_proof := found;
      if v_have_proof and v_proof.invoice_payment_id is not null then
        v_outcome := 'payment_conflict';
      elsif v_have_proof and v_proof.invoice_event_id is not null then
        if v_proof.amount_paid is not distinct from p_amount
           and v_proof.currency is not distinct from p_currency
        then
          v_from_payment := true;
          v_saved_invoice_event := v_proof.invoice_event_id;
          p_customer_id := v_proof.stripe_customer_id;
          p_subscription_id := v_proof.stripe_subscription_id;
          p_price_id := v_proof.stripe_price_id;
          p_plan := v_proof.paid_plan;
          p_amount := v_proof.amount_paid;
          p_period_start := v_proof.period_start;
          p_period_end := v_proof.period_end;
        else
          v_outcome := 'payment_conflict';
        end if;
      elsif v_have_proof then
        v_outcome := 'payment_conflict';
      else
        v_store_payment_half := true;
        v_outcome := 'payment_awaiting_invoice';
      end if;
    end if;
  end if;

  if p_action in ('invoice', 'status') or v_from_payment then
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
            'invoice_awaiting_payment',
            'invoice_already_recorded',
            'invoice_duplicate',
            'price_mismatch'
          )
        order by e.event_created asc, e.event_id asc
        limit 1;
      end if;

      if v_outcome is null and v_identity is not null and v_identity is distinct from p_subscription_id then
        v_outcome := 'subscription_mismatch';
      end if;

      if v_outcome is null and p_action = 'status' and not v_from_payment then
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
      elsif v_outcome is null and (p_action = 'invoice' or v_from_payment) then
        select *
          into v_proof
        from public.billing_stripe_invoice_proofs
        where stripe_invoice_id = p_invoice_id;
        v_have_proof := found;

        if not v_from_payment and v_have_proof and v_proof.invoice_event_id is not null then
          v_same_invoice :=
            v_proof.stripe_customer_id is not distinct from p_customer_id
            and v_proof.stripe_subscription_id is not distinct from p_subscription_id
            and v_proof.stripe_price_id is not distinct from p_price_id
            and v_proof.paid_plan is not distinct from p_plan
            and v_proof.amount_paid is not distinct from p_amount
            and v_proof.currency is not distinct from p_currency
            and v_proof.period_start is not distinct from p_period_start
            and v_proof.period_end is not distinct from p_period_end
            and v_proof.user_id is not distinct from v_user;
          if v_same_invoice then
            v_outcome := 'invoice_already_recorded';
          else
            v_outcome := 'invoice_conflict';
          end if;
        else
          if p_invoice_id is null
             or p_price_id is null
             or p_price_id !~ '^price_[A-Za-z0-9]+$'
             or p_plan is null
             or p_amount is null
             or p_period_start is null
             or p_period_end is null
             or p_period_end <= p_period_start
             or p_currency is distinct from 'usd'
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
            v_outcome := 'invoice_already_recorded';
          elsif v_from_payment or (v_have_proof and v_proof.invoice_payment_id is not null) then
            if not v_from_payment and (
              v_proof.amount_paid is distinct from p_amount
              or v_proof.currency is distinct from 'usd'
              or v_proof.payment_status is distinct from 'paid'
              or v_proof.is_default is distinct from true
            ) then
              v_outcome := 'invoice_conflict';
            else
              v_apply_pair := true;
            end if;
          elsif v_have_proof and v_proof.invoice_payment_id is null and v_proof.payment_event_id is not null then
            v_outcome := 'invoice_conflict';
          else
            v_store_invoice_half := true;
            v_outcome := 'invoice_awaiting_payment';
          end if;
        end if;

        if v_apply_pair then
          if not v_have_row then
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
          if v_from_payment then
            v_complete_payment := true;
            v_ledger_event := v_saved_invoice_event;
          else
            v_complete_invoice := true;
            v_ledger_event := p_event_id;
          end if;
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
    case when p_action = 'status' and not v_from_payment then p_status else null end,
    case when p_action = 'status' and not v_from_payment then p_cancel_at_period_end else null end
  );

  if v_store_payment_half then
    insert into public.billing_stripe_invoice_proofs (
      stripe_invoice_id,
      payment_event_id,
      invoice_payment_id,
      payment_intent_id,
      amount_paid,
      amount_requested,
      currency,
      payment_status,
      is_default,
      livemode
    ) values (
      p_invoice_id,
      p_event_id,
      p_invoice_payment_id,
      p_payment_intent_id,
      p_amount,
      p_amount_requested,
      p_currency,
      p_payment_status,
      p_is_default,
      false
    );
  elsif v_store_invoice_half then
    insert into public.billing_stripe_invoice_proofs (
      stripe_invoice_id,
      invoice_event_id,
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
  elsif v_complete_payment then
    update public.billing_stripe_invoice_proofs
      set payment_event_id = p_event_id,
          invoice_payment_id = p_invoice_payment_id,
          payment_intent_id = p_payment_intent_id,
          amount_requested = p_amount_requested,
          payment_status = p_payment_status,
          is_default = p_is_default,
          applied_at = clock_timestamp()
    where stripe_invoice_id = p_invoice_id
      and payment_event_id is null
      and invoice_event_id = v_saved_invoice_event
      and amount_paid = p_amount
      and currency = 'usd';
    if not found then
      raise exception 'BILLING_EVENT_CONFLICT';
    end if;
  elsif v_complete_invoice then
    update public.billing_stripe_invoice_proofs
      set invoice_event_id = p_event_id,
          user_id = v_user,
          stripe_customer_id = p_customer_id,
          stripe_subscription_id = p_subscription_id,
          stripe_price_id = p_price_id,
          paid_plan = p_plan,
          currency = 'usd',
          period_start = p_period_start,
          period_end = p_period_end,
          applied_at = clock_timestamp()
    where stripe_invoice_id = p_invoice_id
      and invoice_event_id is null
      and payment_event_id is not null
      and amount_paid = p_amount
      and currency = 'usd'
      and payment_status = 'paid'
      and is_default = true;
    if not found then
      raise exception 'BILLING_EVENT_CONFLICT';
    end if;
  end if;

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
      v_ledger_event,
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

revoke all on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text, text, text, integer, text, text, boolean) from public;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text, text, text, integer, text, text, boolean) from public;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text, text, text, integer, text, text, boolean) from anon;
revoke execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text, text, text, integer, text, text, boolean) from authenticated;

grant execute on function public.billing_apply_stripe_event(text, text, timestamptz, boolean, text, text, text, text, text, text, boolean, text, text, text, integer, timestamptz, timestamptz, text, text, text, integer, text, text, boolean) to service_role;
