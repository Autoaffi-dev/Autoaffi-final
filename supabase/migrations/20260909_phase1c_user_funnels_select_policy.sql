-- Phase 1C: correct user_funnels own-row SELECT role.
-- Live production had "Allow read own funnel" on supabase_read_only_user.
-- Intended own-row SELECT is authenticated + user_id = auth.uid().
-- INSERT and UPDATE policies are intentionally unchanged.
-- RLS stays enabled. No anon SELECT. No USING (true). No DELETE policy.

drop policy if exists "Allow read own funnel" on public.user_funnels;

create policy "Allow read own funnel"
on public.user_funnels
for select
to authenticated
using (user_id = auth.uid());
