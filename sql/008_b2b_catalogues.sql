-- 008_b2b_catalogues.sql
-- Applied via mcp__supabase__apply_migration as 20260424_b2b_catalogues_tables on 2026-04-27.
-- Plan: docs/superpowers/plans/2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md (Task 3).
--
-- Three new tables:
--   b2b_catalogues                    -- per-org named catalogue, many per org allowed
--   b2b_catalogue_items               -- duplicated product entries with override columns
--   b2b_catalogue_item_pricing_tiers  -- per-item bracket pricing (auto-copied on item create)
--
-- RLS enabled on all three with customer-read policies scoped via user_organizations.
-- Staff writes happen via service-role API routes (RLS bypassed).

create table if not exists b2b_catalogues (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  description         text,
  discount_pct        numeric(5,2) not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by_user_id  uuid references auth.users(id),
  updated_at          timestamptz not null default now(),
  constraint b2b_catalogues_discount_range check (discount_pct >= 0 and discount_pct <= 100)
);

create index if not exists b2b_catalogues_org_active_idx
  on b2b_catalogues (organization_id) where is_active;

create table if not exists b2b_catalogue_items (
  id                            uuid primary key default gen_random_uuid(),
  catalogue_id                  uuid not null references b2b_catalogues(id) on delete cascade,
  source_product_id             uuid not null references products(id) on delete cascade,
  markup_multiplier_override    numeric(6,3),
  decoration_type_override      text,
  decoration_price_override     numeric(10,2),
  shipping_cost_override        numeric(10,2),
  metafields                    jsonb not null default '{}'::jsonb,
  is_active                     boolean not null default true,
  sort_order                    integer,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint b2b_catalogue_items_unique_product unique (catalogue_id, source_product_id)
);

create index if not exists b2b_catalogue_items_catalogue_idx
  on b2b_catalogue_items (catalogue_id) where is_active;
create index if not exists b2b_catalogue_items_source_product_idx
  on b2b_catalogue_items (source_product_id);

create table if not exists b2b_catalogue_item_pricing_tiers (
  id                  uuid primary key default gen_random_uuid(),
  catalogue_item_id   uuid not null references b2b_catalogue_items(id) on delete cascade,
  min_quantity        integer not null,
  max_quantity        integer,
  unit_price          numeric(10,2) not null,
  created_at          timestamptz not null default now(),
  constraint b2b_catalogue_item_pricing_tiers_qty_range
    check (min_quantity > 0 and (max_quantity is null or max_quantity >= min_quantity)),
  constraint b2b_catalogue_item_pricing_tiers_unique_min
    unique (catalogue_item_id, min_quantity)
);

alter table b2b_catalogues enable row level security;
alter table b2b_catalogue_items enable row level security;
alter table b2b_catalogue_item_pricing_tiers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'b2b_catalogues_customer_read') then
    create policy b2b_catalogues_customer_read on b2b_catalogues
      for select to authenticated
      using (organization_id in (
        select organization_id from user_organizations where user_id = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'b2b_catalogue_items_customer_read') then
    create policy b2b_catalogue_items_customer_read on b2b_catalogue_items
      for select to authenticated
      using (catalogue_id in (
        select id from b2b_catalogues
        where organization_id in (
          select organization_id from user_organizations where user_id = auth.uid()
        )
      ));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'b2b_catalogue_item_pricing_tiers_customer_read') then
    create policy b2b_catalogue_item_pricing_tiers_customer_read on b2b_catalogue_item_pricing_tiers
      for select to authenticated
      using (catalogue_item_id in (
        select id from b2b_catalogue_items
        where catalogue_id in (
          select id from b2b_catalogues
          where organization_id in (
            select organization_id from user_organizations where user_id = auth.uid()
          )
        )
      ));
  end if;
end $$;
