-- 009_b2b_catalogues_rpcs.sql
-- Applied via mcp__supabase__apply_migration as 20260424_b2b_catalogues_rpcs on 2026-04-27.
-- Plan: docs/superpowers/plans/2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md (Task 4).
--
-- Pricing functions per spec §5.5.
--   catalogue_unit_price(catalogue_item_id, qty)
--     -> tier match in b2b_catalogue_item_pricing_tiers, else base * multiplier;
--        then apply catalogue.discount_pct.
--   effective_unit_price(product_id, org_id, qty)
--     -> if product is in any active catalogue for org, defer to catalogue_unit_price;
--        else fall through to legacy get_unit_price (unchanged from pre-Task 1).
--
-- Both functions are STABLE SECURITY DEFINER with search_path locked.
-- Plan typo fixed: grant signature uses (uuid, uuid, integer) — org_id is uuid, not integer.

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
  v_catalogue   b2b_catalogues%rowtype;
  v_source_base numeric(10,2);
  v_source_mult numeric(6,3);
  v_multiplier  numeric(6,3);
  v_base        numeric(10,2);
begin
  select * into v_item from b2b_catalogue_items where id = p_catalogue_item_id;
  if not found then
    raise exception 'catalogue item % not found', p_catalogue_item_id;
  end if;
  select * into v_catalogue from b2b_catalogues where id = v_item.catalogue_id;

  select unit_price into v_tier_price
  from b2b_catalogue_item_pricing_tiers
  where catalogue_item_id = p_catalogue_item_id
    and min_quantity <= p_qty
    and (max_quantity is null or max_quantity >= p_qty)
  order by min_quantity desc
  limit 1;

  if v_tier_price is not null then
    v_base := v_tier_price;
  else
    select base_cost, markup_multiplier
      into v_source_base, v_source_mult
    from products where id = v_item.source_product_id;
    v_multiplier := coalesce(v_item.markup_multiplier_override, v_source_mult, 1.0);
    v_base := round(coalesce(v_source_base, 0) * v_multiplier, 2);
  end if;

  return round(v_base * (1 - coalesce(v_catalogue.discount_pct, 0) / 100.0), 2);
end $$;

create or replace function effective_unit_price(
  p_product_id uuid,
  p_org_id uuid,
  p_qty integer
) returns numeric(10,2)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_id uuid;
begin
  select ci.id into v_item_id
  from b2b_catalogue_items ci
  join b2b_catalogues c on c.id = ci.catalogue_id
  where c.organization_id = p_org_id
    and c.is_active
    and ci.is_active
    and ci.source_product_id = p_product_id
  order by c.created_at desc
  limit 1;

  if v_item_id is not null then
    return catalogue_unit_price(v_item_id, p_qty);
  end if;

  return get_unit_price(p_product_id, p_org_id, p_qty);
end $$;

grant execute on function catalogue_unit_price(uuid, integer) to authenticated;
grant execute on function effective_unit_price(uuid, uuid, integer) to authenticated;
