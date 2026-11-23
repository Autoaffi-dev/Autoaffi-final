-- Read-only billing catalog check. Safe when the tables or functions are absent.
-- It does not insert, update, delete, or change roles. Run it as a reader.
-- Compare the rows with the migration files. Do not infer a single version when
-- the objects disagree.

select object_name, object_kind, present
from (
  values
    ('public.billing_subscriptions', 'table'),
    ('public.billing_stripe_customers', 'table'),
    ('public.billing_checkout_sessions', 'table'),
    ('public.billing_stripe_events', 'table'),
    ('public.billing_stripe_invoices', 'table'),
    ('public.billing_stripe_invoice_proofs', 'table'),
    ('public.billing_apply_stripe_event', 'function'),
    ('public.billing_lock_stripe_customer', 'function'),
    ('public.billing_status_rank', 'function'),
    ('public.billing_status_conflict', 'function'),
    ('public.billing_checkout_finish_expiring', 'function')
) as expected(object_name, object_kind)
cross join lateral (
  select to_regclass(expected.object_name) is not null
      or exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = split_part(expected.object_name, '.', 2)
      ) as present
) found
order by 1;

select
  coalesce(c.relname, 'missing') as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
from (
  values
    ('billing_subscriptions'),
    ('billing_stripe_customers'),
    ('billing_checkout_sessions'),
    ('billing_stripe_events'),
    ('billing_stripe_invoices'),
    ('billing_stripe_invoice_proofs')
) as names(table_name)
left join pg_class c
  on c.relname = names.table_name
 and c.relnamespace = 'public'::regnamespace;

select
  names.table_name,
  roles.role_name,
  privileges.privilege_type,
  case
    when to_regclass('public.' || names.table_name) is null then null
    when not exists (select 1 from pg_roles where rolname = roles.role_name) then null
    else has_table_privilege(roles.role_name, 'public.' || names.table_name, privileges.privilege_type)
  end as allowed
from (
  values
    ('billing_subscriptions'),
    ('billing_stripe_customers'),
    ('billing_checkout_sessions'),
    ('billing_stripe_events'),
    ('billing_stripe_invoices'),
    ('billing_stripe_invoice_proofs')
) as names(table_name)
cross join (
  values ('anon'), ('authenticated'), ('service_role'), ('public')
) as roles(role_name)
cross join (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
) as privileges(privilege_type)
order by 1, 2, 3;

select
  coalesce(table_name, 'none') as table_name,
  coalesce(grantee, 'none') as grantee,
  coalesce(privilege_type, 'none') as privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'billing_%'
order by 1, 2, 3;

select
  c.relname as table_name,
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'billing_%'
order by 1, 2;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as config,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'billing_%'
order by 1, 2;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'execute') as execute_allowed
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.rolname in ('anon', 'authenticated', 'service_role', 'public')
where n.nspname = 'public'
  and p.proname like 'billing_%'
order by 1, 2, 3;

select
  coalesce(routine_name, 'none') as routine_name,
  coalesce(grantee, 'none') as grantee,
  coalesce(privilege_type, 'none') as privilege_type,
  coalesce(specific_name, 'none') as specific_name
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name like 'billing_%'
order by 1, 2, 4;
