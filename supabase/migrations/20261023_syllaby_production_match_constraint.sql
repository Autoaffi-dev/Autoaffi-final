-- Allow a production match to record an offer owner without a test identity.
-- Unresolved rows still have both identifiers null.
-- A test match still requires both owner and test identity.
-- The whole predicate is IS TRUE so a null result cannot pass.
-- Existing RLS, grants, and the other constraints stay as they are.

begin;

alter table public.affiliate_inbound_events
  drop constraint affiliate_inbound_events_owner_check;

alter table public.affiliate_inbound_events
  add constraint affiliate_inbound_events_owner_check
  check ((
    (
      match_status = 'unresolved_review'
      and match_reason <> 'matched'
      and matched_owner_id is null
      and matched_identity_id is null
    )
    or (
      environment = 'test'
      and is_test = true
      and match_status = 'matched'
      and match_reason = 'matched'
      and matched_owner_id is not null
      and matched_identity_id is not null
    )
    or (
      environment = 'production'
      and is_test = false
      and match_status = 'matched'
      and match_reason = 'matched'
      and matched_owner_id is not null
      and matched_identity_id is null
    )
  ) is true);

commit;
