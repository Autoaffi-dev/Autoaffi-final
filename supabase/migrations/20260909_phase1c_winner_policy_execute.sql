-- Phase 1C: restrict EXECUTE on product_index_apply_winner_policy.
-- Do not replace the function. Do not change body, caps, scoring, or SECURITY DEFINER.
-- Signature matches supabase/migrations/20260217_product_index_beast.sql.

revoke execute on function public.product_index_apply_winner_policy(int,int,int,int,int) from public;
revoke execute on function public.product_index_apply_winner_policy(int,int,int,int,int) from anon;
revoke execute on function public.product_index_apply_winner_policy(int,int,int,int,int) from authenticated;

grant execute on function public.product_index_apply_winner_policy(int,int,int,int,int) to service_role;
