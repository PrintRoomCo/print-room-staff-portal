# B2B Catalogues Sub-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-portal B2B Catalogues sub-app — per-organization product catalogues with duplicated items, override-at-item markup/decoration/shipping, per-item tier pricing (auto-copied from master on creation), catalogue-level discount, and a multi-select "create catalogue" flow from the existing `/products` list. Rename master `products.markup_pct` → `products.markup_multiplier` (with a sync trigger so `middleware-pr` keeps working). Add `products.is_b2b_only` flag so B2B-only items can be synthetic-master products that render through the existing PDP/cart/checkout/quote-items path with zero schema ripple. Extend the customer portal `/shop` query to catalogue-scope when the viewing org has assigned catalogues, with a safe fallback to the current global B2B channel when it does not.

**Spec:** [2026-04-24-staff-portal-b2b-catalogues-subapp-design.md](../specs/2026-04-24-staff-portal-b2b-catalogues-subapp-design.md) (rev 2 — locked decisions).

**Architecture:**
- Rename + new flag on `products` (markup_multiplier, is_b2b_only) — Task 1.
- Three new tables (`b2b_catalogues`, `b2b_catalogue_items`, `b2b_catalogue_item_pricing_tiers`) — Task 2.
- Two new RPCs (`catalogue_unit_price`, `effective_unit_price`) plus a `get_unit_price` rewrite to read `markup_multiplier` — Task 3.
- Staff UI under `src/app/(portal)/catalogues/` and extensions to `/products` (multi-select, B2B-only filter).
- Customer `/shop` swap (one file).

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase (Postgres + RLS + Auth), Tailwind v4, TypeScript, MCP `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql` for DB ops (🟡 **present SQL to Jamie for approval before every apply**). No JS test framework installed — verification is SQL probes + cURL against running dev server.

**Repos touched:**
- `print-room-staff-portal` — all new UI + API + schema + RPCs + permission helper. Sub-app #1 product editor's "Markup %" UI continues to write `markup_pct` (sync trigger forwards) — UI swap to multiplier is a follow-up.
- `print-room-portal` — one file (`app/(portal)/shop/page.tsx`) switches to the new pricing RPC and gains a catalogue-scope branch.

**Next.js 16 note (per both repos' AGENTS.md):** `params` in page and route handlers is a `Promise<...>` — always `await` it. Server files that read cookies use `await cookies()`. Re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before writing any new route handler.

**Destructive-write policy:** Every `mcp__supabase__apply_migration` and `mcp__supabase__execute_sql` call must present the exact SQL in chat and wait for Jamie's 🟢 before invocation.

---

## Locked decisions (from spec §11)

1. Customer /shop semantic: **Option A** — catalogue scope if assigned, else fallback to global B2B channel.
2. Cardinality: **many catalogues per org** (no UNIQUE on `b2b_catalogues.organization_id`).
3. Markup type: **`markup_multiplier numeric(6,3)`** added to `products` with sync trigger to existing `markup_pct`. Both columns coexist during `middleware-pr` parity period. `get_unit_price` rewritten to read `markup_multiplier`.
4. B2B-only items: **synthetic-master approach** — `is_b2b_only boolean` flag on `products`. Catalogue items always reference a `products.id`. No snapshot columns on `b2b_catalogue_items`.
5. Auto-copy tiers: **yes**, on every catalogue-item creation (master add or B2B-only). Editable per catalogue afterwards. "Refresh from master" action on the Tiers tab re-pulls (with confirmation).
6. Per-catalogue images: deferred to follow-up spec.
7. Permission: `catalogues:write`. Helper mirrors `requireInventoryStaffAccess()` return shape: `{ error: NextResponse }` or `{ admin, context }`.

---

## File structure

### New files (staff portal: `print-room-staff-portal`)

- `sql/006_products_markup_multiplier.sql` — reference copy
- `sql/007_products_is_b2b_only.sql` — reference copy
- `sql/008_b2b_catalogues.sql` — reference copy
- `sql/009_b2b_catalogues_rpcs.sql` — reference copy
- `src/types/catalogues.ts` — API DTOs
- `src/lib/catalogues/server.ts` — `requireCataloguesStaffAccess`
- `src/app/api/catalogues/route.ts` — GET list, POST create-from-selection
- `src/app/api/catalogues/[id]/route.ts` — GET one, PATCH, DELETE
- `src/app/api/catalogues/[id]/items/route.ts` — GET items, POST add-from-master (auto-copies tiers)
- `src/app/api/catalogues/[id]/items/b2b-only/route.ts` — POST create-b2b-only (creates products row + catalogue item in txn)
- `src/app/api/catalogues/[id]/items/[itemId]/route.ts` — GET, PATCH, DELETE
- `src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts` — GET, POST
- `src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts` — PATCH, DELETE
- `src/app/api/catalogues/[id]/items/[itemId]/refresh-tiers/route.ts` — POST (replace with current master tiers)
- `src/app/api/catalogues/by-org/[orgId]/route.ts` — GET catalogues for one org
- `src/app/api/organizations/route.ts` — GET (created if missing)
- `src/app/(portal)/catalogues/page.tsx` — list
- `src/app/(portal)/catalogues/[id]/page.tsx` — tabbed editor
- `src/components/catalogues/CreateCatalogueDialog.tsx`
- `src/components/catalogues/CataloguesTable.tsx`
- `src/components/catalogues/CatalogueEditor.tsx`
- `src/components/catalogues/CatalogueItemsTable.tsx`
- `src/components/catalogues/CatalogueItemPricingTiers.tsx`
- `src/components/catalogues/AddFromMasterDialog.tsx`
- `src/components/catalogues/CreateB2BOnlyItemDialog.tsx`
- `src/components/catalogues/CatalogueSettingsForm.tsx`
- `src/components/products/ProductsSelectionBar.tsx`
- `src/components/products/B2BOnlyFilter.tsx`

### Modified files (staff portal)

- `src/types/staff.ts` — add `'catalogues'` and `'catalogues:write'` literals to `StaffPermission`
- `src/components/layout/Sidebar.tsx` — add "Catalogues" entry
- `src/app/(portal)/products/page.tsx` — row checkboxes + sticky bar + B2B-only filter

### Modified files (customer portal: `print-room-portal`)

- `app/(portal)/shop/page.tsx` — catalogue-scope branch + `effective_unit_price` swap
- `lib/shop/effective-price.ts` — new helper

### Database migrations (via `mcp__supabase__apply_migration`)

1. `20260424_products_markup_multiplier` — column add, backfill, sync trigger, get_unit_price rewrite
2. `20260424_products_is_b2b_only` — column add + index
3. `20260424_b2b_catalogues_tables` — three new tables + indexes + RLS + policies
4. `20260424_b2b_catalogues_rpcs` — `catalogue_unit_price` + `effective_unit_price`

---

# Tasks

## Task 1: Rename `products.markup_pct` → add `markup_multiplier` with sync trigger; rewrite `get_unit_price`

**Files:**
- Migration (via MCP): `20260424_products_markup_multiplier`
- Reference copy: `sql/006_products_markup_multiplier.sql`

**Acceptance criteria:**
- `products.markup_multiplier numeric(6,3) NOT NULL DEFAULT 1.0` exists.
- Backfilled correctly: for every existing row, `markup_multiplier = round(1 + markup_pct/100, 3)`.
- Sync trigger fires on insert/update of either column and keeps both in sync without looping.
- `get_unit_price` returns same numeric output as before for sample products (within 1 cent rounding).
- `markup_pct` is **NOT** dropped (kept for `middleware-pr` compat).

- [ ] **Step 1: Capture current `get_unit_price` body for reference**

```sql
select pg_get_functiondef('get_unit_price(uuid,uuid,integer)'::regprocedure);
```

Save the output verbatim into `sql/_pre-rewrite/get_unit_price.sql` (gitignored or kept under a notes folder) so we can roll back exactly if needed.

- [ ] **Step 2: Draft + present migration SQL for approval**

Post to chat: "🟡 Apply migration `20260424_products_markup_multiplier`? Adds new column + backfill + sync trigger + rewrites `get_unit_price` to read `markup_multiplier`. `markup_pct` stays. Reply 🟢."

```sql
begin;

-- Column add
alter table products
  add column if not exists markup_multiplier numeric(6,3);

-- Backfill from existing markup_pct
update products
   set markup_multiplier = round(1 + coalesce(markup_pct, 0) / 100.0, 3)
 where markup_multiplier is null;

alter table products alter column markup_multiplier set default 1.0;
alter table products alter column markup_multiplier set not null;

-- Bidirectional sync trigger. Distinct-from guards prevent loops when both columns
-- are written in one statement (one column "drives" per write).
create or replace function sync_products_markup() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT')
     or (new.markup_pct is distinct from old.markup_pct
         and new.markup_multiplier is not distinct from old.markup_multiplier) then
    new.markup_multiplier := round(1 + coalesce(new.markup_pct, 0) / 100.0, 3);
  end if;
  if (tg_op = 'INSERT')
     or (new.markup_multiplier is distinct from old.markup_multiplier
         and new.markup_pct is not distinct from old.markup_pct) then
    new.markup_pct := round((coalesce(new.markup_multiplier, 1) - 1) * 100.0, 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_products_markup on products;
create trigger trg_sync_products_markup
  before insert or update of markup_pct, markup_multiplier on products
  for each row execute function sync_products_markup();

-- Rewrite get_unit_price to read markup_multiplier. Signature unchanged.
-- NOTE: Replace the function body below with the EXACT structure of the existing
-- get_unit_price function, swapping the markup arithmetic. The structure shown
-- here assumes the standard pattern (per-product tier match → fallback to base*markup).
-- If the existing function diverges, preserve its tier/fallback logic and ONLY
-- replace the markup arithmetic.
create or replace function get_unit_price(
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
  v_tier_price numeric(10,2);
  v_base       numeric(10,2);
  v_multiplier numeric(6,3);
begin
  select unit_price into v_tier_price
  from product_pricing_tiers
  where product_id = p_product_id
    and is_active
    and min_quantity <= p_qty
    and (max_quantity is null or max_quantity >= p_qty)
  order by min_quantity desc
  limit 1;

  if v_tier_price is not null then
    return v_tier_price;
  end if;

  select base_cost, markup_multiplier
    into v_base, v_multiplier
  from products where id = p_product_id;

  return round(coalesce(v_base, 0) * coalesce(v_multiplier, 1.0), 2);
end $$;

commit;
```

- [ ] **Step 3: Apply on 🟢 via `mcp__supabase__apply_migration`**

- [ ] **Step 4: Verify backfill**

```sql
select id, markup_pct, markup_multiplier,
       round(1 + coalesce(markup_pct,0)/100.0, 3) as expected_multiplier
from products
where round(1 + coalesce(markup_pct,0)/100.0, 3) <> markup_multiplier
limit 5;
```

Expected: 0 rows (all backfilled correctly).

- [ ] **Step 5: Verify sync trigger (both directions)**

Pick any test product id (`<X>`):

```sql
-- markup_pct → markup_multiplier
update products set markup_pct = 25 where id = '<X>';
select markup_pct, markup_multiplier from products where id = '<X>';
-- expect: 25.00, 1.250

-- markup_multiplier → markup_pct
update products set markup_multiplier = 1.75 where id = '<X>';
select markup_pct, markup_multiplier from products where id = '<X>';
-- expect: 75.00, 1.750
```

Reset `<X>` to its original values when done.

- [ ] **Step 6: Verify `get_unit_price` parity**

Sample 5 products at qty=10. Compare against pre-migration values (saved at Step 1 — re-derive by hand: `round(base_cost * (1 + markup_pct/100), 2)` for non-tier products).

```sql
select id,
       base_cost, markup_pct, markup_multiplier,
       get_unit_price(id, 'ee155266-200c-4b73-8dbd-be385db3e5b0'::uuid, 10) as new,
       round(base_cost * (1 + coalesce(markup_pct,0)/100.0), 2) as legacy_calc
from products
where platform = 'uniforms' and is_active
limit 5;
```

Differences should be ≤ 1 cent (rounding).

- [ ] **Step 7: Save reference copy**

Write the migration SQL to `sql/006_products_markup_multiplier.sql` with a header comment noting the apply date.

- [ ] **Step 8: Commit**

```bash
git add sql/006_products_markup_multiplier.sql
git commit -m "feat(products): add markup_multiplier column + sync trigger; rewrite get_unit_price (applied via MCP)"
```

---

## Task 2: Add `products.is_b2b_only` flag

**Files:**
- Migration (via MCP): `20260424_products_is_b2b_only`
- Reference copy: `sql/007_products_is_b2b_only.sql`

**Acceptance criteria:**
- `products.is_b2b_only boolean NOT NULL DEFAULT false` exists.
- Partial index `where is_b2b_only` exists.

- [ ] **Step 1: Draft + present**

```sql
alter table products
  add column if not exists is_b2b_only boolean not null default false;

create index if not exists products_is_b2b_only_idx
  on products (is_b2b_only) where is_b2b_only;
```

- [ ] **Step 2: Apply on 🟢**

- [ ] **Step 3: Verify**

```sql
select count(*) from products where is_b2b_only = false;
-- expect: total product count (all existing rows default to false)
```

- [ ] **Step 4: Save reference copy + commit**

```bash
git add sql/007_products_is_b2b_only.sql
git commit -m "feat(products): add is_b2b_only flag (applied via MCP)"
```

---

## Task 3: Create `b2b_catalogues` schema (tables + RLS)

**Files:**
- Migration (via MCP): `20260424_b2b_catalogues_tables`
- Reference copy: `sql/008_b2b_catalogues.sql`

**Acceptance criteria:**
- Three new tables exist with the columns/constraints below.
- RLS enabled, customer-read policies in place.
- All re-runs are no-ops.

- [ ] **Step 1: Draft + present**

```sql
begin;

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

commit;
```

- [ ] **Step 2: Apply on 🟢**

- [ ] **Step 3: Verify**

```sql
select table_name, count(*) as col_count
from information_schema.columns
where table_name in ('b2b_catalogues', 'b2b_catalogue_items', 'b2b_catalogue_item_pricing_tiers')
group by table_name;

select policyname, tablename from pg_policies
where tablename in ('b2b_catalogues', 'b2b_catalogue_items', 'b2b_catalogue_item_pricing_tiers');
```

Expected: 3 tables, 3 policies.

- [ ] **Step 4: Save reference copy + commit**

```bash
git add sql/008_b2b_catalogues.sql
git commit -m "feat(catalogues): add b2b_catalogues schema (applied via MCP)"
```

---

## Task 4: Create pricing RPCs

**Files:**
- Migration (via MCP): `20260424_b2b_catalogues_rpcs`
- Reference copy: `sql/009_b2b_catalogues_rpcs.sql`

**Acceptance criteria:**
- `catalogue_unit_price(p_catalogue_item_id uuid, p_qty integer)` returns the formula in spec §5.5.
- `effective_unit_price(p_product_id uuid, p_org_id uuid, p_qty integer)` returns the wrapper logic in spec §5.5.
- Both `stable security definer`.

- [ ] **Step 1: Draft + present**

```sql
begin;

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
grant execute on function effective_unit_price(uuid, integer, integer) to authenticated;

commit;
```

- [ ] **Step 2: Apply on 🟢**

- [ ] **Step 3: Verify fallback parity**

```sql
select p.id,
       get_unit_price(p.id, 'ee155266-200c-4b73-8dbd-be385db3e5b0'::uuid, 10)         as legacy,
       effective_unit_price(p.id, 'ee155266-200c-4b73-8dbd-be385db3e5b0'::uuid, 10)   as effective
from products p
where p.platform = 'uniforms' and p.is_active
limit 3;
```

Expected: `legacy = effective` (PRT has no catalogues yet).

- [ ] **Step 4: Save reference copy + commit**

```bash
git add sql/009_b2b_catalogues_rpcs.sql
git commit -m "feat(catalogues): add catalogue_unit_price + effective_unit_price RPCs"
```

---

## Task 5: Add `catalogues` permission + server auth helper

**Files:**
- Modify: `src/types/staff.ts`
- Create: `src/lib/catalogues/server.ts`

- [ ] **Step 1: Extend `StaffPermission`**

Add `'catalogues'` and `'catalogues:write'` literals to the union in [src/types/staff.ts](src/types/staff.ts).

- [ ] **Step 2: Write the helper (mirrors `requireInventoryStaffAccess`)**

```ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface CataloguesStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

export async function requireCataloguesStaffAccess() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (staffError || !staff) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  const typedStaff = staff as StaffRow
  const permissions = Array.isArray(typedStaff.permissions) ? typedStaff.permissions : []
  const isAdmin = typedStaff.role === 'admin' || typedStaff.role === 'super_admin'
  const hasPerm =
    permissions.includes('catalogues') || permissions.includes('catalogues:write')

  if (!isAdmin && !hasPerm) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typedStaff.id,
      role: typedStaff.role,
      isAdmin,
      displayName: typedStaff.display_name,
    } satisfies CataloguesStaffContext,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/staff.ts src/lib/catalogues/server.ts
git commit -m "feat(catalogues): add catalogues permission + staff auth helper"
```

---

## Task 6: API DTO types

**Files:**
- Create: `src/types/catalogues.ts`

- [ ] **Step 1: Write the file**

```ts
export type CatalogueRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  discount_pct: number
  is_active: boolean
  created_at: string
  created_by_user_id: string | null
  updated_at: string
}

export type CatalogueItemRow = {
  id: string
  catalogue_id: string
  source_product_id: string
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
  sort_order: number | null
  created_at: string
  updated_at: string
}

export type CatalogueItemPricingTierRow = {
  id: string
  catalogue_item_id: string
  min_quantity: number
  max_quantity: number | null
  unit_price: number
  created_at: string
}

export type CreateCatalogueBody = {
  organization_id: string
  name: string
  description?: string
  discount_pct?: number
  product_ids?: string[]
}

export type AddFromMasterBody = { source_product_id: string }

export type CreateB2BOnlyItemBody = {
  name: string
  base_cost: number
  decoration_eligible?: boolean
  decoration_price?: number
  image_url?: string
  category_id?: string
  brand_id?: string
}

export type UpdateCatalogueItemBody = Partial<{
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
  sort_order: number
}>
```

- [ ] **Step 2: Commit**

```bash
git add src/types/catalogues.ts
git commit -m "feat(catalogues): add API DTO types"
```

---

## Task 7: `POST /api/catalogues` (create-from-selection with auto-copy tiers) + `GET /api/catalogues`

**Files:**
- Create: `src/app/api/catalogues/route.ts`

**Acceptance criteria:**
- `POST` with `{organization_id, name, product_ids: [uuid,uuid]}` creates one `b2b_catalogues` row + N `b2b_catalogue_items` rows + auto-copies each item's master `product_pricing_tiers` into `b2b_catalogue_item_pricing_tiers`.
- All-or-nothing: if any item or tier copy fails, the catalogue is deleted and an error returned.
- `POST` with no `product_ids` creates an empty catalogue.
- `GET` returns catalogues with `{ id, name, organization_id, discount_pct, is_active, items_count, created_at }`.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { CreateCatalogueBody } from '@/types/catalogues'

export async function POST(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = (await request.json()) as CreateCatalogueBody

  if (!body.organization_id || !body.name) {
    return NextResponse.json({ error: 'organization_id and name required' }, { status: 400 })
  }

  const { data: cat, error: cErr } = await admin
    .from('b2b_catalogues')
    .insert({
      organization_id: body.organization_id,
      name: body.name,
      description: body.description ?? null,
      discount_pct: body.discount_pct ?? 0,
      created_by_user_id: context.userId,
    })
    .select('id')
    .single()
  if (cErr || !cat) {
    return NextResponse.json({ error: cErr?.message ?? 'create failed' }, { status: 500 })
  }

  if (body.product_ids?.length) {
    // Insert items
    const itemRows = body.product_ids.map((pid, i) => ({
      catalogue_id: cat.id,
      source_product_id: pid,
      sort_order: i,
    }))
    const { data: insertedItems, error: iErr } = await admin
      .from('b2b_catalogue_items')
      .insert(itemRows)
      .select('id, source_product_id')
    if (iErr || !insertedItems) {
      await admin.from('b2b_catalogues').delete().eq('id', cat.id)
      return NextResponse.json({ error: iErr?.message ?? 'item insert failed' }, { status: 500 })
    }

    // Auto-copy master tiers for each item
    const { data: masterTiers, error: mErr } = await admin
      .from('product_pricing_tiers')
      .select('product_id, min_quantity, max_quantity, unit_price')
      .eq('is_active', true)
      .in('product_id', body.product_ids)
    if (mErr) {
      await admin.from('b2b_catalogues').delete().eq('id', cat.id)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    if (masterTiers && masterTiers.length > 0) {
      const itemByProduct = new Map(insertedItems.map((it) => [it.source_product_id, it.id]))
      const tierRows = masterTiers
        .map((t) => ({
          catalogue_item_id: itemByProduct.get(t.product_id as string)!,
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity,
          unit_price: t.unit_price,
        }))
        .filter((r) => r.catalogue_item_id)
      if (tierRows.length > 0) {
        const { error: tErr } = await admin
          .from('b2b_catalogue_item_pricing_tiers')
          .insert(tierRows)
        if (tErr) {
          await admin.from('b2b_catalogues').delete().eq('id', cat.id)
          return NextResponse.json({ error: tErr.message }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ id: cat.id }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const url = new URL(request.url)
  const orgId = url.searchParams.get('organization_id')

  let q = admin
    .from('b2b_catalogues')
    .select('id, organization_id, name, discount_pct, is_active, created_at, items:b2b_catalogue_items(count)')
    .order('created_at', { ascending: false })
  if (orgId) q = q.eq('organization_id', orgId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ catalogues: data ?? [] })
}
```

- [ ] **Step 2: cURL smoke**

```bash
# Empty catalogue
curl -X POST http://localhost:3000/api/catalogues \
  -H 'Content-Type: application/json' \
  -d '{"organization_id":"ee155266-200c-4b73-8dbd-be385db3e5b0","name":"empty cURL"}'

# Catalogue with 2 products (pick real product ids)
curl -X POST http://localhost:3000/api/catalogues \
  -H 'Content-Type: application/json' \
  -d '{"organization_id":"ee155266-200c-4b73-8dbd-be385db3e5b0","name":"cURL with items","product_ids":["<pid1>","<pid2>"]}'

# Verify tiers were auto-copied
curl http://localhost:3000/api/catalogues
```

- [ ] **Step 3: Clean up test rows (present DELETE SQL for 🟢)**

```sql
delete from b2b_catalogues where name in ('empty cURL', 'cURL with items');
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalogues/route.ts
git commit -m "feat(catalogues): POST/GET /api/catalogues with auto-copy tiers"
```

---

## Task 8: `GET/PATCH/DELETE /api/catalogues/[id]`

**Files:**
- Create: `src/app/api/catalogues/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const [cat, items] = await Promise.all([
    admin.from('b2b_catalogues').select('*').eq('id', id).single(),
    admin
      .from('b2b_catalogue_items')
      .select('*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)')
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])
  if (cat.error || !cat.data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ catalogue: cat.data, items: items.data ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['name', 'description', 'discount_pct', 'is_active']) {
    if (k in body) patch[k] = body[k]
  }
  const { error } = await admin.from('b2b_catalogues').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin.from('b2b_catalogues').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: cURL smoke + Step 3: Commit**

```bash
git add 'src/app/api/catalogues/[id]/route.ts'
git commit -m "feat(catalogues): GET/PATCH/DELETE /api/catalogues/[id]"
```

---

## Task 9: Items routes — add-from-master (auto-copies tiers) + create-b2b-only (synthetic master) + per-item PATCH/DELETE

**Files:**
- Create: `src/app/api/catalogues/[id]/items/route.ts`
- Create: `src/app/api/catalogues/[id]/items/b2b-only/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Write items collection (GET + POST add-from-master)**

```ts
// src/app/api/catalogues/[id]/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { AddFromMasterBody } from '@/types/catalogues'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_items')
    .select('*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)')
    .eq('catalogue_id', id)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = (await request.json()) as AddFromMasterBody
  if (!body.source_product_id) {
    return NextResponse.json({ error: 'source_product_id required' }, { status: 400 })
  }

  // Insert item
  const { data: item, error: iErr } = await admin
    .from('b2b_catalogue_items')
    .insert({ catalogue_id: id, source_product_id: body.source_product_id })
    .select('id')
    .single()
  if (iErr || !item) return NextResponse.json({ error: iErr?.message ?? 'insert failed' }, { status: 500 })

  // Auto-copy master tiers
  const { data: masterTiers } = await admin
    .from('product_pricing_tiers')
    .select('min_quantity, max_quantity, unit_price')
    .eq('product_id', body.source_product_id)
    .eq('is_active', true)
    .order('min_quantity')

  if (masterTiers?.length) {
    const tierRows = masterTiers.map((t) => ({
      catalogue_item_id: item.id,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity,
      unit_price: t.unit_price,
    }))
    const { error: tErr } = await admin
      .from('b2b_catalogue_item_pricing_tiers')
      .insert(tierRows)
    if (tErr) {
      await admin.from('b2b_catalogue_items').delete().eq('id', item.id)
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: item.id }, { status: 201 })
}
```

- [ ] **Step 2: Write b2b-only route (creates `products` row + catalogue item)**

```ts
// src/app/api/catalogues/[id]/items/b2b-only/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { CreateB2BOnlyItemBody } from '@/types/catalogues'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = (await request.json()) as CreateB2BOnlyItemBody

  if (!body.name?.trim() || typeof body.base_cost !== 'number') {
    return NextResponse.json(
      { error: 'name and base_cost required' },
      { status: 400 },
    )
  }

  // 1. Create the synthetic master product (is_b2b_only = true)
  const { data: prod, error: pErr } = await admin
    .from('products')
    .insert({
      name: body.name.trim(),
      base_cost: body.base_cost,
      markup_multiplier: 1.0,
      decoration_eligible: body.decoration_eligible ?? false,
      decoration_price: body.decoration_price ?? null,
      image_url: body.image_url ?? null,
      category_id: body.category_id ?? null,
      brand_id: body.brand_id ?? null,
      is_b2b_only: true,
      is_active: true,
      platform: 'uniforms',
    })
    .select('id')
    .single()
  if (pErr || !prod) {
    return NextResponse.json({ error: pErr?.message ?? 'product insert failed' }, { status: 500 })
  }

  // 2. Create the catalogue item referencing it
  const { data: item, error: iErr } = await admin
    .from('b2b_catalogue_items')
    .insert({ catalogue_id: id, source_product_id: prod.id })
    .select('id')
    .single()
  if (iErr || !item) {
    // Roll back the product
    await admin.from('products').delete().eq('id', prod.id)
    return NextResponse.json({ error: iErr?.message ?? 'item insert failed' }, { status: 500 })
  }

  return NextResponse.json({ catalogue_item_id: item.id, product_id: prod.id }, { status: 201 })
}
```

- [ ] **Step 3: Write per-item PATCH/DELETE**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

const PATCHABLE = [
  'markup_multiplier_override',
  'decoration_type_override',
  'decoration_price_override',
  'shipping_cost_override',
  'metafields',
  'is_active',
  'sort_order',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of PATCHABLE) if (k in body) patch[k] = body[k]

  const { error } = await admin.from('b2b_catalogue_items').update(patch).eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin.from('b2b_catalogue_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: cURL smoke (add-from-master, b2b-only, patch override, delete)**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(catalogues): items CRUD (add-from-master + b2b-only synthetic + patch/delete)"
```

---

## Task 10: Pricing tier CRUD + refresh-from-master

**Files:**
- Create: `src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/refresh-tiers/route.ts`

- [ ] **Step 1: Write tiers collection (GET + POST)**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .select('*')
    .eq('catalogue_item_id', itemId)
    .order('min_quantity')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()
  if (typeof body.min_quantity !== 'number' || typeof body.unit_price !== 'number') {
    return NextResponse.json({ error: 'min_quantity and unit_price required' }, { status: 400 })
  }
  const { data, error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .insert({
      catalogue_item_id: itemId,
      min_quantity: body.min_quantity,
      max_quantity: body.max_quantity ?? null,
      unit_price: body.unit_price,
    })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Write per-tier PATCH/DELETE**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()
  const patch: Record<string, unknown> = {}
  for (const k of ['min_quantity', 'max_quantity', 'unit_price']) if (k in body) patch[k] = body[k]
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .update(patch)
    .eq('id', tierId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .delete()
    .eq('id', tierId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Write refresh-tiers (replace catalogue-item tiers with current master)**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/refresh-tiers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const { data: item } = await admin
    .from('b2b_catalogue_items')
    .select('source_product_id')
    .eq('id', itemId)
    .single()
  if (!item) return NextResponse.json({ error: 'item not found' }, { status: 404 })

  const { data: masterTiers, error: mErr } = await admin
    .from('product_pricing_tiers')
    .select('min_quantity, max_quantity, unit_price')
    .eq('product_id', item.source_product_id)
    .eq('is_active', true)
    .order('min_quantity')
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Replace existing
  await admin.from('b2b_catalogue_item_pricing_tiers').delete().eq('catalogue_item_id', itemId)

  if (masterTiers?.length) {
    const rows = masterTiers.map((t) => ({
      catalogue_item_id: itemId,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity,
      unit_price: t.unit_price,
    }))
    const { error: iErr } = await admin
      .from('b2b_catalogue_item_pricing_tiers')
      .insert(rows)
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  return NextResponse.json({ replaced: masterTiers?.length ?? 0 })
}
```

Master `product_pricing_tiers` column names verified 2026-04-24: `min_quantity`, `max_quantity`, `unit_price`, `currency`, `tier_level`, `is_active`. Filter to active tiers only.

- [ ] **Step 4: cURL smoke each + commit**

```bash
git commit -m "feat(catalogues): tier CRUD + refresh-from-master"
```

---

## Task 11: `GET /api/catalogues/by-org/[orgId]` + `GET /api/organizations`

**Files:**
- Create: `src/app/api/catalogues/by-org/[orgId]/route.ts`
- Create: `src/app/api/organizations/route.ts` (only if missing)

- [ ] **Step 1: Verify whether `/api/organizations` already exists**

`ls src/app/api/organizations/route.ts`. If exists, skip Step 2.

- [ ] **Step 2: Write `/api/organizations/route.ts` if missing**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(_request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('organizations')
    .select('id, name')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ organizations: data ?? [] })
}
```

- [ ] **Step 3: Write `/api/catalogues/by-org/[orgId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogues')
    .select('id, name, discount_pct, is_active, created_at, items:b2b_catalogue_items(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ catalogues: data ?? [] })
}
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(catalogues): by-org lookup + organizations endpoint"
```

---

## Task 12: `/products` — multi-select + sticky bar + B2B-only filter

**Files:**
- Create: `src/components/products/ProductsSelectionBar.tsx`
- Create: `src/components/products/B2BOnlyFilter.tsx`
- Create: `src/components/catalogues/CreateCatalogueDialog.tsx`
- Modify: `src/app/(portal)/products/page.tsx`

**Acceptance criteria:**
- Each row has a checkbox.
- Selecting ≥1 reveals the sticky bar with "N selected — Create B2B catalogue from selected / Clear".
- B2B-only filter tri-state added to the filters row: **Master only** (default — `is_b2b_only=false`), **Both** (no filter), **B2B-only** (`is_b2b_only=true`).
- Clicking the create button opens a modal: org dropdown, name input, discount %, description.
- Submit POSTs `/api/catalogues` (with `product_ids`) and redirects to `/catalogues/[id]`.

- [ ] **Step 1: Write `B2BOnlyFilter.tsx`** (client, controls URL `b2b_only=master|both|only`)

```tsx
'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function B2BOnlyFilter() {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const value = sp.get('b2b_only') ?? 'master'  // default: master only

  function set(v: 'master' | 'both' | 'only') {
    const params = new URLSearchParams(sp.toString())
    if (v === 'master') params.delete('b2b_only')
    else params.set('b2b_only', v)
    router.push(`${path}?${params.toString()}`)
  }

  return (
    <select className="rounded border-gray-300 text-sm" value={value} onChange={(e) => set(e.target.value as never)}>
      <option value="master">Master only</option>
      <option value="both">Master + B2B-only</option>
      <option value="only">B2B-only</option>
    </select>
  )
}
```

- [ ] **Step 2: Write `ProductsSelectionBar.tsx` and `CreateCatalogueDialog.tsx`**

```tsx
// src/components/products/ProductsSelectionBar.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CreateCatalogueDialog } from '@/components/catalogues/CreateCatalogueDialog'

export function ProductsSelectionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[]
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  if (selectedIds.length === 0) return null
  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
        <span className="text-sm text-gray-700">{selectedIds.length} selected</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClear}>Clear</Button>
          <Button onClick={() => setOpen(true)}>Create B2B catalogue from selected</Button>
        </div>
      </div>
      {open && (
        <CreateCatalogueDialog
          productIds={selectedIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

```tsx
// src/components/catalogues/CreateCatalogueDialog.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Org = { id: string; name: string }

export function CreateCatalogueDialog({
  productIds,
  onClose,
}: {
  productIds: string[]
  onClose: () => void
}) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/organizations').then((r) => r.json()).then((d) => setOrgs(d.organizations ?? []))
  }, [])

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/catalogues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        name,
        description: description || undefined,
        discount_pct: discountPct,
        product_ids: productIds.length > 0 ? productIds : undefined,
      }),
    })
    if (!res.ok) {
      setError((await res.json()).error ?? 'Create failed')
      setBusy(false)
      return
    }
    const { id } = await res.json()
    router.push(`/catalogues/${id}`)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Create B2B catalogue</h2>
        <p className="mt-1 text-sm text-gray-500">
          {productIds.length === 0
            ? 'Empty catalogue — add items after creating.'
            : `${productIds.length} product${productIds.length === 1 ? '' : 's'} will be added (master tiers auto-copied).`}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Organization
            <select
              className="mt-1 w-full rounded border-gray-300"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">— Select —</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input
            label="Discount %"
            type="number"
            min={0}
            max={100}
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !orgId || !name}>
            {busy ? 'Creating…' : 'Create catalogue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Modify `/products/page.tsx`**

The list body needs to live in a client component to own selection state. Extract into `src/components/products/ProductsList.tsx`. Wire:
- Render `<B2BOnlyFilter />` in the filters row.
- Server query honours the `b2b_only` URL param: `master` (default) → `.eq('is_b2b_only', false)`, `both` → no filter, `only` → `.eq('is_b2b_only', true)`.
- Each row's first cell is `<input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggle(p.id)} />`.
- Render `<ProductsSelectionBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />` after the table.

- [ ] **Step 4: Dev-server smoke**

Visit `/products`. Verify:
- Default view hides B2B-only products.
- Switch filter to "Both" — same list (no B2B-only items exist yet).
- Tick 2 rows → sticky bar appears → click "Create" → modal → select PRT → submit → redirected to `/catalogues/<id>` (page lands in Task 14).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(catalogues): /products multi-select + B2B-only filter + create dialog"
```

---

## Task 13: `/catalogues` list page

**Files:**
- Create: `src/app/(portal)/catalogues/page.tsx`
- Create: `src/components/catalogues/CataloguesTable.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { CataloguesTable } from '@/components/catalogues/CataloguesTable'

export const dynamic = 'force-dynamic'

export default async function CataloguesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; org?: string; active?: string; page?: string }>
}) {
  const sp = await searchParams
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('catalogues') && !perms.includes('catalogues:write')) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold">Catalogues is restricted</h1>
        <p className="mt-2 text-sm text-gray-500">
          Ask an admin to grant the <code>catalogues</code> permission on your staff account.
        </p>
      </div>
    )
  }

  const limit = 25
  const page = Math.max(1, Number(sp.page ?? 1))
  const offset = (page - 1) * limit

  let q = admin
    .from('b2b_catalogues')
    .select(
      'id, name, organization_id, discount_pct, is_active, created_at, organizations!inner(name), items:b2b_catalogue_items(count)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (sp.q) q = q.ilike('name', `%${sp.q}%`)
  if (sp.org) q = q.eq('organization_id', sp.org)
  if (sp.active === 'yes') q = q.eq('is_active', true)
  else if (sp.active === 'no') q = q.eq('is_active', false)

  const { data, count } = await q

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Catalogues</h1>
        <Link href="/catalogues" className="rounded bg-black px-4 py-2 text-white">
          New catalogue (use Products → multi-select)
        </Link>
      </div>
      <CataloguesTable rows={(data ?? []) as never[]} count={count ?? 0} page={page} limit={limit} />
    </div>
  )
}
```

(Direct-create from the list page is removed for v1 — every catalogue starts from `/products` multi-select. Keeps the UX uniform.)

- [ ] **Step 2: Write `CataloguesTable.tsx`** (client — filters + read-only table)

Standard pattern: client component reads URL search params, renders filter inputs (search input, org dropdown, active tri-state) that push URL changes via `router.push(url)`. Table body is plain markup with one row per catalogue: name (link to `/catalogues/[id]`), organization name, items count, discount %, active badge, created date.

- [ ] **Step 3: Dev-server smoke + commit**

```bash
git commit -m "feat(catalogues): list page"
```

---

## Task 14: `/catalogues/[id]` tabbed editor

**Files:**
- Create: `src/app/(portal)/catalogues/[id]/page.tsx`
- Create: `src/components/catalogues/CatalogueEditor.tsx`
- Create: `src/components/catalogues/CatalogueItemsTable.tsx`
- Create: `src/components/catalogues/CatalogueItemPricingTiers.tsx`
- Create: `src/components/catalogues/AddFromMasterDialog.tsx`
- Create: `src/components/catalogues/CreateB2BOnlyItemDialog.tsx`
- Create: `src/components/catalogues/CatalogueSettingsForm.tsx`

**Acceptance criteria:**
- Tabs switch without re-fetching items (client state).
- Items tab shows 9 columns per spec §6.3; clearing markup_multiplier_override reverts to inherited × on next render.
- "+ Add from master" opens search modal; submitting POSTs `/api/catalogues/[id]/items` (auto-copies tiers).
- "+ Create B2B-only item" opens form modal; submitting POSTs `/api/catalogues/[id]/items/b2b-only`.
- Tiers tab shows per-item collapsible groups with inline add/edit/delete + "Refresh from master" button (with confirm).
- Settings tab saves via PATCH; Delete cascades.

- [ ] **Step 1: Write the server page (auth + initial load)**

```tsx
// src/app/(portal)/catalogues/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { CatalogueEditor } from '@/components/catalogues/CatalogueEditor'

export const dynamic = 'force-dynamic'

export default async function CatalogueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('catalogues') && !perms.includes('catalogues:write')) notFound()

  const { data: cat } = await admin.from('b2b_catalogues').select('*').eq('id', id).single()
  if (!cat) notFound()

  const [{ data: items }, { data: org }] = await Promise.all([
    admin
      .from('b2b_catalogue_items')
      .select('*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)')
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    admin.from('organizations').select('id, name').eq('id', cat.organization_id).single(),
  ])

  return <CatalogueEditor catalogue={cat} items={items ?? []} organization={org} />
}
```

- [ ] **Step 2: Write `CatalogueEditor.tsx` (tab shell)**

```tsx
'use client'
import { useState } from 'react'
import { CatalogueItemsTable } from './CatalogueItemsTable'
import { CatalogueItemPricingTiers } from './CatalogueItemPricingTiers'
import { CatalogueSettingsForm } from './CatalogueSettingsForm'

export function CatalogueEditor({
  catalogue,
  items: initialItems,
  organization,
}: {
  catalogue: any
  items: any[]
  organization: any
}) {
  const [tab, setTab] = useState<'items' | 'tiers' | 'assignment' | 'settings'>('items')
  const [items, setItems] = useState(initialItems)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{catalogue.name}</h1>
      <p className="text-sm text-gray-500">
        {organization?.name ?? 'Unknown org'} · Discount {catalogue.discount_pct}%
        {!catalogue.is_active && ' · Inactive'}
      </p>
      <nav className="mt-4 flex gap-4 border-b">
        {(['items', 'tiers', 'assignment', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 ${tab === t ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'items' && (
          <CatalogueItemsTable
            catalogueId={catalogue.id}
            items={items}
            onChange={setItems}
          />
        )}
        {tab === 'tiers' && (
          <CatalogueItemPricingTiers catalogueId={catalogue.id} items={items} />
        )}
        {tab === 'assignment' && (
          <div className="rounded border border-gray-200 p-4">
            <p>Owned by <strong>{organization?.name}</strong></p>
            <p className="mt-1 text-sm text-gray-500">
              Many catalogues per org are allowed (e.g. seasonal). Use Settings → name to differentiate.
            </p>
            <a className="mt-3 inline-block text-blue-600 underline" href={`/b2b-accounts/${organization?.id}`}>
              Open b2b account → (route to be built in sibling spec)
            </a>
          </div>
        )}
        {tab === 'settings' && (
          <CatalogueSettingsForm catalogue={catalogue} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `CatalogueItemsTable.tsx`**

Render a `<table>` with the 9 columns from spec §6.3. Each row shows:

| Column | Read | Write (PATCH `/api/catalogues/[catalogueId]/items/[itemId]`) |
|---|---|---|
| Image | `item.source.image_url` (or first `product_images` row) | — |
| Name | `item.source.name` (suffix `· B2B-only` badge if `item.source.is_b2b_only`) | — |
| Base cost | `item.source.base_cost` (greyed) | — (locked) |
| Markup × | `item.markup_multiplier_override ?? item.source.markup_multiplier` | onBlur: `{ markup_multiplier_override: value || null }` (empty = revert to inherit) |
| Decoration type | `item.decoration_type_override ?? '—'` | onChange: `{ decoration_type_override: value || null }`, options `['', 'Screen print', 'Heat press', 'Super colour', 'N/A']` |
| Decoration price | `item.decoration_price_override ?? item.source.decoration_price ?? '—'` | onBlur: `{ decoration_price_override: value || null }` |
| Shipping | `item.shipping_cost_override ?? '—'` | onBlur: `{ shipping_cost_override: value || null }` |
| Active | `item.is_active` | onChange: `{ is_active: checked }` |
| Actions | — | "Tiers" button (jump to Tiers tab + scroll to item) / "Remove" (DELETE with confirm) |

Footer two buttons:
- **+ Add from master** — opens `<AddFromMasterDialog catalogueId={catalogueId} onAdded={refetchItems} />`
- **+ Create B2B-only item** — opens `<CreateB2BOnlyItemDialog catalogueId={catalogueId} onAdded={refetchItems} />`

`refetchItems` hits `GET /api/catalogues/[id]/items` and calls `onChange(newItems)`.

- [ ] **Step 4: Write `AddFromMasterDialog.tsx`**

Modal with a search input (debounced 300ms) → `GET /api/products?search=...&limit=20&b2b_only=master` (extend products API if it doesn't accept search; otherwise filter client-side from a smaller fetched window). Display results as clickable cards (image + name + sku). On click: `POST /api/catalogues/[catalogueId]/items` with `{ source_product_id }`, then `onAdded()`.

- [ ] **Step 5: Write `CreateB2BOnlyItemDialog.tsx`**

Modal with form: name (required), base_cost (required), decoration_eligible (checkbox), decoration_price (number, conditional on eligible), image_url (text, optional). Submit POSTs `/api/catalogues/[catalogueId]/items/b2b-only`, then `onAdded()`.

- [ ] **Step 6: Write `CatalogueItemPricingTiers.tsx`**

For each item, render a collapsible card. When opened: GET `/api/catalogues/[id]/items/[itemId]/tiers`. Render existing tiers as inline-editable rows (min_quantity, max_quantity, unit_price, delete button). Footer: add-row form. Header: "Refresh from master" button → confirm modal → POST `/api/catalogues/[id]/items/[itemId]/refresh-tiers`. After refresh, re-fetch tiers for this item.

- [ ] **Step 7: Write `CatalogueSettingsForm.tsx`**

Form: name, description, discount_pct, is_active. Save button PATCHes `/api/catalogues/[id]`. Danger zone: "Delete catalogue" with two-step confirm → DELETE `/api/catalogues/[id]` → redirect to `/catalogues`.

- [ ] **Step 8: Dev-server smoke end-to-end**

From the catalogue created in Task 12:
- Items tab: edit markup → refresh → sees override; clear markup → refresh → back to inherited.
- "+ Create B2B-only item" → fill name + base_cost → submit → item appears in table with "B2B-only" badge.
- Visit `/products` with B2B-only filter "B2B-only" → the new product is listed.
- Tiers tab: add 1 tier, edit, delete. "Refresh from master" replaces with master tiers.
- Settings: toggle active → /catalogues list shows "Inactive" suffix.
- Delete: cascades; /catalogues list no longer shows it. (Note: cascade also deletes the synthetic-master products via `on delete cascade`? — **NO**, products are only cascaded from `b2b_catalogue_items.source_product_id on delete cascade` which goes products→items, not items→products. Verify: synthetic-master products survive after catalogue delete — they become orphaned `is_b2b_only=true` rows. Cleanup of orphans is a follow-up admin tool.)

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(catalogues): tabbed editor (items/tiers/assignment/settings)"
```

---

## Task 15: Sidebar nav entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add the nav section**

Mirror the Products entry. Icon: `BookOpen` from `lucide-react`. Permission: `'catalogues'` or `'catalogues:write'`. Position: directly under Products.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(catalogues): sidebar nav entry"
```

---

## Task 16: Customer portal `/shop` — catalogue-scope branch + `effective_unit_price`

**Files (in `print-room-portal` repo):**
- Create: `lib/shop/effective-price.ts`
- Modify: `app/(portal)/shop/page.tsx`

**Acceptance criteria:**
- Org with active catalogue → `/shop` renders exactly the catalogue's products (master + B2B-only synthetic-master, both via existing rendering).
- Org with no catalogue → unchanged behaviour (global B2B channel).
- All card prices use `effective_unit_price`.
- B2B-only items navigate to `/shop/[productId]` PDP successfully (existing route handles them because they're real products).

- [ ] **Step 1: Write the helper**

```ts
// lib/shop/effective-price.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function effectiveUnitPrice(
  admin: SupabaseClient,
  productId: string,
  orgId: string,
  qty: number,
): Promise<number> {
  const { data } = await admin.rpc('effective_unit_price', {
    p_product_id: productId,
    p_org_id: orgId,
    p_qty: qty,
  })
  return Number(data ?? 0)
}
```

- [ ] **Step 2: Modify `app/(portal)/shop/page.tsx` — add the catalogue branch**

Replace the existing product-fetching block:

```ts
// 1. Collect product ids in this org's active catalogues.
const { data: catItems } = await admin
  .from('b2b_catalogue_items')
  .select('source_product_id, b2b_catalogues!inner(is_active)')
  .eq('b2b_catalogues.organization_id', context.organizationId)
  .eq('b2b_catalogues.is_active', true)
  .eq('is_active', true)

const scopedProductIds = Array.from(
  new Set((catItems ?? []).map((r) => r.source_product_id as string)),
)
const hasCatalogueScope = scopedProductIds.length > 0

let q = admin.from('products')
  .select('id, name, sku, image_url, brand_id, category_id, moq', { count: 'exact' })
  .eq('is_active', true)
  .order('name')
  .range(offset, offset + limit - 1)

if (hasCatalogueScope) {
  q = q.in('id', scopedProductIds)
} else {
  q = q
    .select('id, name, sku, image_url, brand_id, category_id, moq, ' +
            '_channel:product_type_activations!inner(product_type,is_active)',
            { count: 'exact' })
    .eq('_channel.product_type', 'b2b')
    .eq('_channel.is_active', true)
}

if (sp.q) q = q.ilike('name', `%${sp.q}%`)
if (sp.brand_id) q = q.eq('brand_id', sp.brand_id)

const { data } = await q
const rows = (data ?? []) as unknown as ProductRow[]
```

- [ ] **Step 3: Swap the pricing RPC call**

```ts
import { effectiveUnitPrice } from '@/lib/shop/effective-price'
// ...
const price = await effectiveUnitPrice(admin, p.id, context.organizationId, moqQty || 1)
```

(Replace the existing `admin.rpc('get_unit_price', { ... })` call.)

- [ ] **Step 4: Dev-server smoke (customer portal)**

- Log in as a PRT user (no catalogue yet) → `/shop` renders identical to before.
- Seed one catalogue for PRT with 2 master items + 1 B2B-only item via staff portal → refresh PRT `/shop` → exactly those 3 items render.
- Click the B2B-only item → PDP at `/shop/[productId]` loads correctly.
- Add to cart → cart works.
- Delete the catalogue → refresh → PRT back to global-channel list.

- [ ] **Step 5: Commit**

```bash
# in print-room-portal
git commit -m "feat(shop): catalogue-scope branch + effective_unit_price"
```

---

## Task 17: Seed PRT Demo Catalogue

**Acceptance criteria:** PRT (`ee155266-200c-4b73-8dbd-be385db3e5b0`) has one catalogue with 3 master items + 1 B2B-only item. Removable.

- [ ] **Step 1: Pick 3 product ids with Jamie**

```sql
select id, name, sku from products
where platform = 'uniforms' and is_active and not is_b2b_only
order by random() limit 10;
```

Ask Jamie to pick 3.

- [ ] **Step 2: Use the staff UI to seed (avoids hand-rolling tier copies)**

Visit `/products`, tick the 3 chosen, click "Create B2B catalogue from selected", select PRT, name "PRT Demo Catalogue", discount 0, submit. Then on the catalogue editor, "+ Create B2B-only item" → name "PRT Bespoke Logo Sticker", base_cost 2.50, decoration_eligible false, no image. Save.

- [ ] **Step 3: Verify**

Log in as PRT customer → `/shop` → 4 items visible. Click the B2B-only item → PDP loads. Add to cart → works.

- [ ] **Step 4: Record in memory** (no commit; seed lives in DB)

---

## Task 18: Verification checklist

**Acceptance:** Every bullet in spec §13 verified.

- [ ] Migration `20260424_products_markup_multiplier` applied; sync trigger smoke-tested both directions; `get_unit_price` parity verified.
- [ ] Migration `20260424_products_is_b2b_only` applied; default value confirmed.
- [ ] Migration `20260424_b2b_catalogues_tables` applied cleanly; indexes + 3 RLS policies in place.
- [ ] Migration `20260424_b2b_catalogues_rpcs` applied; `effective_unit_price` matches `get_unit_price` for orgs without a catalogue.
- [ ] `POST /api/catalogues` with `product_ids` creates catalogue + N items + auto-copied tiers in one round-trip.
- [ ] `POST /api/catalogues/[id]/items/b2b-only` creates a `products` row (`is_b2b_only=true`) and a catalogue item in one transaction; rollback on either failure.
- [ ] `/products` multi-select → create catalogue → redirects to detail with items pre-populated.
- [ ] `/products` filter: default hides B2B-only; "B2B-only" only shows them.
- [ ] Items tab: clearing markup_multiplier_override reverts displayed × value to inherited on next render.
- [ ] Pricing tiers "Refresh from master" replaces local tiers with current master tiers.
- [ ] Customer `/shop`: 3 scenarios — no catalogue (fallback), catalogue with master + B2B-only items (scope, both render, PDP works), deleted catalogue (fallback restored).
- [ ] B2B-only item PDP `/shop/[productId]` loads, adds to cart, checkout completes.
- [ ] RLS denial: org A user cannot select org B's catalogues.
- [ ] Permission 403: non-permitted staff → `POST /api/catalogues` returns 403.
- [ ] Cascade delete: deleting a catalogue cascades to items + tiers (verify counts). Synthetic-master B2B-only `products` rows survive (orphan; cleanup is follow-up).
- [ ] `middleware-pr` regression: edit a uniforms product's markup in `middleware-pr` → `markup_multiplier` reflects the new value within the same transaction.

- [ ] **Step 1: Walk the list, tick each, note any failures**

- [ ] **Step 2: Commit verification log**

```bash
# Append a "## 2026-04-24 — sub-app #3 verified" section to docs/superpowers/notes/verification-log.md
git add docs/superpowers/notes/verification-log.md
git commit -m "docs(catalogues): verification log for sub-app #3"
```

---

## Post-plan handoff

After Task 18:

1. **Sibling-spec follow-ups to queue** (per spec §12):
   - Category-driven markup rules
   - Visual override flags (green/red/orange)
   - Customer-portal Catalog sidebar rename + cart context isolation
   - Per-catalogue-item images (custom design proofs uploaded by account managers)
   - Metafield vocabulary lock
   - `b2b-accounts/[orgId]` staff page
   - `markup_pct` column drop after `middleware-pr` decommission
   - `/products` editor UI swap to display `markup_multiplier` directly
   - Orphaned-B2B-only-product cleanup admin tool

2. **Memory updates**:
   - Update `project_b2b_plans_set.md` to note sub-app #3 has landed.
   - Refresh `project_b2b_catalogues_spec_plan.md` with execution date.

3. **Shipping note draft** (matches Jamie's morning-shipping-note habit):
   - Outcome: customers can now see a custom product list per org, including bespoke B2B-only items.
   - Order: markup rename → catalogue schema → staff UI → customer /shop.
   - Why: unblocks bespoke B2B customer launches (Re Burger, etc.) and removes the global-only B2B channel constraint.
   - Ask Jon (as a question): "Want me to walk Chris through the PRT demo catalogue before we open it to a second customer?"
