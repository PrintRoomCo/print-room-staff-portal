# Inventory Sub-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-portal Inventory sub-app — per-customer, per-variant stock tracking with Shopify-style `committed_qty` reservation, Monday-webhook-driven decrement on dispatch, and a full audit log.

**Architecture:** Three new Postgres tables (`product_variants`, `variant_inventory`, `variant_inventory_events`) plus the `variant_availability` view. Writes go through five Postgres RPCs (`reserve_quote_line`, `release_quote_line`, `adjust_quote_line_delta`, `ship_quote_line`, `apply_staff_adjustment`) so concurrency is enforced by `for update` locks. Staff UI lives under `src/app/(portal)/inventory/` in the staff portal repo; the ship-event branch is wired into the existing Monday tracker-status webhook in the customer portal repo.

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase (Postgres + RLS + Auth), Tailwind v4, TypeScript, MCP `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql` for DB ops, cURL + SQL for verification (no JS test framework installed).

**Repos touched:**
- `print-room-staff-portal` — all UI + API + auth helpers
- `print-room-portal` — one file (the Monday webhook) gains a `ship_quote_line` RPC call

**Next.js 16 note (per both repos' AGENTS.md):** `params` in page and route handlers is a `Promise<...>` — always `await` it. Server files that read cookies use `await cookies()`. Re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `dynamic-routes.md` before writing any new route handler. Do not use Pages-Router idioms.

---

## Ambiguities resolved (from spec review — override these in review if wrong)

1. **`q.account_id` in spec §7.1 → `q.organization_id`.** Live schema: `quotes.organization_id` (uuid). No `account_id` column exists. All five RPCs read `quotes.organization_id`.
2. **`src/lib/auth/can.ts` does not exist in sub-app #1.** Instead, mirror [src/lib/products/server.ts:28-70](print-room-staff-portal/src/lib/products/server.ts#L28-L70) as `src/lib/inventory/server.ts::requireInventoryStaffAccess()`. Accept either `'inventory'` or `'inventory:write'` on `staff_users.permissions` for forward-compat. Admin/super_admin bypass.
3. **`StaffPermission`** (`src/types/staff.ts`) gains `'inventory'` and `'inventory:write'` literals.
4. **`quote_items.monday_subitem_id text` added in this plan's migration** (nullable) so `ship_quote_line` callers can resolve deterministically once Replit push starts populating it. Name-match fallback runs when the column is null.
5. **Cross-product integrity trigger added to `product_variants`** — rejects rows where `color_swatch_id.product_id != product_variants.product_id` or `size_id.product_id != product_variants.product_id`. Cheap, prevents silent data corruption.

---

## File structure

### New files (staff portal: `print-room-staff-portal`)

- `src/types/inventory.ts` — API DTOs + enum types
- `src/lib/inventory/server.ts` — `requireInventoryStaffAccess`, `withInventoryAuth` wrapper, admin client loader
- `src/lib/inventory/queries.ts` — PostgREST helpers (orgs-with-inventory, variants-for-org, events)
- `src/app/api/inventory/orgs/route.ts` — GET
- `src/app/api/inventory/[orgId]/products/route.ts` — GET, POST
- `src/app/api/inventory/[orgId]/variants/route.ts` — GET
- `src/app/api/inventory/[orgId]/variants/[variantId]/route.ts` — PATCH, DELETE
- `src/app/api/inventory/[orgId]/variants/[variantId]/adjust/route.ts` — POST
- `src/app/api/inventory/events/route.ts` — GET
- `src/app/api/products/[id]/variants/route.ts` — GET, POST
- `src/app/api/products/[id]/variants/bulk/route.ts` — POST
- `src/app/(portal)/inventory/page.tsx` — landing
- `src/app/(portal)/inventory/[orgId]/page.tsx` — tracked products
- `src/app/(portal)/inventory/[orgId]/[productId]/page.tsx` — variant grid
- `src/app/(portal)/inventory/events/page.tsx` — audit log
- `src/components/inventory/OrgCard.tsx`
- `src/components/inventory/TrackedProductsTable.tsx`
- `src/components/inventory/VariantGrid.tsx`
- `src/components/inventory/AdjustDrawer.tsx` (with `ReceiveForm`, `RecountForm`, `WriteOffForm` sub-components inline)
- `src/components/inventory/EventsTable.tsx`
- `src/components/inventory/TrackProductPicker.tsx`
- `src/components/inventory/TrackOrgPicker.tsx`

### Modified files (staff portal)

- `src/types/staff.ts` — add `'inventory'` and `'inventory:write'` literals to `StaffPermission`
- `src/components/layout/Sidebar.tsx` — add `NAV_SECTIONS` entry for Inventory (icon: `Boxes` from lucide-react), permission `'inventory'`

### Modified files (customer portal: `print-room-portal`)

- `app/api/webhooks/monday/tracker-status/route.ts` — in `handleTrackerStatusChange`, after the existing `canonicalKey === 'dispatched'` block at line 308, add a new subitem-branch call to `ship_quote_line` + orphan logging.
- `lib/inventory/ship-quote-line.ts` — new thin helper that wraps the RPC call and the `job_tracker_webhook_logs` orphan insert.

### Database migrations (via `mcp__supabase__apply_migration`)

- `20260420_inventory_tables.sql` — `product_variants`, `variant_inventory`, `variant_inventory_events`, indexes, `quote_items` column adds, `variant_availability` view.
- `20260420_inventory_variant_consistency_trigger.sql` — cross-product check.
- `20260420_inventory_rpcs.sql` — the five SQL functions.
- `20260420_inventory_rls.sql` — policies.

---

# Tasks

## Task 1: Create inventory schema (tables, indexes, view, column adds)

**Files:**
- Migration (via MCP): `20260420_inventory_tables`

**Acceptance criteria:**
- `product_variants`, `variant_inventory`, `variant_inventory_events` exist with the columns and constraints below.
- `quote_items` has new nullable `variant_id uuid` and `monday_subitem_id text`.
- `variant_availability` view returns `variant_id, organization_id, stock_qty, committed_qty, available_qty`.
- Listed indexes exist.

- [ ] **Step 1: Apply the migration**

Invoke `mcp__supabase__apply_migration` with `name = "20260420_inventory_tables"` and this SQL:

```sql
-- Per-(product, color, size) SKU join. Created on demand (see spec §6).
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  color_swatch_id uuid references product_color_swatches(id) on delete restrict,
  size_id integer references sizes(id) on delete restrict,
  sku_suffix text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_swatch_id, size_id)
);

-- Stock tracking, per variant, per customer. Row presence = "tracked for this org".
create table variant_inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  committed_qty integer not null default 0 check (committed_qty >= 0),
  reorder_point integer,
  updated_at timestamptz not null default now(),
  unique (variant_id, organization_id)
);

-- Append-only audit.
create table variant_inventory_events (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  organization_id uuid not null references organizations(id),
  delta_stock integer not null default 0,
  delta_committed integer not null default 0,
  reason text not null check (reason in (
    'intake','count_correction','damage_writeoff',
    'order_commit','order_release','order_ship'
  )),
  note text,
  reference_quote_item_id uuid references quote_items(id),
  staff_user_id uuid references staff_users(id),
  created_at timestamptz not null default now()
);

create view variant_availability as
  select variant_id, organization_id,
         stock_qty - committed_qty as available_qty,
         stock_qty, committed_qty
    from variant_inventory;

alter table quote_items
  add column variant_id uuid references product_variants(id),
  add column monday_subitem_id text;

create index variant_inventory_org_variant_idx
  on variant_inventory (organization_id, variant_id);
create index variant_inventory_events_org_created_idx
  on variant_inventory_events (organization_id, created_at desc);
create index product_variants_product_idx
  on product_variants (product_id);
create index quote_items_variant_idx
  on quote_items (variant_id) where variant_id is not null;
create index quote_items_subitem_idx
  on quote_items (monday_subitem_id) where monday_subitem_id is not null;
```

- [ ] **Step 2: Verify the migration applied**

Run via `mcp__supabase__execute_sql`:

```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('product_variants','variant_inventory','variant_inventory_events')
 order by table_name;

select column_name from information_schema.columns
 where table_schema='public' and table_name='quote_items'
   and column_name in ('variant_id','monday_subitem_id');

select count(*) from information_schema.views
 where table_schema='public' and table_name='variant_availability';
```

Expected:
- Three `table_name` rows: `product_variants`, `variant_inventory`, `variant_inventory_events`.
- Two `column_name` rows: `monday_subitem_id`, `variant_id`.
- View count = 1.

- [ ] **Step 3: Commit**

```bash
cd c:/Users/MSI/Documents/Projects/print-room-staff-portal
git add docs/superpowers/plans/
git commit -m "feat(inventory): schema for product_variants, variant_inventory, events + availability view"
```

(Migrations are persisted in Supabase. The plan document is what gets committed locally.)

---

## Task 2: Cross-product integrity trigger on `product_variants`

**Why:** `sizes` and `product_color_swatches` are scoped per-product. Without this trigger, a row could bind product A's variant to product B's color or size. Unique constraint won't catch it.

**Files:**
- Migration (via MCP): `20260420_inventory_variant_consistency_trigger`

**Acceptance criteria:**
- Inserting a `product_variants` row where `color_swatch_id` belongs to a different product → rejects with clear error.
- Same for `size_id`.
- NULL color or size (half-variant) passes.

- [ ] **Step 1: Apply the migration**

Invoke `mcp__supabase__apply_migration` with `name = "20260420_inventory_variant_consistency_trigger"` and:

```sql
create or replace function enforce_variant_product_consistency()
returns trigger language plpgsql as $$
declare
  v_swatch_product uuid;
  v_size_product uuid;
begin
  if new.color_swatch_id is not null then
    select product_id into v_swatch_product
      from product_color_swatches where id = new.color_swatch_id;
    if v_swatch_product is distinct from new.product_id then
      raise exception 'color_swatch_id % belongs to product %, not %',
        new.color_swatch_id, v_swatch_product, new.product_id;
    end if;
  end if;

  if new.size_id is not null then
    select product_id into v_size_product
      from sizes where id = new.size_id;
    if v_size_product is distinct from new.product_id then
      raise exception 'size_id % belongs to product %, not %',
        new.size_id, v_size_product, new.product_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger variant_product_consistency
  before insert or update on product_variants
  for each row execute function enforce_variant_product_consistency();
```

- [ ] **Step 2: Verify — negative case rejects**

Via `mcp__supabase__execute_sql`:

```sql
do $$
declare
  p1 uuid; p2 uuid;
  sw uuid;
begin
  select id into p1 from products order by created_at limit 1;
  select id into p2 from products where id <> p1 order by created_at limit 1;
  select id into sw from product_color_swatches where product_id = p2 limit 1;
  if sw is null then raise notice 'no swatch on p2 — skip'; return; end if;
  begin
    insert into product_variants (product_id, color_swatch_id)
      values (p1, sw);
    raise exception 'trigger FAILED to reject';
  exception when others then
    raise notice 'trigger correctly rejected: %', sqlerrm;
  end;
end $$;
```

Expected: NOTICE `trigger correctly rejected: color_swatch_id ... belongs to product ..., not ...`.

- [ ] **Step 3: Commit plan notes** (migrations live in Supabase).

---

## Task 3: `apply_staff_adjustment` RPC (intake, recount, damage_writeoff)

**Why first:** simplest of the five — no quote-item lookup, no reservation math. Lets subsequent RPCs share the same audit-insert pattern.

**Files:**
- Migration (appended to `20260420_inventory_rpcs` — build up incrementally).

**Acceptance criteria:**
- Given a `variant_inventory` row with `stock_qty = 0`: calling with `delta = +10, reason = 'intake'` → row now `stock_qty = 10`, event row inserted.
- `reason` outside the allowed set → raises.
- Resulting `stock_qty < 0` → raises (`check` constraint enforces).

- [ ] **Step 1: Apply the migration**

Invoke `mcp__supabase__apply_migration` with `name = "20260420_inventory_rpc_apply_staff_adjustment"`:

```sql
create or replace function apply_staff_adjustment(
  p_variant_id uuid,
  p_org_id uuid,
  p_delta integer,
  p_reason text,
  p_note text,
  p_staff_id uuid
) returns void language plpgsql as $$
declare
  v_inv variant_inventory%rowtype;
begin
  if p_reason not in ('intake','count_correction','damage_writeoff') then
    raise exception 'invalid staff reason: %', p_reason;
  end if;

  select * into v_inv
    from variant_inventory
   where variant_id = p_variant_id and organization_id = p_org_id
   for update;

  if not found then
    raise exception 'NOT_TRACKED' using errcode = 'P0002';
  end if;

  update variant_inventory
     set stock_qty = stock_qty + p_delta,
         updated_at = now()
   where id = v_inv.id;

  insert into variant_inventory_events (
    variant_id, organization_id, delta_stock,
    reason, note, staff_user_id
  ) values (
    p_variant_id, p_org_id, p_delta, p_reason, p_note, p_staff_id
  );
end;
$$;
```

- [ ] **Step 2: SQL smoke test**

```sql
begin;
  -- Seed: arbitrary product, variant, org.
  with p as (select id from products limit 1),
       o as (select id from organizations limit 1),
       v as (
         insert into product_variants (product_id)
         select id from p
         returning id, product_id
       ),
       inv as (
         insert into variant_inventory (variant_id, organization_id)
         select v.id, o.id from v, o
         returning id, variant_id, organization_id
       )
  select apply_staff_adjustment(
    (select variant_id from inv),
    (select organization_id from inv),
    10, 'intake', 'test crate', null);

  -- Expect stock_qty = 10.
  select stock_qty from variant_inventory
    where variant_id = (select id from product_variants order by created_at desc limit 1);
rollback;
```

Expected: single row `stock_qty = 10`. Rollback cleans up test rows.

- [ ] **Step 3: Commit**

---

## Task 4: `reserve_quote_line` RPC (with OUT_OF_STOCK + row lock)

**Acceptance criteria:**
- No `variant_inventory` row for (variant, org) → function returns cleanly (no-op, no event), because that variant isn't stock-tracked for that org.
- Sufficient available (`stock_qty - committed_qty >= quantity`) → `committed_qty` increments, event `order_commit` inserted.
- Insufficient available → raises `OUT_OF_STOCK` (SQLSTATE `P0001`), no row changes.
- Concurrent callers on the same row serialise via `for update`.

- [ ] **Step 1: Apply the migration**

`mcp__supabase__apply_migration` `name = "20260420_inventory_rpc_reserve_quote_line"`:

```sql
create or replace function reserve_quote_line(p_quote_item_id uuid)
returns void language plpgsql as $$
declare
  v_variant uuid;
  v_org uuid;
  v_qty integer;
  v_inv variant_inventory%rowtype;
begin
  select qi.variant_id, q.organization_id, qi.quantity
    into v_variant, v_org, v_qty
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where qi.id = p_quote_item_id;

  if v_variant is null then
    -- Legacy quote line without a variant — nothing to reserve.
    return;
  end if;

  select * into v_inv
    from variant_inventory
   where variant_id = v_variant and organization_id = v_org
   for update;

  if not found then
    return;
  end if;

  if v_inv.stock_qty - v_inv.committed_qty < v_qty then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  update variant_inventory
     set committed_qty = committed_qty + v_qty,
         updated_at = now()
   where id = v_inv.id;

  insert into variant_inventory_events (
    variant_id, organization_id, delta_committed,
    reason, reference_quote_item_id
  ) values (
    v_variant, v_org, v_qty, 'order_commit', p_quote_item_id
  );
end;
$$;
```

- [ ] **Step 2: SQL smoke tests**

```sql
begin;
  -- Seed minimal: one org, one product, one variant, inventory with stock=10.
  with p as (select id from products limit 1),
       o as (select id from organizations limit 1),
       v as (insert into product_variants (product_id) select id from p returning id, product_id),
       inv as (
         insert into variant_inventory (variant_id, organization_id, stock_qty)
         select v.id, o.id, 10 from v, o returning *
       ),
       q as (
         insert into quotes (organization_id, status, customer_email, line_items, subtotal, total_amount, platform, currency)
         select o.id, 'draft', 'test@example.com', '[]'::jsonb, 0, 0, 'b2b', 'NZD' from o
         returning id, organization_id
       ),
       qi as (
         insert into quote_items (quote_id, product_name, quantity, unit_price, total_price, variant_id)
         select q.id, 'test', 5, 0, 0, v.id from q, v returning id
       )
  select reserve_quote_line((select id from qi));

  select committed_qty from variant_inventory
    where variant_id = (select id from product_variants order by created_at desc limit 1);
  -- Expect 5.

  -- Try to over-commit: reserve another 10 on the same (only 5 available left).
  with o as (select id from organizations limit 1),
       v as (select id from product_variants order by created_at desc limit 1),
       q as (
         insert into quotes (organization_id, status, customer_email, line_items, subtotal, total_amount, platform, currency)
         select o.id, 'draft', 'test2@example.com', '[]'::jsonb, 0, 0, 'b2b', 'NZD' from o
         returning id
       ),
       qi2 as (
         insert into quote_items (quote_id, product_name, quantity, unit_price, total_price, variant_id)
         select q.id, 'test2', 10, 0, 0, v.id from q, v returning id
       )
  select reserve_quote_line((select id from qi2));
  -- Expect: raises OUT_OF_STOCK, transaction aborts.
rollback;
```

Expected: first `select committed_qty` returns `5`; second `reserve_quote_line` raises `OUT_OF_STOCK`. The whole transaction rolls back.

- [ ] **Step 3: Commit**

---

## Task 5: `release_quote_line` RPC

**Acceptance criteria:**
- For a quote_item whose line has an `order_commit` event, releases `committed_qty` back by `quote_items.quantity`, inserts event `order_release`.
- If no `variant_inventory` row exists (e.g. item wasn't tracked), returns cleanly.
- `p_reason` stored in `note` so staff can see `"cancelled"` vs `"edit-down"`.

- [ ] **Step 1: Apply**

`mcp__supabase__apply_migration` `name = "20260420_inventory_rpc_release_quote_line"`:

```sql
create or replace function release_quote_line(p_quote_item_id uuid, p_reason text)
returns void language plpgsql as $$
declare
  v_variant uuid;
  v_org uuid;
  v_qty integer;
  v_inv variant_inventory%rowtype;
begin
  select qi.variant_id, q.organization_id, qi.quantity
    into v_variant, v_org, v_qty
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where qi.id = p_quote_item_id;

  if v_variant is null then return; end if;

  select * into v_inv
    from variant_inventory
   where variant_id = v_variant and organization_id = v_org
   for update;
  if not found then return; end if;

  update variant_inventory
     set committed_qty = greatest(0, committed_qty - v_qty),
         updated_at = now()
   where id = v_inv.id;

  insert into variant_inventory_events (
    variant_id, organization_id, delta_committed,
    reason, note, reference_quote_item_id
  ) values (
    v_variant, v_org, -v_qty, 'order_release', p_reason, p_quote_item_id
  );
end;
$$;
```

- [ ] **Step 2: SQL smoke test** — reserve 5, release, assert `committed_qty = 0` and two events exist. Same `begin/rollback` pattern as Task 4.

- [ ] **Step 3: Commit**

---

## Task 6: `adjust_quote_line_delta` RPC

**Acceptance criteria:**
- `adjust(qi, 5, 7)` with 3 available → `committed_qty` += 2, event `order_commit` with `delta_committed = 2`.
- `adjust(qi, 7, 3)` → `committed_qty` -= 4, event `order_release` with `delta_committed = -4`.
- Increase that would exceed stock → `OUT_OF_STOCK`.
- `p_old_qty == p_new_qty` → no-op (no event, no mutation).

- [ ] **Step 1: Apply**

`mcp__supabase__apply_migration` `name = "20260420_inventory_rpc_adjust_quote_line_delta"`:

```sql
create or replace function adjust_quote_line_delta(
  p_quote_item_id uuid,
  p_old_qty integer,
  p_new_qty integer
) returns void language plpgsql as $$
declare
  v_variant uuid;
  v_org uuid;
  v_delta integer;
  v_inv variant_inventory%rowtype;
begin
  v_delta := p_new_qty - p_old_qty;
  if v_delta = 0 then return; end if;

  select qi.variant_id, q.organization_id
    into v_variant, v_org
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where qi.id = p_quote_item_id;

  if v_variant is null then return; end if;

  select * into v_inv
    from variant_inventory
   where variant_id = v_variant and organization_id = v_org
   for update;
  if not found then return; end if;

  if v_delta > 0 and v_inv.stock_qty - v_inv.committed_qty < v_delta then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  update variant_inventory
     set committed_qty = committed_qty + v_delta,
         updated_at = now()
   where id = v_inv.id;

  insert into variant_inventory_events (
    variant_id, organization_id, delta_committed,
    reason, reference_quote_item_id
  ) values (
    v_variant, v_org, v_delta,
    case when v_delta > 0 then 'order_commit' else 'order_release' end,
    p_quote_item_id
  );
end;
$$;
```

- [ ] **Step 2: SQL smoke test** — three assertions (up, down, out-of-stock) wrapped in `begin/rollback`.

- [ ] **Step 3: Commit**

---

## Task 7: `ship_quote_line` RPC (webhook-callable)

**Acceptance criteria:**
- Decrements both `stock_qty` and `committed_qty` by `quote_items.quantity`, inserts event `order_ship`.
- Idempotency: re-calling for the same `quote_item_id` after the first ship does NOT double-decrement. Guard by checking for an existing `order_ship` event on that `reference_quote_item_id`.
- If no `variant_inventory` row or `variant_id is null`, returns cleanly (orphan).

- [ ] **Step 1: Apply**

`mcp__supabase__apply_migration` `name = "20260420_inventory_rpc_ship_quote_line"`:

```sql
create or replace function ship_quote_line(p_quote_item_id uuid)
returns void language plpgsql as $$
declare
  v_variant uuid;
  v_org uuid;
  v_qty integer;
  v_inv variant_inventory%rowtype;
  v_already_shipped boolean;
begin
  select qi.variant_id, q.organization_id, qi.quantity
    into v_variant, v_org, v_qty
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where qi.id = p_quote_item_id;

  if v_variant is null then return; end if;

  select exists(
    select 1 from variant_inventory_events
     where reference_quote_item_id = p_quote_item_id
       and reason = 'order_ship'
  ) into v_already_shipped;

  if v_already_shipped then return; end if;

  select * into v_inv
    from variant_inventory
   where variant_id = v_variant and organization_id = v_org
   for update;
  if not found then return; end if;

  update variant_inventory
     set stock_qty = greatest(0, stock_qty - v_qty),
         committed_qty = greatest(0, committed_qty - v_qty),
         updated_at = now()
   where id = v_inv.id;

  insert into variant_inventory_events (
    variant_id, organization_id, delta_stock, delta_committed,
    reason, reference_quote_item_id
  ) values (
    v_variant, v_org, -v_qty, -v_qty, 'order_ship', p_quote_item_id
  );
end;
$$;
```

- [ ] **Step 2: SQL smoke test** — reserve 5, ship, assert `stock_qty = 5` (started 10), `committed_qty = 0`, event exists. Call again → no change, no second event.

- [ ] **Step 3: Commit**

---

## Task 8: RLS policies on new tables + view

**Acceptance criteria:**
- Staff with `inventory:write` or `'inventory'` or role admin/super_admin can `select` all three tables.
- Customer-portal user (member of `user_organizations` for org X) can `select` their own org's `variant_inventory` and `variant_availability` rows — nothing else. (Not `variant_inventory_events` — staff-only.)
- No one can `insert/update/delete` via PostgREST on `variant_inventory` or `variant_inventory_events`. Service role (used by our API routes and the RPCs) bypasses RLS.
- `product_variants` is readable by any authenticated user (catalog data).

- [ ] **Step 1: Apply**

`mcp__supabase__apply_migration` `name = "20260420_inventory_rls"`:

```sql
alter table product_variants enable row level security;
alter table variant_inventory enable row level security;
alter table variant_inventory_events enable row level security;

-- product_variants: readable by any authenticated user.
create policy product_variants_select_authenticated
  on product_variants for select to authenticated
  using (true);
-- No insert/update/delete policies — writes go through service role (API) or RPC.

-- Helper: does this auth user have the inventory permission?
create or replace function auth_has_inventory_access() returns boolean
language sql stable as $$
  select exists(
    select 1 from staff_users s
     where s.user_id = auth.uid()
       and s.is_active
       and (
         s.role in ('admin','super_admin')
         or s.permissions ? 'inventory'
         or s.permissions ? 'inventory:write'
       )
  );
$$;

create policy variant_inventory_select_staff
  on variant_inventory for select to authenticated
  using (auth_has_inventory_access());

create policy variant_inventory_select_own_org
  on variant_inventory for select to authenticated
  using (
    exists(
      select 1 from user_organizations uo
       where uo.user_id = auth.uid()
         and uo.organization_id = variant_inventory.organization_id
    )
  );

create policy variant_inventory_events_select_staff
  on variant_inventory_events for select to authenticated
  using (auth_has_inventory_access());
```

Note on the view: Postgres views defer RLS to their underlying tables, so `variant_availability` will inherit `variant_inventory`'s two select policies automatically. Verify in step 2.

- [ ] **Step 2: Verify — negative case**

```sql
-- Confirm: setting role to authenticated without inventory access blocks reads.
-- This is most reliable to verify end-to-end during the UI task (Task 20).
-- At minimum, confirm policies exist:
select polname, polrelid::regclass::text as tbl
  from pg_policy
 where polrelid in ('product_variants'::regclass,
                    'variant_inventory'::regclass,
                    'variant_inventory_events'::regclass)
 order by tbl, polname;
```

Expected: four policies present.

- [ ] **Step 3: Commit**

---

## Task 9: Add `'inventory'` + `'inventory:write'` to `StaffPermission`

**Files:**
- Modify: `print-room-staff-portal/src/types/staff.ts`

- [ ] **Step 1: Edit the type**

Change lines 3-11 of [src/types/staff.ts](print-room-staff-portal/src/types/staff.ts) to:

```ts
export type StaffPermission =
  | 'image-generator'
  | 'job-tracker'
  | 'reports'
  | 'chatbot-admin'
  | 'presentations'
  | 'settings'
  | 'quote-tool'
  | 'products'
  | 'inventory'
  | 'inventory:write'
```

- [ ] **Step 2: Type-check**

```bash
cd c:/Users/MSI/Documents/Projects/print-room-staff-portal
npx tsc --noEmit
```

Expected: no new errors. (If existing errors exist they are pre-existing — do not fix in this task.)

- [ ] **Step 3: Commit**

```bash
git add src/types/staff.ts
git commit -m "feat(inventory): add 'inventory' + 'inventory:write' to StaffPermission"
```

---

## Task 10: `requireInventoryStaffAccess` helper

**Files:**
- Create: `print-room-staff-portal/src/lib/inventory/server.ts`

**Acceptance criteria:**
- Returns `{ admin, context }` on authorised staff.
- Returns `{ error: NextResponse(401) }` if no auth user.
- Returns `{ error: NextResponse(403) }` if the staff row is missing, inactive, or lacks `'inventory'` / `'inventory:write'` / admin role.

- [ ] **Step 1: Write the helper**

Create [src/lib/inventory/server.ts](print-room-staff-portal/src/lib/inventory/server.ts) with:

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

export interface InventoryStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

export async function requireInventoryStaffAccess() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  const hasInventoryPerm =
    permissions.includes('inventory') || permissions.includes('inventory:write')

  if (!isAdmin && !hasInventoryPerm) {
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
    } satisfies InventoryStaffContext,
  }
}
```

- [ ] **Step 2: Manual smoke**

Start dev server (`npm run dev`), hit a route that will use it (Task 13 is first real consumer). Skip direct testing here — deferred to Task 13.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inventory/server.ts
git commit -m "feat(inventory): add requireInventoryStaffAccess auth helper"
```

---

## Task 11: Inventory types

**Files:**
- Create: `print-room-staff-portal/src/types/inventory.ts`

**Acceptance criteria:**
- Export `VariantInventoryRow`, `VariantEventRow`, `ProductVariantRow`, `InventoryEventReason`, `StaffAdjustmentReason`.

- [ ] **Step 1: Create the file**

```ts
export type InventoryEventReason =
  | 'intake'
  | 'count_correction'
  | 'damage_writeoff'
  | 'order_commit'
  | 'order_release'
  | 'order_ship'

export type StaffAdjustmentReason =
  | 'intake'
  | 'count_correction'
  | 'damage_writeoff'

export interface ProductVariantRow {
  id: string
  product_id: string
  color_swatch_id: string | null
  size_id: number | null
  sku_suffix: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VariantInventoryRow {
  id: string
  variant_id: string
  organization_id: string
  stock_qty: number
  committed_qty: number
  reorder_point: number | null
  updated_at: string
}

export interface VariantAvailabilityRow {
  variant_id: string
  organization_id: string
  stock_qty: number
  committed_qty: number
  available_qty: number
}

export interface VariantEventRow {
  id: string
  variant_id: string
  organization_id: string
  delta_stock: number
  delta_committed: number
  reason: InventoryEventReason
  note: string | null
  reference_quote_item_id: string | null
  staff_user_id: string | null
  created_at: string
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

---

## Task 12: Bulk variant expansion API — `POST /api/products/[id]/variants/bulk`

**What it does:** expands every `color_swatch × size` pair for a product into `product_variants` rows (idempotent). Called when staff click "Track stock for [org]" — the route body also takes an `organization_id` and creates zero-stock `variant_inventory` rows for that org.

**Files:**
- Create: `print-room-staff-portal/src/app/api/products/[id]/variants/bulk/route.ts`

**Acceptance criteria:**
- Body `{ organization_id: string }` required.
- Creates missing `product_variants` rows for every `(product, swatch, size)` combination — uses `on conflict do nothing`.
- Creates `variant_inventory` rows at `stock_qty = 0, committed_qty = 0` for the org — idempotent.
- If product has no swatches OR no sizes: returns 409 with a clear message (nothing to expand).
- 403 if caller lacks inventory permission.
- Returns `{ variantsCreated: number, inventoryRowsCreated: number }`.

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const { id: productId } = await params
  let body: { organization_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const orgId = body.organization_id
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const [{ data: swatches }, { data: sizes }] = await Promise.all([
    admin.from('product_color_swatches')
      .select('id').eq('product_id', productId).eq('is_active', true),
    admin.from('sizes').select('id').eq('product_id', productId),
  ])
  if (!swatches?.length || !sizes?.length) {
    return NextResponse.json(
      { error: 'Product has no active swatches or no sizes — cannot expand' },
      { status: 409 }
    )
  }

  const rows = swatches.flatMap((s) =>
    sizes.map((z) => ({
      product_id: productId,
      color_swatch_id: s.id,
      size_id: z.id,
    }))
  )
  const { data: variants, error: vErr } = await admin
    .from('product_variants')
    .upsert(rows, { onConflict: 'product_id,color_swatch_id,size_id', ignoreDuplicates: true })
    .select('id')
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // Fetch the full variant set (upsert with ignoreDuplicates returns only inserted rows).
  const { data: allVariants, error: listErr } = await admin
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const invRows = (allVariants ?? []).map((v) => ({
    variant_id: v.id,
    organization_id: orgId,
  }))
  const { data: inv, error: invErr } = await admin
    .from('variant_inventory')
    .upsert(invRows, { onConflict: 'variant_id,organization_id', ignoreDuplicates: true })
    .select('id')
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({
    variantsCreated: variants?.length ?? 0,
    inventoryRowsCreated: inv?.length ?? 0,
  })
}
```

- [ ] **Step 2: Manual cURL smoke**

```bash
# Replace <TOKEN> with a valid staff session cookie, <PROD> with a product UUID, <ORG> with an org UUID.
curl -X POST http://localhost:3000/api/products/<PROD>/variants/bulk \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=<TOKEN>" \
  -d '{"organization_id":"<ORG>"}'
```

Expected: `{"variantsCreated": N, "inventoryRowsCreated": N}`. Re-running returns `0, 0`.

- [ ] **Step 3: Commit**

---

## Task 13: Single variant create — `POST /api/products/[id]/variants`

**What it does:** create one `product_variants` row for a `(color_swatch_id, size_id)` pair if missing. Used by CSR/customer-portal quote lines (spec #4) — pre-requisite of this spec for parity.

**Also includes:** `GET` returning all variants for the product.

**Files:**
- Create: `print-room-staff-portal/src/app/api/products/[id]/variants/route.ts`

**Acceptance criteria:**
- `POST { color_swatch_id, size_id }` — upserts, returns `{ id }` of the variant (new or existing).
- `GET` returns array of `ProductVariantRow`.
- Cross-product combos (swatch or size from a different product) → 400 surfacing the trigger's error.
- 403 if no inventory perm.

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { id: productId } = await params
  const { data, error } = await auth.admin
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { id: productId } = await params
  let body: { color_swatch_id?: string | null; size_id?: number | null }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('product_variants')
    .upsert(
      {
        product_id: productId,
        color_swatch_id: body.color_swatch_id ?? null,
        size_id: body.size_id ?? null,
      },
      { onConflict: 'product_id,color_swatch_id,size_id' }
    )
    .select('id')
    .single()
  if (error) {
    const status = error.message?.includes('belongs to product') ? 400 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ id: data.id })
}
```

- [ ] **Step 2: cURL smoke**

```bash
curl -X POST http://localhost:3000/api/products/<PROD>/variants \
  -H "Content-Type: application/json" -H "Cookie: sb-access-token=<TOKEN>" \
  -d '{"color_swatch_id":"<SW>","size_id":<SIZE_ID>}'
# Expect {"id":"..."}

curl http://localhost:3000/api/products/<PROD>/variants \
  -H "Cookie: sb-access-token=<TOKEN>"
# Expect {"variants":[...]}
```

- [ ] **Step 3: Commit**

---

## Task 14: `GET /api/inventory/orgs`

**What it does:** returns orgs that have ≥1 `variant_inventory` row, with summary counts for the landing card.

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/orgs/route.ts`

**Acceptance criteria:**
- Returns `{ orgs: Array<{ id, name, variantCount, totalStock, totalCommitted, lastEventAt: string | null }> }`.
- Empty array when no org has inventory.
- 403 without perm.

- [ ] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET() {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin.rpc('inventory_orgs_summary')
  if (error) {
    // Fallback to manual aggregation if RPC not deployed.
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ orgs: data })
}
```

Add the summary RPC as a second migration in this task (faster than three PostgREST queries and aggregation in JS):

`mcp__supabase__apply_migration` `name = "20260420_inventory_orgs_summary"`:

```sql
create or replace function inventory_orgs_summary()
returns table (
  id uuid,
  name text,
  variant_count bigint,
  total_stock bigint,
  total_committed bigint,
  last_event_at timestamptz
) language sql stable as $$
  select o.id,
         o.name,
         count(vi.id) as variant_count,
         coalesce(sum(vi.stock_qty), 0) as total_stock,
         coalesce(sum(vi.committed_qty), 0) as total_committed,
         (select max(created_at) from variant_inventory_events e
           where e.organization_id = o.id) as last_event_at
    from organizations o
    join variant_inventory vi on vi.organization_id = o.id
   group by o.id, o.name
   order by o.name;
$$;
```

Update the route's response shape to match (snake_case to camelCase adapter):

```ts
const mapped = (data ?? []).map((r: any) => ({
  id: r.id,
  name: r.name,
  variantCount: Number(r.variant_count),
  totalStock: Number(r.total_stock),
  totalCommitted: Number(r.total_committed),
  lastEventAt: r.last_event_at,
}))
return NextResponse.json({ orgs: mapped })
```

- [ ] **Step 2: cURL smoke** — expect `{"orgs":[]}` before Task 1 happy-path seeds anything.

- [ ] **Step 3: Commit**

---

## Task 15: `GET /api/inventory/[orgId]/products` and `POST` (start tracking)

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/[orgId]/products/route.ts`

**Acceptance criteria:**
- `GET` returns `{ products: Array<{ id, name, image_url, variantCount, totalStock, totalCommitted }> }` — one row per tracked product for that org, aggregated across variants.
- `POST { product_id }` — shorthand that forwards to `/api/products/[id]/variants/bulk` with the `organization_id` from params. Returns same shape.

- [ ] **Step 1: Add the products-summary RPC**

`mcp__supabase__apply_migration` `name = "20260420_inventory_products_summary"`:

```sql
create or replace function inventory_products_summary(p_org_id uuid)
returns table (
  id uuid,
  name text,
  image_url text,
  variant_count bigint,
  total_stock bigint,
  total_committed bigint
) language sql stable as $$
  select p.id,
         p.name,
         p.image_url,
         count(vi.id) as variant_count,
         coalesce(sum(vi.stock_qty), 0) as total_stock,
         coalesce(sum(vi.committed_qty), 0) as total_committed
    from products p
    join product_variants pv on pv.product_id = p.id
    join variant_inventory vi on vi.variant_id = pv.id
   where vi.organization_id = p_org_id
   group by p.id, p.name, p.image_url
   order by p.name;
$$;
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  const { data, error } = await auth.admin.rpc('inventory_products_summary', { p_org_id: orgId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    products: (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      variantCount: Number(r.variant_count),
      totalStock: Number(r.total_stock),
      totalCommitted: Number(r.total_committed),
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  let body: { product_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 })
  }

  // Inline the bulk logic (same as Task 12, with orgId from params).
  const productId = body.product_id
  const [{ data: swatches }, { data: sizes }] = await Promise.all([
    auth.admin.from('product_color_swatches')
      .select('id').eq('product_id', productId).eq('is_active', true),
    auth.admin.from('sizes').select('id').eq('product_id', productId),
  ])
  if (!swatches?.length || !sizes?.length) {
    return NextResponse.json(
      { error: 'Product has no active swatches or no sizes' },
      { status: 409 }
    )
  }

  const variantRows = swatches.flatMap((s) =>
    sizes.map((z) => ({
      product_id: productId,
      color_swatch_id: s.id,
      size_id: z.id,
    }))
  )
  const upsertV = await auth.admin.from('product_variants')
    .upsert(variantRows, { onConflict: 'product_id,color_swatch_id,size_id', ignoreDuplicates: true })
  if (upsertV.error) return NextResponse.json({ error: upsertV.error.message }, { status: 500 })

  const { data: allVariants } = await auth.admin
    .from('product_variants').select('id').eq('product_id', productId)
  const invRows = (allVariants ?? []).map((v) => ({
    variant_id: v.id, organization_id: orgId,
  }))
  const upsertI = await auth.admin.from('variant_inventory')
    .upsert(invRows, { onConflict: 'variant_id,organization_id', ignoreDuplicates: true })
  if (upsertI.error) return NextResponse.json({ error: upsertI.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: cURL smoke** — GET before + after a POST; verify counts.

- [ ] **Step 4: Commit**

---

## Task 16: `GET /api/inventory/[orgId]/variants`

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/[orgId]/variants/route.ts`

**Acceptance criteria:**
- Query param `product_id` filters to one product; without it returns all variants for that org.
- Joins `product_variants`, `product_color_swatches` (label, hex), `sizes` (label, order_index), `variant_availability`.
- Returns `{ variants: Array<{ variant_id, color_label, color_hex, size_label, size_order, stock_qty, committed_qty, available_qty }> }`.

- [ ] **Step 1: Add joined-query RPC** (one round trip, easier than chained PostgREST)

`mcp__supabase__apply_migration` `name = "20260420_inventory_variants_for_org"`:

```sql
create or replace function inventory_variants_for_org(
  p_org_id uuid,
  p_product_id uuid default null
) returns table (
  variant_id uuid,
  product_id uuid,
  color_swatch_id uuid,
  color_label text,
  color_hex text,
  size_id integer,
  size_label text,
  size_order integer,
  stock_qty integer,
  committed_qty integer,
  available_qty integer
) language sql stable as $$
  select pv.id as variant_id,
         pv.product_id,
         pv.color_swatch_id,
         cs.label as color_label,
         cs.hex as color_hex,
         pv.size_id,
         s.label as size_label,
         s.order_index as size_order,
         vi.stock_qty,
         vi.committed_qty,
         (vi.stock_qty - vi.committed_qty) as available_qty
    from variant_inventory vi
    join product_variants pv on pv.id = vi.variant_id
    left join product_color_swatches cs on cs.id = pv.color_swatch_id
    left join sizes s on s.id = pv.size_id
   where vi.organization_id = p_org_id
     and (p_product_id is null or pv.product_id = p_product_id)
   order by cs.position, s.order_index;
$$;
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  const url = new URL(request.url)
  const productId = url.searchParams.get('product_id')
  const { data, error } = await auth.admin.rpc('inventory_variants_for_org', {
    p_org_id: orgId,
    p_product_id: productId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data ?? [] })
}
```

- [ ] **Step 3: cURL smoke**

- [ ] **Step 4: Commit**

---

## Task 17: Variant mutate routes — `PATCH` (recount) and `DELETE` (untrack)

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/[orgId]/variants/[variantId]/route.ts`

**Acceptance criteria:**
- `PATCH { absolute_stock_qty: number, note: string }` — computes delta against current `stock_qty`, calls `apply_staff_adjustment` with reason `'count_correction'`, `note` required (reject with 400 if missing).
- `DELETE` — removes the `variant_inventory` row. Rejects with 409 if `committed_qty > 0` (protect in-flight orders).
- 403 without perm.

- [ ] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params
  let body: { absolute_stock_qty?: number; note?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.absolute_stock_qty !== 'number' || !Number.isInteger(body.absolute_stock_qty) || body.absolute_stock_qty < 0) {
    return NextResponse.json({ error: 'absolute_stock_qty must be a non-negative integer' }, { status: 400 })
  }
  if (!body.note || !body.note.trim()) {
    return NextResponse.json({ error: 'note is required for recount' }, { status: 400 })
  }

  const { data: inv, error: fErr } = await auth.admin
    .from('variant_inventory').select('stock_qty')
    .eq('variant_id', variantId).eq('organization_id', orgId).maybeSingle()
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  if (!inv) return NextResponse.json({ error: 'Not tracked' }, { status: 404 })

  const delta = body.absolute_stock_qty - inv.stock_qty
  if (delta === 0) {
    return NextResponse.json({ ok: true, note: 'no change' })
  }

  const { error: rErr } = await auth.admin.rpc('apply_staff_adjustment', {
    p_variant_id: variantId,
    p_org_id: orgId,
    p_delta: delta,
    p_reason: 'count_correction',
    p_note: body.note,
    p_staff_id: auth.context.staffId,
  })
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, delta })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params

  const { data: inv } = await auth.admin
    .from('variant_inventory').select('id, committed_qty')
    .eq('variant_id', variantId).eq('organization_id', orgId).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Not tracked' }, { status: 404 })
  if ((inv.committed_qty ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot untrack — committed_qty > 0 (in-flight orders)' },
      { status: 409 }
    )
  }

  const { error } = await auth.admin
    .from('variant_inventory').delete().eq('id', inv.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: cURL smoke** — recount up, recount down, untrack (must be zero-committed).

- [ ] **Step 3: Commit**

---

## Task 18: `POST /api/inventory/[orgId]/variants/[variantId]/adjust`

**What it does:** intake (+) or damage_writeoff (−) — not recount (that's Task 17).

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/[orgId]/variants/[variantId]/adjust/route.ts`

**Acceptance criteria:**
- Body: `{ delta: number (nonzero int), reason: 'intake' | 'damage_writeoff', note?: string }`.
- Damage writeoff: accepts positive `delta` and writes negative internally? **No** — caller passes already-signed integer; server validates that `intake > 0` and `damage_writeoff < 0`. Keeps semantics obvious.
- 400 on sign mismatch.
- Calls `apply_staff_adjustment`.

- [ ] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params
  let body: { delta?: number; reason?: string; note?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.delta !== 'number' || !Number.isInteger(body.delta) || body.delta === 0) {
    return NextResponse.json({ error: 'delta must be a nonzero integer' }, { status: 400 })
  }
  if (body.reason === 'intake' && body.delta <= 0) {
    return NextResponse.json({ error: 'intake delta must be positive' }, { status: 400 })
  }
  if (body.reason === 'damage_writeoff' && body.delta >= 0) {
    return NextResponse.json({ error: 'damage_writeoff delta must be negative' }, { status: 400 })
  }
  if (body.reason !== 'intake' && body.reason !== 'damage_writeoff') {
    return NextResponse.json({ error: 'reason must be intake or damage_writeoff' }, { status: 400 })
  }

  const { error } = await auth.admin.rpc('apply_staff_adjustment', {
    p_variant_id: variantId,
    p_org_id: orgId,
    p_delta: body.delta,
    p_reason: body.reason,
    p_note: body.note ?? null,
    p_staff_id: auth.context.staffId,
  })
  if (error) {
    const status = error.message?.includes('NOT_TRACKED') ? 404
      : error.message?.includes('stock_qty') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: cURL smoke**

- [ ] **Step 3: Commit**

---

## Task 19: `GET /api/inventory/events`

**Files:**
- Create: `print-room-staff-portal/src/app/api/inventory/events/route.ts`

**Acceptance criteria:**
- Query params: `org_id`, `product_id`, `variant_id`, `reason`, `staff_user_id`, `from` (ISO), `to` (ISO), `limit` (default 50, max 200), `offset` (default 0).
- Response: `{ events: Array<VariantEventRow + { product_name, variant_label, staff_display_name }>, total: number }`.

- [ ] **Step 1: Add a paginated RPC**

`mcp__supabase__apply_migration` `name = "20260420_inventory_events_search"`:

```sql
create or replace function inventory_events_search(
  p_org_id uuid default null,
  p_product_id uuid default null,
  p_variant_id uuid default null,
  p_reason text default null,
  p_staff_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid,
  created_at timestamptz,
  organization_id uuid,
  organization_name text,
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_label text,
  size_label text,
  delta_stock integer,
  delta_committed integer,
  reason text,
  note text,
  reference_quote_item_id uuid,
  staff_user_id uuid,
  staff_display_name text,
  total_count bigint
) language sql stable as $$
  with base as (
    select e.*, pv.product_id,
           count(*) over () as total_count
      from variant_inventory_events e
      join product_variants pv on pv.id = e.variant_id
     where (p_org_id is null or e.organization_id = p_org_id)
       and (p_product_id is null or pv.product_id = p_product_id)
       and (p_variant_id is null or e.variant_id = p_variant_id)
       and (p_reason is null or e.reason = p_reason)
       and (p_staff_user_id is null or e.staff_user_id = p_staff_user_id)
       and (p_from is null or e.created_at >= p_from)
       and (p_to is null or e.created_at <= p_to)
     order by e.created_at desc
     limit p_limit offset p_offset
  )
  select b.id, b.created_at, b.organization_id, o.name as organization_name,
         b.variant_id, b.product_id, p.name as product_name,
         cs.label as color_label, s.label as size_label,
         b.delta_stock, b.delta_committed, b.reason, b.note,
         b.reference_quote_item_id, b.staff_user_id,
         su.display_name as staff_display_name,
         b.total_count
    from base b
    join organizations o on o.id = b.organization_id
    join product_variants pv on pv.id = b.variant_id
    join products p on p.id = pv.product_id
    left join product_color_swatches cs on cs.id = pv.color_swatch_id
    left join sizes s on s.id = pv.size_id
    left join staff_users su on su.id = b.staff_user_id;
$$;
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(request: Request) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 50)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))
  const { data, error } = await auth.admin.rpc('inventory_events_search', {
    p_org_id: p.get('org_id') || null,
    p_product_id: p.get('product_id') || null,
    p_variant_id: p.get('variant_id') || null,
    p_reason: p.get('reason') || null,
    p_staff_user_id: p.get('staff_user_id') || null,
    p_from: p.get('from') || null,
    p_to: p.get('to') || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const total = Number(data?.[0]?.total_count ?? 0)
  return NextResponse.json({ events: data ?? [], total, limit, offset })
}
```

- [ ] **Step 3: cURL smoke**

- [ ] **Step 4: Commit**

---

## Task 20: UI — landing page `/inventory`

**Files:**
- Create: `print-room-staff-portal/src/app/(portal)/inventory/page.tsx`
- Create: `print-room-staff-portal/src/components/inventory/OrgCard.tsx`
- Create: `print-room-staff-portal/src/components/inventory/TrackOrgPicker.tsx`

**Acceptance criteria:**
- Server component fetches `/api/inventory/orgs` (directly via `requireInventoryStaffAccess` + RPC, not HTTP fetch from own host).
- Renders one `OrgCard` per org + a "+ Track new customer" button that opens the picker.
- Picker is a client component: typeahead against `/api/organizations?q=...` (use existing endpoint if present; else add a minimal one) — on select, router-pushes to `/inventory/[orgId]`.

- [ ] **Step 1: Check for existing org search endpoint**

```bash
grep -rn "from('organizations'" c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/app/api/ | head -5
```

If no existing endpoint, add `src/app/api/organizations/search/route.ts` in a small extra step within this task — GET `?q=<prefix>` returns `{ orgs: [{id,name}] }` limited to 20. Guard with `requireInventoryStaffAccess` for now.

- [ ] **Step 2: Write `page.tsx`** (server component with async params note)

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { OrgCard } from '@/components/inventory/OrgCard'
import { TrackOrgPicker } from '@/components/inventory/TrackOrgPicker'

export const dynamic = 'force-dynamic'

export default async function InventoryLandingPage() {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) {
    redirect('/dashboard')
  }
  const { data } = await auth.admin.rpc('inventory_orgs_summary')
  const orgs = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name,
    variantCount: Number(r.variant_count),
    totalStock: Number(r.total_stock),
    totalCommitted: Number(r.total_committed),
    lastEventAt: r.last_event_at,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <TrackOrgPicker />
      </div>

      {orgs.length === 0 ? (
        <div className="text-gray-500">No customers have tracked stock yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((o) => (
            <Link key={o.id} href={`/inventory/${o.id}`}>
              <OrgCard org={o} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `OrgCard.tsx`** — use `<Card>` from `@/components/ui/card`, show name / variantCount / totalStock / totalCommitted / lastEventAt (formatted via `Intl.DateTimeFormat`).

```tsx
import { Card } from '@/components/ui/card'

interface OrgSummary {
  id: string
  name: string
  variantCount: number
  totalStock: number
  totalCommitted: number
  lastEventAt: string | null
}

export function OrgCard({ org }: { org: OrgSummary }) {
  return (
    <Card className="p-4 hover:shadow-md transition">
      <div className="font-medium">{org.name}</div>
      <div className="text-xs text-gray-500 mt-1">
        {org.variantCount} variants · {org.totalStock} on hand · {org.totalCommitted} committed
      </div>
      {org.lastEventAt && (
        <div className="text-xs text-gray-400 mt-1">
          Last: {new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(org.lastEventAt))}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 4: Write `TrackOrgPicker.tsx`** — `'use client'`, debounced typeahead hitting `/api/organizations/search?q=`, on select `router.push('/inventory/' + id)`.

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Org { id: string; name: string }

export function TrackOrgPicker() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Org[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!open || q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/organizations/search?q=${encodeURIComponent(q)}`)
      if (r.ok) setResults((await r.json()).orgs ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Track new customer</Button>
  }
  return (
    <div className="flex flex-col gap-2">
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations…" />
      <div className="border rounded bg-white max-h-64 overflow-auto">
        {results.map((o) => (
          <button key={o.id} onClick={() => router.push(`/inventory/${o.id}`)}
            className="block w-full text-left px-3 py-2 hover:bg-gray-50">
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

```
npm run dev
# Visit http://localhost:3000/inventory as an admin user.
# Expect: empty state OR cards for orgs seeded in Task 1 verification.
# Click "+ Track new customer", type at least 2 chars, select an org.
# Expect: navigates to /inventory/<orgId>.
```

- [ ] **Step 6: Commit**

---

## Task 21: UI — org tracked-products page `/inventory/[orgId]`

**Files:**
- Create: `print-room-staff-portal/src/app/(portal)/inventory/[orgId]/page.tsx`
- Create: `print-room-staff-portal/src/components/inventory/TrackedProductsTable.tsx`
- Create: `print-room-staff-portal/src/components/inventory/TrackProductPicker.tsx`

**Acceptance criteria:**
- Shows org name + list of tracked products with thumbnail, name, variant count, totals.
- "+ Track new product" — product picker (typeahead against `products` where `is_active = true`), on select calls `POST /api/inventory/[orgId]/products { product_id }`, then refresh.
- Each product row links to `/inventory/[orgId]/[productId]`.
- 403 redirects to `/dashboard` server-side.

- [ ] **Step 1: Add products search endpoint** if not present.

Check:
```bash
ls c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/app/api/products/search 2>&1
```

If missing, add `src/app/api/products/search/route.ts` — GET `?q=` returns `{ products: [{id,name,image_url}] }` where `is_active = true` limited to 20, guarded by `requireInventoryStaffAccess` (or the products auth — `requireProductsStaffAccess` if available; pick whichever the Products sub-app exposes).

- [ ] **Step 2: Write `page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { TrackedProductsTable } from '@/components/inventory/TrackedProductsTable'
import { TrackProductPicker } from '@/components/inventory/TrackProductPicker'

export const dynamic = 'force-dynamic'

export default async function OrgInventoryPage(
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) redirect('/dashboard')

  const { data: org } = await auth.admin
    .from('organizations').select('id, name').eq('id', orgId).single()
  if (!org) redirect('/inventory')

  const { data } = await auth.admin.rpc('inventory_products_summary', { p_org_id: orgId })
  const products = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, image_url: r.image_url,
    variantCount: Number(r.variant_count),
    totalStock: Number(r.total_stock),
    totalCommitted: Number(r.total_committed),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Inventory</div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
        </div>
        <TrackProductPicker orgId={orgId} />
      </div>
      <TrackedProductsTable orgId={orgId} products={products} />
    </div>
  )
}
```

- [ ] **Step 3: Write `TrackedProductsTable.tsx`** — simple table/grid of rows, each `<Link href="/inventory/{orgId}/{product.id}">`.

- [ ] **Step 4: Write `TrackProductPicker.tsx`** — mirror `TrackOrgPicker` pattern, but hit `/api/products/search?q=` and on select `POST /api/inventory/[orgId]/products { product_id }`, then `router.refresh()`.

- [ ] **Step 5: Manual verification** — pick a product with swatches+sizes, expect bulk-expansion succeeds and a row appears.

- [ ] **Step 6: Commit**

---

## Task 22: UI — variant grid + adjust drawer

**Files:**
- Create: `print-room-staff-portal/src/app/(portal)/inventory/[orgId]/[productId]/page.tsx`
- Create: `print-room-staff-portal/src/components/inventory/VariantGrid.tsx`
- Create: `print-room-staff-portal/src/components/inventory/AdjustDrawer.tsx`

**Acceptance criteria:**
- Variant grid: color-swatch rows × size columns, each cell shows `available / on-hand` (large) and `committed` (small) — red if available = 0, amber if < reorder_point.
- Click cell opens drawer with three forms:
  - Receive: qty (positive int), optional note → `POST /adjust` with `reason='intake'`.
  - Recount: absolute qty (non-negative int), required note → `PATCH`.
  - Write off: qty (positive int entered; server sends negative), required note → `POST /adjust` with `reason='damage_writeoff'` and negated delta.
- Last 10 events for this variant listed below forms, with "View all in log" link to `/inventory/events?variant_id=...`.
- Untrack button (red, confirm dialog) → `DELETE`; disabled when `committed_qty > 0`.

- [ ] **Step 1: Write `page.tsx`** — fetch variants (RPC), product name, org name; render `<VariantGrid>`.

- [ ] **Step 2: Write `VariantGrid.tsx`** — group by `color_swatch_id`, one row per swatch, columns ordered by `size_order`. Cells are buttons opening the drawer.

- [ ] **Step 3: Write `AdjustDrawer.tsx`** — use a slide-over panel pattern with three tabs/stacked forms. Each form disables submit until valid. Optimistic UI — call `router.refresh()` after success to re-fetch the grid and events.

- [ ] **Step 4: Manual verification** — run the full happy path of spec §13 steps 1-4 and 8 through the UI:
  1. Fresh tracked product — grid shows all cells at `0/0`.
  2. Receive 20 on Black/M → cell shows `20/20`, drawer events list shows `intake +20`.
  3. (Skip reservation steps — those require CSR tool which is spec #2.)
  4. Recount to 22 → cell shows `22/22`, event `count_correction +2`.
  5. Write-off 3 on same cell → cell shows `19/19`, event `damage_writeoff -3`.
  6. Untrack Black/XS → row updates.

- [ ] **Step 5: Commit**

---

## Task 23: UI — global events log `/inventory/events`

**Files:**
- Create: `print-room-staff-portal/src/app/(portal)/inventory/events/page.tsx`
- Create: `print-room-staff-portal/src/components/inventory/EventsTable.tsx`

**Acceptance criteria:**
- Client page (filters round-trip via URL query params).
- Filters: org, reason, date range, variant (free text not needed — use quote_item link), staff user.
- Paginated with `limit`/`offset`, "next/prev" page controls.
- Columns: time · org · product / variant · reason · Δstock · Δcommitted · note · staff · quote link.

- [ ] **Step 1: Write the page** — server reads search params, calls `inventory_events_search`, renders `<EventsTable>` + a filter form (client component for interactive filter inputs, server fetch on submit via URL update).

- [ ] **Step 2: Write `EventsTable.tsx`** — pure presentational; accepts `events` prop.

- [ ] **Step 3: Manual verification** — filters round-trip; deep-link with `?org_id=...&reason=intake` works.

- [ ] **Step 4: Commit**

---

## Task 24: Sidebar entry for Inventory

**Files:**
- Modify: `print-room-staff-portal/src/components/layout/Sidebar.tsx`

**Acceptance criteria:**
- New section between Products and Job Tracker, `permission: 'inventory'`, icon `Boxes` from `lucide-react`.
- Items: Overview → `/inventory`, Audit Log → `/inventory/events`.
- Hidden for users without the permission.

- [ ] **Step 1: Edit the imports**

At line 33 of [Sidebar.tsx](print-room-staff-portal/src/components/layout/Sidebar.tsx), change the lucide import to include `Boxes`:

```tsx
  Package,
  Boxes,
} from 'lucide-react'
```

- [ ] **Step 2: Insert the NAV_SECTIONS entry**

Between the `products` and `job-tracker` entries (after line 95 of the current file), insert:

```tsx
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    permission: 'inventory',
    items: [
      { label: 'Overview', href: '/inventory', icon: Boxes },
      { label: 'Audit Log', href: '/inventory/events', icon: List },
    ],
  },
```

- [ ] **Step 3: Update the `NavSection.id` union type (line 42)**

```tsx
  id: StaffPermission | 'dashboard' | 'settings' | 'quote-tool'
```

Because `StaffPermission` now includes `'inventory'` and `'inventory:write'`, the union already covers it — confirm no type error.

- [ ] **Step 4: Visual verification** — log in as an admin, see "Inventory" in sidebar. Log in as a user without the permission, don't see it.

- [ ] **Step 5: Commit**

---

## Task 25: Customer-portal webhook — wire `ship_quote_line` into dispatched branch

**Repo:** `print-room-portal` (customer portal) — separate from all other tasks.

**Files:**
- Create: `print-room-portal/lib/inventory/ship-quote-line.ts`
- Modify: `print-room-portal/app/api/webhooks/monday/tracker-status/route.ts` — extend `handleTrackerStatusChange` after line 308 and handle the subitem branch.

**Acceptance criteria:**
- When the webhook receives a SUBITEM event (`event.parentItemId` is set) whose canonical key is `'dispatched'`:
  1. Resolve `quote_item_id`:
     - Primary: `select id from quote_items where monday_subitem_id = event.pulseId`.
     - Fallback: `select id from quote_items qi join quotes q on q.id=qi.quote_id where qi.product_name || ... = event.pulseName` (name-match — best effort).
  2. Call `ship_quote_line(quote_item_id)`.
  3. On no match, insert `job_tracker_webhook_logs` row with `status = 'orphan_ship_event'` and `payload = event`.
- Non-subitem events keep working exactly as before (this branch short-circuits).
- Non-`dispatched` subitem events fall through to existing behaviour.

Important: the existing handler at [route.ts:84-103](print-room-portal/app/api/webhooks/monday/tracker-status/route.ts#L84-L103) routes tracker-status through `handleTrackerStatusChange`. The current flow does NOT distinguish main-item vs subitem on the production board. The extension happens inside `handleTrackerStatusChange` — before the tracker lookup if no tracker match + event has `parentItemId`, try the inventory path.

- [ ] **Step 1: Create the helper**

```ts
// print-room-portal/lib/inventory/ship-quote-line.ts
import { getSupabaseServer } from '@/lib/supabase'

export async function shipMondaySubitem(
  supabase: ReturnType<typeof getSupabaseServer>,
  subitemId: string,
  subitemName: string | null,
  payload: unknown
): Promise<{ ok: true; matched: 'subitem_id' | 'name' } | { ok: false; reason: 'orphan' }> {
  // Primary match.
  const { data: bySubitem } = await supabase
    .from('quote_items').select('id').eq('monday_subitem_id', subitemId).maybeSingle()
  let quoteItemId = bySubitem?.id ?? null
  let matched: 'subitem_id' | 'name' | null = bySubitem ? 'subitem_id' : null

  // Name-match fallback (temporary until Replit push writes monday_subitem_id).
  if (!quoteItemId && subitemName) {
    const { data: byName } = await supabase
      .from('quote_items').select('id').ilike('product_name', `%${subitemName}%`).limit(1).maybeSingle()
    if (byName) { quoteItemId = byName.id; matched = 'name' }
  }

  if (!quoteItemId) {
    await supabase.from('job_tracker_webhook_logs').insert({
      monday_item_id: subitemId,
      status: 'orphan_ship_event',
      payload,
      notes: `Could not resolve subitem "${subitemName ?? ''}"`,
    })
    return { ok: false, reason: 'orphan' }
  }

  const { error } = await supabase.rpc('ship_quote_line', { p_quote_item_id: quoteItemId })
  if (error) {
    await supabase.from('job_tracker_webhook_logs').insert({
      monday_item_id: subitemId,
      status: 'ship_rpc_error',
      payload,
      error: error.message,
    })
    return { ok: false, reason: 'orphan' }
  }
  return { ok: true, matched: matched! }
}
```

- [ ] **Step 2: Extend the webhook handler**

In [print-room-portal/app/api/webhooks/monday/tracker-status/route.ts](print-room-portal/app/api/webhooks/monday/tracker-status/route.ts), inside `handleTrackerStatusChange` (currently starting at line 238), after computing `canonicalKey` but before `findTrackerByEvent`, add:

```ts
  // Inventory decrement: subitem dispatched event.
  if (event.parentItemId && canonicalKey === 'dispatched') {
    const { shipMondaySubitem } = await import('@/lib/inventory/ship-quote-line')
    await shipMondaySubitem(supabase, String(event.pulseId), event.pulseName, payload)
    // Do not return — continue to the existing tracker-status path so other
    // side-effects (emails, status_history, etc.) still run.
  }
```

Place this between line 250 (`if (!canonicalKey) return`) and line 252 (`const tracker = await findTrackerByEvent(...)`).

- [ ] **Step 3: Manual verification** — fire a mock webhook

```bash
# Seed: via Task 4's SQL, create a quote_items row with monday_subitem_id = '99999999'
#        and variant_id bound to an inventory row with stock=20, committed=5.
# Run the app locally (cd print-room-portal && npm run dev).
curl -X POST http://localhost:3001/api/webhooks/monday/tracker-status \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"update_column_value","boardId":5025641709,"pulseId":99999999,"pulseName":"Test subitem","parentItemId":111,"columnId":"status","columnType":"color","columnTitle":"Status","value":{"label":{"index":0,"text":"Shipped"}}}}'

# Expect response 200 "Tracker not linked" (or similar — tracker path continues).
# Then verify inventory moved:
```

Via `mcp__supabase__execute_sql`:

```sql
select stock_qty, committed_qty from variant_inventory where variant_id = '<test-variant>';
-- Expect stock=15 (20-5), committed=0 (5-5).
select reason, delta_stock, delta_committed from variant_inventory_events
  where reference_quote_item_id = '<test-quote-item>' order by created_at desc;
-- Expect a row with reason='order_ship', delta_stock=-5, delta_committed=-5.
```

- [ ] **Step 4: Commit in the customer-portal repo**

```bash
cd c:/Users/MSI/Documents/Projects/print-room-portal
git add lib/inventory/ship-quote-line.ts app/api/webhooks/monday/tracker-status/route.ts
git commit -m "feat(inventory): call ship_quote_line on dispatched Monday subitem webhook"
```

---

## Task 26: End-to-end verification (spec §13)

**Goal:** Execute the full §13 happy path against the live dev environment and confirm every assertion passes.

This is a manual run-through. Check each step off as it passes.

- [ ] **Step 1: Seed**

```sql
-- Pick or insert an org "Reburger" and a product with 3 swatches × 4 sizes.
-- Use the existing "+ Track new customer" → "+ Track new product" UI flow (Tasks 20-21).
-- Assert 12 product_variants rows and 12 variant_inventory rows at stock_qty=0.
select count(*) from product_variants where product_id = '<PROD>';
-- expect 12
select count(*) from variant_inventory vi
  join product_variants pv on pv.id = vi.variant_id
 where pv.product_id = '<PROD>' and vi.organization_id = '<REBURGER>';
-- expect 12
```

- [ ] **Step 2: Intake +20 on Black/M** via UI drawer. Assert row `stock_qty = 20`, event `intake delta_stock=20`.

- [ ] **Step 3: Reservation** (requires CSR tool from spec #2 — **not in this plan's scope**). For this plan, execute via direct SQL:

```sql
-- Create a quote + quote_item manually.
insert into quotes (organization_id, status, customer_email, line_items, subtotal, total_amount, platform, currency)
  values ('<REBURGER>', 'draft', 'rebel@reburger.nz', '[]', 0, 0, 'b2b', 'NZD') returning id;
insert into quote_items (quote_id, product_name, quantity, unit_price, total_price, variant_id)
  values ('<QUOTE>', 'Test', 5, 0, 0, '<BLACK_M_VARIANT>') returning id;
select reserve_quote_line('<QI>');
-- Assert committed_qty=5 on the row.
```

- [ ] **Step 4: Edit 5 → 7** via `select adjust_quote_line_delta('<QI>', 5, 7);` — assert `committed_qty = 7`.

- [ ] **Step 5: Over-commit rejected**

```sql
-- Try to reserve 20 more on same variant (only 20-7=13 available).
insert into quotes (...) returning id;
insert into quote_items (..., quantity, variant_id) values (..., 20, '<BLACK_M_VARIANT>') returning id;
select reserve_quote_line('<QI2>'); -- expect raise OUT_OF_STOCK
```

- [ ] **Step 6: Ship webhook** — fire mock payload (Task 25 step 3). Assert `stock_qty=13, committed_qty=0` (20 - 7 shipped = 13; committed 7 - 7 = 0), event `order_ship delta_stock=-7, delta_committed=-7`.

(Note: spec §13 step 6 says `stock_qty = 13, committed_qty = 0` after shipping; this matches exactly because §13 has a sequence starting with 20 stock, +5 reserve, +2 edit-up to 7, then ship the 7.)

- [ ] **Step 7: Release an unshipped line**

```sql
-- Reserve another 3 on a different quote_item.
insert into quote_items (..., quantity) values (..., 3, '<BLACK_M_VARIANT>') returning id;
select reserve_quote_line('<QI3>');
-- Now release it.
select release_quote_line('<QI3>', 'customer cancelled');
-- Assert committed_qty decremented, event order_release with negative delta_committed.
```

- [ ] **Step 8: Recount to 15** via UI recount form. Assert `stock_qty=15`, event `count_correction delta_stock=2`.

- [ ] **Step 9: Untrack Black/XS** — via UI button. Confirm the row is deleted from `variant_inventory`; `product_variants` row persists; no new events inserted.

- [ ] **Step 10: Concurrency — race two reservers**

```sql
-- In two `psql` sessions, each begins a transaction and calls
--   select reserve_quote_line('<QI>') on items totalling 2× 5 units
--   against a row with 7 available.
-- Expect: first commits, second rolls back with OUT_OF_STOCK.
```

- [ ] **Step 11: RLS**
  - A user without `inventory` permission visits `/inventory` → redirected to `/dashboard`.
  - A user without permission calls `/api/inventory/orgs` → 403.
  - A customer portal end-user belonging to Reburger calls `select * from variant_availability` → sees Reburger rows only (not Bike Glendhu's).

---

# Appendix — Test plan summary

**SQL / DB tests:** Tasks 1, 2 (trigger), 3, 4, 5, 6, 7 (each RPC), 8 (RLS), 14/15/16/19 (aggregate RPCs). All via `mcp__supabase__execute_sql` or a connected `psql` session, wrapped in `begin … rollback` to avoid polluting dev data.

**HTTP/API tests:** Tasks 12, 13, 14, 15, 16, 17, 18, 19 — cURL smoke against `npm run dev`. No automated harness.

**UI tests:** Tasks 20, 21, 22, 23, 24 — manual verification steps listed per task. Task 26 is the integrated end-to-end.

**Webhook tests:** Task 25 — cURL mock POST, then DB assertions.

If the team later adds vitest/Playwright, the per-task manual steps become the test specs verbatim.

# Appendix — Shared contracts this plan establishes (consumed by specs #2, #3, #4)

- **Tables:** `product_variants`, `variant_inventory`, `variant_inventory_events`
- **View:** `variant_availability` (columns: `variant_id, organization_id, stock_qty, committed_qty, available_qty`)
- **Postgres functions:** `reserve_quote_line`, `release_quote_line`, `adjust_quote_line_delta`, `ship_quote_line`, `apply_staff_adjustment`
- **Columns added to existing tables:** `quote_items.variant_id uuid`, `quote_items.monday_subitem_id text`
- **Staff permission keys:** `'inventory'`, `'inventory:write'`
- **Webhook extension point:** customer-portal `app/api/webhooks/monday/tracker-status/route.ts` inside `handleTrackerStatusChange`, before the tracker lookup

Later specs should **reference this plan path** rather than redefine any of the above:
`print-room-staff-portal/docs/superpowers/plans/2026-04-20-staff-portal-inventory-subapp-plan.md`
