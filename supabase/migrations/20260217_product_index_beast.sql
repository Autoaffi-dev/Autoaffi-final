-- ==========================================
-- Autoaffi Product Index BEAST upgrades
-- MUST + NICE (canonical dedupe ready)
-- ==========================================

alter table if exists public.product_index
  add column if not exists merchant_name text,
  add column if not exists merchant_id text,
  add column if not exists canonical_url text,
  add column if not exists canonical_hash text,
  add column if not exists price_band text,
  add column if not exists language text;

-- Helpful indexes
create index if not exists product_index_canonical_hash_idx
  on public.product_index (canonical_hash);

create index if not exists product_index_canonical_hash_active_idx
  on public.product_index (canonical_hash)
  where coalesce(is_active, true) = true;

create index if not exists product_index_merchant_name_idx
  on public.product_index (merchant_name);

create index if not exists product_index_category_idx
  on public.product_index (category);

create index if not exists product_index_source_score_idx
  on public.product_index (source, score desc);

-- ==========================================
-- Global Winner Pass Function
-- - Dedupe by canonical_hash (keep best)
-- - Caps per source/category/merchant/merchant+category/category+band
-- - Writes is_active + dead_reason + winner_tier
-- ==========================================

create or replace function public.product_index_apply_winner_policy(
  p_source_cap int default 800,
  p_category_cap int default 250,
  p_merchant_cap int default 35,
  p_merchant_category_cap int default 12,
  p_category_band_cap int default 120
)
returns json
language plpgsql
security definer
as $$
declare
  v_updated int := 0;
begin
  with base as (
    select
      id,
      source,
      coalesce(nullif(trim(category), ''), 'uncategorized') as cat,
      coalesce(nullif(trim(merchant_name), ''), nullif(trim(merchant_id), ''), 'unknown') as merch,
      coalesce(nullif(trim(price_band), ''), 'mid') as band,
      nullif(trim(lower(canonical_hash)), '') as canonical_hash,
      coalesce(score, quality_score, 0) as s,
      updated_at,

      row_number() over(partition by source order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last) as rn_source,
      row_number() over(partition by coalesce(nullif(trim(category), ''), 'uncategorized')
                        order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last) as rn_cat,

      row_number() over(partition by coalesce(nullif(trim(merchant_name), ''), nullif(trim(merchant_id), ''), 'unknown')
                        order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last) as rn_merch,

      row_number() over(partition by coalesce(nullif(trim(merchant_name), ''), nullif(trim(merchant_id), ''), 'unknown'),
                                   coalesce(nullif(trim(category), ''), 'uncategorized')
                        order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last) as rn_merch_cat,

      row_number() over(partition by coalesce(nullif(trim(category), ''), 'uncategorized'),
                                   coalesce(nullif(trim(price_band), ''), 'mid')
                        order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last) as rn_cat_band,

      case
        when canonical_hash is null or trim(canonical_hash) = '' then 1
        else row_number() over(partition by canonical_hash
                               order by coalesce(score, quality_score, 0) desc, updated_at desc nulls last)
      end as rn_canon

    from public.product_index
    where coalesce(is_approved, true) = true
  ),
  decided as (
    select
      id,
      s,
      rn_canon,
      rn_source,
      rn_cat,
      rn_merch,
      rn_merch_cat,
      rn_cat_band,
      case
        when rn_canon <> 1 then 'dedup_canonical'
        when rn_source > p_source_cap then 'cap_source'
        when rn_cat > p_category_cap then 'cap_category'
        when rn_merch > p_merchant_cap then 'cap_merchant'
        when rn_merch_cat > p_merchant_category_cap then 'cap_merchant_category'
        when rn_cat_band > p_category_band_cap then 'cap_category_band'
        else null
      end as reason,
      case
        when s >= 85 then 'A'
        when s >= 70 then 'B'
        when s >= 55 then 'C'
        else null
      end as tier
    from base
  )
  update public.product_index p
  set
    is_active = (d.reason is null),
    dead_reason = d.reason,
    winner_tier = d.tier,
    updated_at = now()
  from decided d
  where p.id = d.id;

  get diagnostics v_updated = row_count;

  return json_build_object(
    'ok', true,
    'updated', v_updated,
    'policy', json_build_object(
      'source_cap', p_source_cap,
      'category_cap', p_category_cap,
      'merchant_cap', p_merchant_cap,
      'merchant_category_cap', p_merchant_category_cap,
      'category_band_cap', p_category_band_cap
    )
  );
end;
$$;

grant execute on function public.product_index_apply_winner_policy(int,int,int,int,int) to service_role;