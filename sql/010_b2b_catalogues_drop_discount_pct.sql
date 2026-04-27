-- 010_b2b_catalogues_drop_discount_pct.sql
-- Applied via mcp__supabase__apply_migration as 20260427_b2b_catalogues_drop_discount_pct on 2026-04-27.
--
-- Removes the catalogue-level discount_pct concept. Pricing discounts are an
-- ORG-LEVEL concern (b2b_accounts.tier_level -> price_tiers.discount, already
-- applied by get_unit_price) -- a separate per-catalogue discount duplicates
-- the concept and points the wrong way for the future tier-based pricing spec.
--
-- Drops column + check constraint and rewrites catalogue_unit_price to no
-- longer multiply by (1 - discount_pct/100). Existing seed catalogue had
-- discount_pct=0 so this is loss-free.

alter table b2b_catalogues drop constraint if exists b2b_catalogues_discount_range;
alter table b2b_catalogues drop column if exists discount_pct;

create or replace function catalogue_unit_price(
  p_catalogue_item_id uuid,
  p_qty integer
) returns numeric(10,2)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier_price  numeric(10,2);
  v_item        b2b_catalogue_items%rowtype;
  v_source_base numeric(10,2);
  v_source_mult numeric(6,3);
  v_multiplier  numeric(6,3);
begin
  select * into v_item from b2b_catalogue_items where id = p_catalogue_item_id;
  if not found then
    raise exception 'catalogue item % not found', p_catalogue_item_id;
  end if;

  select unit_price into v_tier_price
  from b2b_catalogue_item_pricing_tiers
  where catalogue_item_id = p_catalogue_item_id
    and min_quantity <= p_qty
    and (max_quantity is null or max_quantity >= p_qty)
  order by min_quantity desc
  limit 1;

  if v_tier_price is not null then
    return v_tier_price;
  end if;

  select base_cost, markup_multiplier
    into v_source_base, v_source_mult
  from products where id = v_item.source_product_id;
  v_multiplier := coalesce(v_item.markup_multiplier_override, v_source_mult, 1.0);
  return round(coalesce(v_source_base, 0) * v_multiplier, 2);
end $$;
