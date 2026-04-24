# B2B Catalogues Sub-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-portal B2B Catalogues sub-app — per-organization product catalogues with duplicated items, override-at-item markup/decoration/shipping, per-item tier pricing, catalogue-level discount, and an "assign products as catalogue" flow from the existing `/products` list. Extend the customer portal `/shop` query to catalogue-scope when the viewing org has assigned catalogues, with a safe fallback to the current global B2B channel filter when it does not.

**Spec:** [2026-04-24-staff-portal-b2b-catalogues-subapp-design.md](../specs/2026-04-24-staff-portal-b2b-catalogues-subapp-design.md).

**Architecture:** Three new Postgres tables (`b2b_catalogues`, `b2b_catalogue_items`, `b2b_catalogue_item_pricing_tiers`) plus two Postgres functions (`catalogue_unit_price`, `effective_unit_price`). Staff UI lives under `src/app/(portal)/catalogues/` and extends the existing `/products` list. Customer portal `/shop` gets a single-file query extension; no new routes, no cart/checkout ripple.

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase (Postgres + RLS + Auth), Tailwind v4, TypeScript, MCP `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql` for DB ops (🟡 **present SQL to Jamie for approval before every apply**). No JS test framework installed — verification is SQL probes + cURL against running dev server.

**Repos touched:**
- `print-room-staff-portal` — all new UI, API, schema, RPCs, permission helper
- `print-room-portal` — one file (`app/(portal)/shop/page.tsx`) switches to the new pricing RPC and gains a catalogue-scope branch

**Next.js 16 note (per both repos' AGENTS.md):** `params` in page and route handlers is a `Promise<...>` — always `await` it. Server files that read cookies use `await cookies()`. Re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `dynamic-routes.md` before writing any new route handler. Do not use Pages-Router idioms.

**Destructive-write policy:** Every `mcp__supabase__apply_migration` and `mcp__supabase__execute_sql` call must present the exact SQL in chat and wait for Jamie's 🟢 before invocation. Plan treats all SQL as 🟡.

---

## Ambiguities resolved (from spec review — override these in review if wrong)

1. **Spec §11 decision #2 (cardinality)** is "many catalogues per org allowed, no UNIQUE". Plan implements without the UNIQUE constraint.
2. **Spec §11 decision #4 (markup type)** is "percentage on `numeric(6,2)`, display rule TBD". Plan uses percentage in schema and the catalogue editor renders it as `markup %` in the UI label. Multiplier display is a follow-up (flagged as a UI-only change in the sibling visual-flags spec).
3. **Spec §11 decision #11 (auto-copy master tiers)** is "not automatic". Plan provides a "Copy tiers from master" button per item, no automatic behaviour.
4. **Spec §7.3 (customer-side B2B-only items)** is "data admissible, UI hides until sibling spec". Plan's customer `/shop` update lists only items with `source_product_id IS NOT NULL`; B2B-only items stay dormant.
5. **Permission helper pattern** — confirmed present: [src/lib/inventory/server.ts](src/lib/inventory/server.ts) exports `requireInventoryStaffAccess()` returning `{ error: NextResponse }` on failure OR `{ admin, context }` on success. Do NOT throw. All new catalogue routes follow this same `const auth = await requireCataloguesStaffAccess(); if ('error' in auth) return auth.error` pattern. Supabase helpers are `getSupabaseAdmin()` (service role, sync) and `getSupabaseServer()` (RLS-scoped, `await`-able cookies) from `@/lib/supabase-server`. Accept `'catalogues'` OR `'catalogues:write'` on `staff_users.permissions`. Admin/super_admin bypass.
6. **`StaffPermission`** (`src/types/staff.ts`) gains `'catalogues'` and `'catalogues:write'` literals.
7. **Decoration type enum** — spec §6.3 lists "N/A / Screen print / Heat press / Super colour". Plan stores as free-text `text` on `decoration_type_override` with UI dropdown; a CHECK constraint is deferred (mirrors the products-tags CHECK-deferred decision from sub-app #1 §5.2).
8. **`/b2b-accounts/[orgId]` route does NOT exist in the staff portal today** (verified 2026-04-24). The `CatalogueEditor` Assignment tab links to it anyway — the 404 is the intended wayfinder for the sibling b2b-accounts sub-app. Do NOT scaffold that route in this plan. Flag as a follow-up in the spec's §12.
9. **`/api/organizations` does not exist today** — Task 10 Step 2's dialog depends on it. Task 10 Step 1a (new) adds a minimal handler.
10. **`/api/products?search=...` for the add-item picker** — if the existing list endpoint does not accept a search param, add one in Task 12's scope or fall back to client-side filter of all `platform='uniforms'` products. Verify during implementation.

---

## File structure

### New files (staff portal: `print-room-staff-portal`)

- `sql/006_b2b_catalogues.sql` — reference copy of the migration; authoritative apply happens via MCP
- `src/types/catalogues.ts` — API DTOs, override-column types, tier type
- `src/lib/catalogues/server.ts` — `requireCataloguesStaffAccess`, admin client loader
- `src/lib/catalogues/queries.ts` — shared PostgREST helpers (catalogues-for-org, items-for-catalogue)
- `src/app/api/catalogues/route.ts` — GET list, POST create-from-selection
- `src/app/api/catalogues/[id]/route.ts` — GET one, PATCH, DELETE
- `src/app/api/catalogues/[id]/items/route.ts` — GET items, POST add
- `src/app/api/catalogues/[id]/items/[itemId]/route.ts` — GET, PATCH, DELETE
- `src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts` — GET, POST
- `src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts` — PATCH, DELETE
- `src/app/api/catalogues/[id]/items/[itemId]/copy-tiers/route.ts` — POST (copy master tiers into this item)
- `src/app/api/catalogues/by-org/[orgId]/route.ts` — GET catalogues for one org (internal staff use)
- `src/app/(portal)/catalogues/page.tsx` — list
- `src/app/(portal)/catalogues/[id]/page.tsx` — tabbed editor
- `src/components/catalogues/CreateCatalogueDialog.tsx`
- `src/components/catalogues/CataloguesTable.tsx`
- `src/components/catalogues/CatalogueItemsTable.tsx`
- `src/components/catalogues/CatalogueItemPricingTiers.tsx`
- `src/components/catalogues/AddCatalogueItemDialog.tsx`
- `src/components/catalogues/CatalogueSettingsForm.tsx`
- `src/components/products/ProductsSelectionBar.tsx`

### Modified files (staff portal)

- `src/types/staff.ts` — add `'catalogues'` and `'catalogues:write'` literals to `StaffPermission`
- `src/components/layout/Sidebar.tsx` — add "Catalogues" nav entry (icon: `BookOpen` from lucide-react), permission `'catalogues'`
- `src/app/(portal)/products/page.tsx` — add row checkboxes + render `ProductsSelectionBar` when selection non-empty

### Modified files (customer portal: `print-room-portal`)

- `app/(portal)/shop/page.tsx` — add catalogue-scope branch; swap `get_unit_price` → `effective_unit_price`
- `lib/shop/effective-price.ts` — (new) thin helper wrapping the RPC call (matches the helper pattern already in customer portal)

### Database migrations (via `mcp__supabase__apply_migration`)

- `20260424_b2b_catalogues_tables` — tables + indexes + RLS enable + policies
- `20260424_b2b_catalogues_rpcs` — `catalogue_unit_price`, `effective_unit_price`
- `20260424_b2b_catalogues_permission` — seed `'catalogues'` permission recognition (docs only; permission literal is code-side)

---

# Tasks

## Task 1: Create b2b_catalogues schema (tables, indexes, RLS)

**Files:**
- Migration (via MCP): `20260424_b2b_catalogues_tables`
- Reference copy: `sql/006_b2b_catalogues.sql`

**Acceptance criteria:**
- Tables `b2b_catalogues`, `b2b_catalogue_items`, `b2b_catalogue_item_pricing_tiers` exist with columns and constraints below.
- All three have RLS enabled and customer-read policies scoped via `user_organizations`.
- Indexes listed below exist.
- Re-running the migration is a no-op (every `create` uses `if not exists`, every `create policy` is guarded).

- [ ] **Step 1: Draft the migration and present to Jamie for approval**

Post the full SQL (below) to chat as a `sql` code block with message: "🟡 Apply migration `20260424_b2b_catalogues_tables`? Creates three new tables + indexes + RLS. No data changes. Reply 🟢 to apply."

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
  id                        uuid primary key default gen_random_uuid(),
  catalogue_id              uuid not null references b2b_catalogues(id) on delete cascade,
  source_product_id         uuid references products(id) on delete set null,
  name                      text,
  base_cost_snapshot        numeric(10,2),
  image_url_snapshot        text,
  markup_pct_override       numeric(6,2),
  decoration_type_override  text,
  decoration_price_override numeric(10,2),
  shipping_cost_override    numeric(10,2),
  metafields                jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  sort_order                integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint b2b_catalogue_items_source_or_snapshot check (
    source_product_id is not null
    or (name is not null and base_cost_snapshot is not null)
  ),
  constraint b2b_catalogue_items_unique_product
    unique (catalogue_id, source_product_id)
);

create index if not exists b2b_catalogue_items_catalogue_idx
  on b2b_catalogue_items (catalogue_id) where is_active;
create index if not exists b2b_catalogue_items_source_product_idx
  on b2b_catalogue_items (source_product_id) where source_product_id is not null;

create table if not exists b2b_catalogue_item_pricing_tiers (
  id                  uuid primary key default gen_random_uuid(),
  catalogue_item_id   uuid not null references b2b_catalogue_items(id) on delete cascade,
  min_quantity             integer not null,
  max_quantity             integer,
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

- [ ] **Step 2: Apply migration on 🟢**

Invoke `mcp__supabase__apply_migration` with `name = "20260424_b2b_catalogues_tables"` and the SQL above.

- [ ] **Step 3: Verify schema**

Invoke `mcp__supabase__execute_sql`:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_name in ('b2b_catalogues', 'b2b_catalogue_items', 'b2b_catalogue_item_pricing_tiers')
order by table_name, ordinal_position;

select policyname, tablename from pg_policies
where tablename in ('b2b_catalogues', 'b2b_catalogue_items', 'b2b_catalogue_item_pricing_tiers');
```

Expected: 10+11+6 column rows (matching the CREATE statements) and 3 policies.

- [ ] **Step 4: Save reference copy**

Write the same SQL to `sql/006_b2b_catalogues.sql` (pre-appended with header comment `-- 006_b2b_catalogues.sql — applied via MCP migration 20260424_b2b_catalogues_tables on <date>`).

- [ ] **Step 5: Commit**

```bash
git add sql/006_b2b_catalogues.sql
git commit -m "feat(catalogues): add b2b_catalogues schema migration (applied via MCP)"
```

---

## Task 2: Create pricing RPCs

**Files:**
- Migration (via MCP): `20260424_b2b_catalogues_rpcs`

**Acceptance criteria:**
- `catalogue_unit_price(p_catalogue_item_id uuid, p_qty integer)` returns `numeric(10,2)` computed per spec §5.3.
- `effective_unit_price(p_product_id uuid, p_org_id uuid, p_qty integer)` returns `numeric(10,2)`, delegating to `catalogue_unit_price` when a catalogue item exists, otherwise to `get_unit_price`.
- Both functions are `stable`, `security definer`, owned by `postgres`.

- [ ] **Step 1: Draft the RPC migration and present to Jamie for approval**

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
  v_tier_price   numeric(10,2);
  v_item         b2b_catalogue_items%rowtype;
  v_catalogue    b2b_catalogues%rowtype;
  v_source_base  numeric(10,2);
  v_source_mkup  numeric(6,2);
  v_markup_pct   numeric(6,2);
  v_base         numeric(10,2);
  v_result       numeric(10,2);
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
    if v_item.source_product_id is not null then
      select base_cost, markup_pct into v_source_base, v_source_mkup
      from products where id = v_item.source_product_id;
    else
      v_source_base := v_item.base_cost_snapshot;
      v_source_mkup := 0;
    end if;
    v_markup_pct := coalesce(v_item.markup_pct_override, v_source_mkup, 0);
    v_base := round(coalesce(v_source_base, 0) * (1 + v_markup_pct / 100.0), 2);
  end if;

  v_result := round(v_base * (1 - coalesce(v_catalogue.discount_pct, 0) / 100.0), 2);
  return v_result;
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

Post to chat: "🟡 Apply migration `20260424_b2b_catalogues_rpcs`? Creates two new functions. Reply 🟢."

- [ ] **Step 2: Apply on 🟢**

Invoke `mcp__supabase__apply_migration` with `name = "20260424_b2b_catalogues_rpcs"`.

- [ ] **Step 3: Smoke-test the fallback path**

Invoke `mcp__supabase__execute_sql`:

```sql
-- Pick any product that already has pricing via get_unit_price for PRT.
-- Expect: effective_unit_price returns the same value as get_unit_price when no catalogue exists.
select
  p.id as product_id,
  get_unit_price(p.id, 'ee155266-200c-4b73-8dbd-be385db3e5b0'::uuid, 10) as legacy,
  effective_unit_price(p.id, 'ee155266-200c-4b73-8dbd-be385db3e5b0'::uuid, 10) as effective
from products p
where p.platform = 'uniforms' and p.is_active
limit 3;
```

Expected: `legacy = effective` for every row (catalogue scope is empty for PRT at this point).

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(catalogues): add catalogue_unit_price + effective_unit_price RPCs (applied via MCP)"
```

---

## Task 3: Add `catalogues` permission + server auth helper

**Files:**
- Modify: `src/types/staff.ts`
- Create: `src/lib/catalogues/server.ts`

**Acceptance criteria:**
- `StaffPermission` includes `'catalogues'` and `'catalogues:write'`.
- `requireCataloguesStaffAccess()` returns `{ error: NextResponse }` on failure OR `{ admin, context }` on success. Callers do `if ('error' in auth) return auth.error`.

- [ ] **Step 1: Extend `StaffPermission` type**

Open [src/types/staff.ts](src/types/staff.ts). Add the two literals:

```ts
export type StaffPermission =
  | 'products:write'
  | 'inventory'
  | 'inventory:write'
  | 'catalogues'
  | 'catalogues:write'
  // ...keep whatever else is there
```

- [ ] **Step 2: Write `src/lib/catalogues/server.ts`**

Mirror [src/lib/inventory/server.ts](src/lib/inventory/server.ts) exactly — same return-shape, same Supabase helper names.

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
  const hasCataloguesPerm =
    permissions.includes('catalogues') || permissions.includes('catalogues:write')

  if (!isAdmin && !hasCataloguesPerm) {
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

## Task 4: Define API DTO types

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
  source_product_id: string | null
  name: string | null
  base_cost_snapshot: number | null
  image_url_snapshot: string | null
  markup_pct_override: number | null
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

export type AddCatalogueItemBody =
  | { source_product_id: string }
  | { name: string; base_cost_snapshot: number; image_url?: string }

export type UpdateCatalogueItemBody = Partial<{
  name: string
  markup_pct_override: number | null
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

## Task 5: `POST /api/catalogues` (create-from-selection) + GET list

**Files:**
- Create: `src/app/api/catalogues/route.ts`

**Acceptance criteria:**
- `POST` with `{organization_id, name, product_ids: [uuid,uuid]}` creates one `b2b_catalogues` row + two `b2b_catalogue_items` rows (source_product_id populated) in a single transaction.
- `POST` with no `product_ids` creates an empty catalogue.
- Returns `201 { id }`.
- `GET` returns catalogues with `{ id, name, organization_id, discount_pct, is_active, items_count, created_at }`.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { CreateCatalogueBody } from '@/types/catalogues'

export async function POST(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = (await request.json()) as CreateCatalogueBody

  if (!body.organization_id || !body.name) {
    return Response.json({ error: 'organization_id and name required' }, { status: 400 })
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
    return Response.json({ error: cErr?.message ?? 'create failed' }, { status: 500 })
  }

  if (body.product_ids?.length) {
    const rows = body.product_ids.map((pid, i) => ({
      catalogue_id: cat.id,
      source_product_id: pid,
      sort_order: i,
    }))
    const { error: iErr } = await admin.from('b2b_catalogue_items').insert(rows)
    if (iErr) {
      // Cleanup: delete the catalogue so no partial state
      await admin.from('b2b_catalogues').delete().eq('id', cat.id)
      return Response.json({ error: iErr.message }, { status: 500 })
    }
  }

  return Response.json({ id: cat.id }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const url = new URL(request.url)
  const orgId = url.searchParams.get('organization_id')

  let q = admin
    .from('b2b_catalogues')
    .select('id, organization_id, name, discount_pct, is_active, created_at, items:b2b_catalogue_items(count)')
    .order('created_at', { ascending: false })
  if (orgId) q = q.eq('organization_id', orgId)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ catalogues: data ?? [] })
}
```

- [ ] **Step 2: cURL smoke-test (dev server must be running)**

```bash
curl -X POST http://localhost:3000/api/catalogues \
  -H 'Content-Type: application/json' \
  -H "Cookie: $(cat .cookie-for-staff-user)" \
  -d '{"organization_id":"ee155266-200c-4b73-8dbd-be385db3e5b0","name":"cURL test","product_ids":[]}'
```
Expected: `201 {"id":"<uuid>"}`. Then `GET /api/catalogues?organization_id=ee155266-...` returns the new row.

- [ ] **Step 3: Clean up test row**

```bash
# via psql or MCP execute_sql:
# delete from b2b_catalogues where name = 'cURL test';
```

Present the DELETE SQL to Jamie for 🟢 before executing.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalogues/route.ts
git commit -m "feat(catalogues): add POST/GET /api/catalogues"
```

---

## Task 6: `GET/PATCH/DELETE /api/catalogues/[id]`

**Files:**
- Create: `src/app/api/catalogues/[id]/route.ts`

**Acceptance criteria:**
- `GET` returns `{catalogue, items: CatalogueItemRow[]}`.
- `PATCH` accepts `{name?, description?, discount_pct?, is_active?}`; sets `updated_at = now()`.
- `DELETE` cascades (tables set `on delete cascade`). Returns 204.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth

  const [cat, items] = await Promise.all([
    admin.from('b2b_catalogues').select('*').eq('id', id).single(),
    admin
      .from('b2b_catalogue_items')
      .select('*, source:products(id, name, sku, base_cost, markup_pct, image_url)')
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])
  if (cat.error || !cat.data) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json({ catalogue: cat.data, items: items.data ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['name', 'description', 'discount_pct', 'is_active']) {
    if (k in body) patch[k] = body[k]
  }

  const { error } = await admin.from('b2b_catalogues').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { error } = await admin.from('b2b_catalogues').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: cURL smoke**

```bash
CAT_ID=<from Task 5>
curl http://localhost:3000/api/catalogues/$CAT_ID
curl -X PATCH http://localhost:3000/api/catalogues/$CAT_ID -H 'Content-Type: application/json' -d '{"discount_pct": 10}'
curl -X DELETE http://localhost:3000/api/catalogues/$CAT_ID
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/catalogues/\[id\]/route.ts
git commit -m "feat(catalogues): add GET/PATCH/DELETE /api/catalogues/[id]"
```

---

## Task 7: Items CRUD — `POST/GET /api/catalogues/[id]/items` + `PATCH/DELETE /api/catalogues/[id]/items/[itemId]`

**Files:**
- Create: `src/app/api/catalogues/[id]/items/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/route.ts`

**Acceptance criteria:**
- `POST /items` accepts `{source_product_id}` OR `{name, base_cost_snapshot, image_url?}`; inserts one row.
- `PATCH /items/[itemId]` accepts `UpdateCatalogueItemBody`; clearing a field to `null` reverts to inherit.
- `DELETE /items/[itemId]` removes the row (cascades tiers).

- [ ] **Step 1: Write POST/GET (items collection)**

```ts
// src/app/api/catalogues/[id]/items/route.ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { AddCatalogueItemBody } from '@/types/catalogues'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_items')
    .select('*, source:products(id, name, sku, base_cost, markup_pct, image_url, decoration_price)')
    .eq('catalogue_id', id)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = (await request.json()) as AddCatalogueItemBody

  const insert: Record<string, unknown> = { catalogue_id: id }
  if ('source_product_id' in body) {
    insert.source_product_id = body.source_product_id
  } else {
    if (!body.name || typeof body.base_cost_snapshot !== 'number') {
      return Response.json(
        { error: 'name and base_cost_snapshot required for b2b-only items' },
        { status: 400 },
      )
    }
    insert.name = body.name
    insert.base_cost_snapshot = body.base_cost_snapshot
    insert.image_url_snapshot = body.image_url ?? null
  }

  const { data, error } = await admin
    .from('b2b_catalogue_items')
    .insert(insert)
    .select('id')
    .single()
  if (error || !data) return Response.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  return Response.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Write PATCH/DELETE (item singular)**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/route.ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

const PATCHABLE = [
  'name',
  'markup_pct_override',
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
  const { admin, context } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of PATCHABLE) {
    if (k in body) patch[k] = body[k]
  }

  const { error } = await admin.from('b2b_catalogue_items').update(patch).eq('id', itemId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { error } = await admin.from('b2b_catalogue_items').delete().eq('id', itemId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: cURL smoke (create, patch, delete one item)**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(catalogues): add items CRUD endpoints"
```

---

## Task 8: Pricing tier CRUD + copy-from-master

**Files:**
- Create: `src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts`
- Create: `src/app/api/catalogues/[id]/items/[itemId]/copy-tiers/route.ts`

**Acceptance criteria:**
- `POST /tiers` accepts `{min_quantity, max_quantity?, unit_price}`.
- `PATCH /tiers/[tierId]` updates `min_quantity`, `max_quantity`, `unit_price`.
- `POST /copy-tiers` reads `product_pricing_tiers` for the item's `source_product_id` and inserts them as `b2b_catalogue_item_pricing_tiers`. If item has no `source_product_id`, returns 400.

- [ ] **Step 1: Write tiers collection route**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/tiers/route.ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .select('*')
    .eq('catalogue_item_id', itemId)
    .order('min_quantity')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tiers: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = await request.json()
  if (typeof body.min_quantity !== 'number' || typeof body.unit_price !== 'number') {
    return Response.json({ error: 'min_quantity and unit_price required' }, { status: 400 })
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
  if (error || !data) return Response.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  return Response.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Write tier singular PATCH/DELETE**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/tiers/[tierId]/route.ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = await request.json()
  const patch: Record<string, unknown> = {}
  for (const k of ['min_quantity', 'max_quantity', 'unit_price']) if (k in body) patch[k] = body[k]
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .update(patch)
    .eq('id', tierId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .delete()
    .eq('id', tierId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Write copy-tiers route**

```ts
// src/app/api/catalogues/[id]/items/[itemId]/copy-tiers/route.ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth

  const { data: item } = await admin
    .from('b2b_catalogue_items')
    .select('source_product_id')
    .eq('id', itemId)
    .single()
  if (!item?.source_product_id) {
    return Response.json({ error: 'item has no source product' }, { status: 400 })
  }

  const { data: masterTiers, error: mErr } = await admin
    .from('product_pricing_tiers')
    .select('min_quantity, max_quantity, unit_price')
    .eq('product_id', item.source_product_id)
    .eq('is_active', true)
    .order('min_quantity')
  if (mErr) return Response.json({ error: mErr.message }, { status: 500 })
  if (!masterTiers?.length) return Response.json({ inserted: 0 })

  const rows = masterTiers.map((t) => ({
    catalogue_item_id: itemId,
    min_quantity: t.min_quantity,
    max_quantity: t.max_quantity,
    unit_price: t.unit_price,
  }))
  const { error: iErr, count } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .insert(rows, { count: 'exact' })
  if (iErr) return Response.json({ error: iErr.message }, { status: 500 })
  return Response.json({ inserted: count ?? rows.length })
}
```

Master `product_pricing_tiers` column names verified 2026-04-24: `min_quantity`, `max_quantity`, `unit_price`, `currency`, `tier_level`, `is_active`. This route filters to active tiers only.

- [ ] **Step 4: cURL smoke each endpoint**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(catalogues): add pricing tier CRUD + copy-from-master"
```

---

## Task 9: `GET /api/catalogues/by-org/[orgId]`

**Files:**
- Create: `src/app/api/catalogues/by-org/[orgId]/route.ts`

**Acceptance criteria:**
- Returns active catalogues for the org plus a count of items per catalogue.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const { data, error } = await admin
    .from('b2b_catalogues')
    .select('id, name, discount_pct, is_active, created_at, items:b2b_catalogue_items(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ catalogues: data ?? [] })
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(catalogues): add by-org lookup endpoint"
```

---

## Task 10: `/products` multi-select + sticky action bar

**Files:**
- Create: `src/components/products/ProductsSelectionBar.tsx`
- Create: `src/components/catalogues/CreateCatalogueDialog.tsx`
- Modify: `src/app/(portal)/products/page.tsx`

**Acceptance criteria:**
- Each row on `/products` has a checkbox.
- Selecting ≥1 shows a sticky bottom bar: "N selected — Create B2B catalogue from selected / Clear".
- Clicking the button opens a modal: organization dropdown (all `organizations` rows), name input, discount % input.
- Submitting POSTs `/api/catalogues` and redirects to `/catalogues/[id]`.

- [ ] **Step 0: Ensure `/api/organizations` exists (add if missing)**

Check if `src/app/api/organizations/route.ts` exists. If not, create it:

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

- [ ] **Step 1: Write `ProductsSelectionBar.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CreateCatalogueDialog } from '@/components/catalogues/CreateCatalogueDialog'

type Props = {
  selectedIds: string[]
  onClear: () => void
}

export function ProductsSelectionBar({ selectedIds, onClear }: Props) {
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

- [ ] **Step 2: Write `CreateCatalogueDialog.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Org = { id: string; name: string }
type Props = { productIds: string[]; onClose: () => void }

export function CreateCatalogueDialog({ productIds, onClose }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>('')
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
        product_ids: productIds,
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
          {productIds.length} product{productIds.length === 1 ? '' : 's'} will be added.
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
            {busy ? 'Creating...' : 'Create catalogue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

(If `/api/organizations` does not already exist, add a trivial `src/app/api/organizations/route.ts` that `select *` from `organizations` behind the same auth helper.)

- [ ] **Step 3: Modify `/products` page to hoist selection state**

Open [src/app/(portal)/products/page.tsx](src/app/(portal)/products/page.tsx). Since that page is a server component, extract its list body into a new client component `src/components/products/ProductsList.tsx` that owns `selectedIds` and renders the row checkboxes + `<ProductsSelectionBar>`. Server component continues to own data fetching and passes rows down as props.

Row markup — add a checkbox as first cell:

```tsx
<td className="w-8 pl-2">
  <input
    type="checkbox"
    checked={selectedIds.includes(p.id)}
    onChange={() => toggle(p.id)}
  />
</td>
```

- [ ] **Step 4: Dev-server smoke**

Start dev server, visit `/products`, tick 2 rows, click "Create B2B catalogue from selected", select PRT org, name "Smoke test", submit. Expect redirect to `/catalogues/<id>`; items visible when that route lands (next task).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(catalogues): /products multi-select + create-catalogue dialog"
```

---

## Task 11: `/catalogues` list page

**Files:**
- Create: `src/app/(portal)/catalogues/page.tsx`
- Create: `src/components/catalogues/CataloguesTable.tsx`

**Acceptance criteria:**
- Server component lists all catalogues with filters (org, name search, active tri-state).
- 25/page pagination.
- Row link navigates to `/catalogues/[id]`.
- "New catalogue" button in header opens `CreateCatalogueDialog` with no pre-selection.

- [ ] **Step 1: Write the page**

```tsx
// src/app/(portal)/catalogues/page.tsx
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
      <div className="max-w-lg mx-auto py-16 text-center">
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
    .select('id, name, organization_id, discount_pct, is_active, created_at, organizations!inner(name), items:b2b_catalogue_items(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (sp.q) q = q.ilike('name', `%${sp.q}%`)
  if (sp.org) q = q.eq('organization_id', sp.org)
  if (sp.active === 'yes') q = q.eq('is_active', true)
  else if (sp.active === 'no') q = q.eq('is_active', false)

  const { data, count } = await q
  const rows = data ?? []

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Catalogues</h1>
        <Link href="/catalogues/new" className="rounded bg-black px-4 py-2 text-white">
          New catalogue
        </Link>
      </div>
      <CataloguesTable rows={rows as never[]} count={count ?? 0} page={page} limit={limit} />
    </div>
  )
}
```

- [ ] **Step 2: Write `CataloguesTable.tsx` (client — filters)**

```tsx
'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
// Client renders the <table> + filter inputs; pushes URL changes via router.
// Body keeps rows read-only — list view only.
// ... (standard Tailwind table markup, same pattern as ProductsList)
```

Keep the filter inputs controlled with URL `router.push` on change — match the sub-app #1 pattern.

- [ ] **Step 3: Dev-server smoke**

Visit `/catalogues` — the catalogue created in Task 10 should show; filter by PRT org; set active=no to hide; clear.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(catalogues): list page"
```

---

## Task 12: `/catalogues/[id]` tabbed editor (Items / Tiers / Assignment / Settings)

**Files:**
- Create: `src/app/(portal)/catalogues/[id]/page.tsx`
- Create: `src/components/catalogues/CatalogueItemsTable.tsx`
- Create: `src/components/catalogues/CatalogueItemPricingTiers.tsx`
- Create: `src/components/catalogues/AddCatalogueItemDialog.tsx`
- Create: `src/components/catalogues/CatalogueSettingsForm.tsx`

**Acceptance criteria:**
- Tabs switch without re-fetching items (client state).
- Items tab renders inherited-vs-override columns per spec §6.3; clearing an override reverts to inherited on next render.
- Tiers tab shows per-item tier groups with add/edit/delete inline and "Copy from master" button when item has a source product.
- Assignment tab is a read-only stub showing owning org + link.
- Settings tab saves via PATCH; Delete button confirms then cascades.

- [ ] **Step 1: Write the page shell**

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

  const [{ data: cat }, { data: items }, { data: org }] = await Promise.all([
    admin.from('b2b_catalogues').select('*').eq('id', id).single(),
    admin
      .from('b2b_catalogue_items')
      .select('*, source:products(id, name, sku, base_cost, markup_pct, image_url, decoration_price)')
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    admin.from('organizations').select('id, name').eq('id',
      (await admin.from('b2b_catalogues').select('organization_id').eq('id', id).single()).data?.organization_id ?? ''
    ).single(),
  ])
  if (!cat) notFound()
  return <CatalogueEditor catalogue={cat} items={items ?? []} organization={org} />
}
```

- [ ] **Step 2: Write `CatalogueEditor` (client, tabbed)**

```tsx
'use client'
import { useState } from 'react'
import { CatalogueItemsTable } from './CatalogueItemsTable'
import { CatalogueItemPricingTiers } from './CatalogueItemPricingTiers'
import { CatalogueSettingsForm } from './CatalogueSettingsForm'

export function CatalogueEditor({ catalogue, items: initialItems, organization }: {
  catalogue: any, items: any[], organization: any
}) {
  const [tab, setTab] = useState<'items' | 'tiers' | 'assignment' | 'settings'>('items')
  const [items, setItems] = useState(initialItems)
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{catalogue.name}</h1>
      <p className="text-sm text-gray-500">
        {organization?.name ?? 'Unknown org'} · Discount {catalogue.discount_pct}%
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
            <a className="text-blue-600 underline" href={`/b2b-accounts/${organization?.id}`}>
              Open b2b account
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

Render a `<table>` with the 9 columns from spec §6.3. For each row:
- Image cell reads `item.image_url_snapshot ?? item.source?.image_url`.
- Name cell: if `item.source_product_id` → read-only; else → inline `<input>` patches PATCH endpoint on blur.
- Base cost: read-only with greyed style; shows `item.base_cost_snapshot ?? item.source?.base_cost`.
- Markup %: `<input type=number>` showing `item.markup_pct_override ?? item.source?.markup_pct ?? ''`; onBlur, PATCH `{markup_pct_override: value || null}`. Empty string sends `null` (revert to inherit).
- Decoration type: `<select>` with options `['', 'Screen print', 'Heat press', 'Super colour', 'N/A']`; PATCH `{decoration_type_override: value || null}`.
- Decoration price, Shipping: identical pattern to Markup.
- Active: `<input type=checkbox>`; PATCH `{is_active: checked}`.
- Actions: "Remove" → `DELETE` with confirm.

Include a footer "Add item" button that opens `AddCatalogueItemDialog`.

- [ ] **Step 4: Write `AddCatalogueItemDialog.tsx`**

Two tabs inside the modal: "Pick from master" (search input, fetches `/api/products?search=...&limit=10`, POSTs `{source_product_id}`) and "Create B2B-only" (inputs: name, base_cost_snapshot, image_url).

- [ ] **Step 5: Write `CatalogueItemPricingTiers.tsx`**

For each item, render a collapsible card. When open: fetch tiers via `/api/catalogues/[id]/items/[itemId]/tiers`, render rows with inline edit, add-row form at bottom, and "Copy from master" button (POST `.../copy-tiers`).

- [ ] **Step 6: Write `CatalogueSettingsForm.tsx`**

Form with name, description, discount_pct, is_active. Save button PATCHes. Danger zone: "Delete catalogue" with two-step confirm.

- [ ] **Step 7: Dev-server smoke end-to-end**

From the catalogue created in Task 10:
- Items tab: edit markup → refresh → sees override; clear markup → refresh → back to inherited.
- Tiers tab: add 1 tier, edit, delete. "Copy from master" copies master `product_pricing_tiers` rows.
- Settings: toggle is_active, verify /catalogues list reflects.
- Delete: cascades; /catalogues list no longer shows it.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(catalogues): tabbed editor (items/tiers/assignment/settings)"
```

---

## Task 13: Sidebar nav entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Acceptance criteria:**
- Sidebar shows "Catalogues" link only to users with `catalogues` or `catalogues:write` permission, or role admin/super_admin.
- Link points to `/catalogues`.

- [ ] **Step 1: Add the nav section**

Follow the existing `NAV_SECTIONS` pattern (mirror the Products entry). Icon: `BookOpen` from `lucide-react`. Position: under Products.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(catalogues): add sidebar nav entry"
```

---

## Task 14: Customer portal `/shop` — catalogue-scope branch

**Files (in `print-room-portal` repo):**
- Create: `lib/shop/effective-price.ts`
- Modify: `app/(portal)/shop/page.tsx`

**Acceptance criteria:**
- Org with ≥1 active catalogue item → `/shop` renders exactly those master products (those with `source_product_id IS NOT NULL`); B2B-only items are hidden for now (deferred per spec §7.3).
- Org with zero active catalogue items → `/shop` renders today's global-channel list unchanged.
- All card prices use `effective_unit_price` RPC.

- [ ] **Step 1: Write `lib/shop/effective-price.ts`**

```ts
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
// 1. Check whether this org has any active catalogue items.
const { data: catItems } = await admin
  .from('b2b_catalogue_items')
  .select('source_product_id, b2b_catalogues!inner(is_active)')
  .eq('b2b_catalogues.organization_id', context.organizationId)
  .eq('b2b_catalogues.is_active', true)
  .eq('is_active', true)
  .not('source_product_id', 'is', null)

const hasCatalogueScope = (catItems?.length ?? 0) > 0
const scopedProductIds = hasCatalogueScope
  ? Array.from(new Set(catItems!.map((r) => r.source_product_id as string)))
  : []

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

In the per-product price loop, replace:

```ts
const { data: price } = await admin.rpc('get_unit_price', { ... })
```

with:

```ts
import { effectiveUnitPrice } from '@/lib/shop/effective-price'
// ...
const price = await effectiveUnitPrice(admin, p.id, context.organizationId, moqQty || 1)
```

- [ ] **Step 4: Dev-server smoke (customer portal)**

- Log in as a PRT user (org with no catalogue yet) → `/shop` should render identically to before.
- Seed one catalogue for PRT with 2 items via staff portal → refresh PRT `/shop` → see exactly those 2 products.
- Delete the catalogue → refresh → PRT back to global-channel list.

- [ ] **Step 5: Commit**

```bash
# in print-room-portal
git commit -m "feat(shop): catalogue-scope branch + effective_unit_price"
```

---

## Task 15: Seed PRT Demo Catalogue

**Acceptance criteria:**
- PRT (`ee155266-200c-4b73-8dbd-be385db3e5b0`) has one catalogue with 3 items from `platform='uniforms'` master products.
- Removable without schema changes.

- [ ] **Step 1: Pick 3 product ids with Jamie**

Run, then ask Jamie to pick 3 ids:

```sql
select id, name, sku from products
where platform = 'uniforms' and is_active
order by random() limit 10;
```

- [ ] **Step 2: Present seed SQL for approval**

```sql
with new_cat as (
  insert into b2b_catalogues (organization_id, name, description, discount_pct, created_by_user_id)
  values (
    'ee155266-200c-4b73-8dbd-be385db3e5b0',
    'PRT Demo Catalogue',
    'Initial seed for testing sub-app #3 flow end-to-end.',
    0,
    (select id from auth.users where email = 'hello@theprint-room.co.nz')
  )
  returning id
)
insert into b2b_catalogue_items (catalogue_id, source_product_id, sort_order)
select nc.id, x.pid, x.ord
from new_cat nc,
     (values
       ('<picked-product-1>'::uuid, 0),
       ('<picked-product-2>'::uuid, 1),
       ('<picked-product-3>'::uuid, 2)
     ) as x(pid, ord);
```

Post to chat with "🟡 Seed PRT Demo Catalogue? Reply 🟢."

- [ ] **Step 3: Apply on 🟢 via `mcp__supabase__execute_sql`**

- [ ] **Step 4: Verify**

Log in as PRT customer, hit `/shop`, confirm exactly 3 products render.

- [ ] **Step 5: Commit** (seed is not in code — commit the memory note instead)

Skip commit; record the seed in the session memory.

---

## Task 16: Verification checklist

**Acceptance:** Every bullet in spec §13 verified and checked off.

- [ ] Migration `006_b2b_catalogues` applied cleanly (Task 1 step 3 output saved in verification notes)
- [ ] `POST /api/catalogues` with and without `product_ids` (Task 5)
- [ ] `/products` multi-select → create catalogue → redirects to detail (Task 10)
- [ ] Items tab: clear override → reverts to inherited (Task 12)
- [ ] Pricing tiers "Copy from master" (Task 12)
- [ ] Customer `/shop` — 3 scenarios: no catalogue (fallback), catalogue with 3 items (scope), deleted catalogue (fallback restored) (Task 14/15)
- [ ] `effective_unit_price` matches `get_unit_price` when no catalogue, computes discount correctly when catalogue present (Task 2 + Task 15)
- [ ] RLS denial: run `set local role authenticated; set local request.jwt.claim.sub = '<user_from_other_org>'; select * from b2b_catalogues where organization_id = 'ee155266-...';` returns 0 rows
- [ ] Permission 403: staff user without `catalogues:write` → `POST /api/catalogues` returns 403
- [ ] Cascade delete: delete catalogue → items and tiers gone (`select count(*) from b2b_catalogue_items where catalogue_id = '<deleted>'` returns 0)

- [ ] **Step 1: Walk the list, tick each, note any failures**

- [ ] **Step 2: Commit verification note**

```bash
# Append a "## 2026-04-24 — sub-app #3 verified" section to docs/superpowers/notes/verification-log.md
git add docs/superpowers/notes/verification-log.md
git commit -m "docs(catalogues): verification log for sub-app #3"
```

---

## Post-plan handoff to Jamie

After Task 16:

1. **Sibling-spec follow-ups to queue** (per spec §12):
   - Category-driven markup rules
   - Visual override flags (green/red/orange)
   - Customer-portal Catalog sidebar rename + cart context isolation
   - B2B-only customer-side PDP + cart + checkout
   - Metafield vocabulary lock
2. **Memory updates**:
   - Update [project_b2b_plans_set.md](~/.claude/projects/c--Users-MSI-Documents-Projects/memory/project_b2b_plans_set.md) to note sub-app #3 has landed.
   - Drop a one-line addition to the B2B Spec Set memory pointing at the new spec + plan files.
3. **Shipping note draft** (matches Jamie's morning-shipping-note habit):
   - Outcome: customers can now see a custom product list per org.
   - Order: catalogue schema → staff /products → staff /catalogues → customer /shop.
   - Why: unblocks bespoke B2B customer launches without duplicating the `products` table per customer.
   - Ask Jon (as a question): "Want me to walk Chris through the PRT demo catalogue before we open it to a second customer?"
