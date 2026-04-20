# Sub-app #2 — Inventory — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)

## 1. Context

The Print Room is moving B2B customers off Shopify onto an own-built platform (two Next.js apps, one Supabase). Sub-app #1 (Products) shipped on 2026-04-20. This is sub-app #2.

Boss Chris confirmed on 2026-04-20 that stock-tracking is only used for three retail-stocking customers — **Reburger, Bike Glendhu, Otago Polytech** — and the pattern mirrors Shopify's *committed* model: stock is reserved against a variant the moment an order is placed, and physically decrements when the production job ships.

The feature is used infrequently in absolute terms (three customers, few dozen orders a month) but it is load-bearing — over-selling a customer a shirt that isn't on the shelf breaks trust immediately.

## 2. Goals

- Per-variant stock tracking scoped per-customer (so Bike Glendhu's polo stock is not visible to Otago Polytech).
- Shopify-style `committed` reservation on order submit, with atomic over-sell prevention.
- Automatic stock decrement when the production job reaches Monday status `dispatched`, reusing the existing webhook.
- Staff adjustments UI for intake, recounts, and damage write-offs with a full audit trail.
- Clean extension point for the customer portal's out-of-stock UX (sub-app #4) and the CSR tool (sub-app #3/#4) — both read one Postgres view.
- Introduce the missing `product_variants` table cleanly so downstream work (catalogues, CSR tool, variant pricing) has a stable key to reference.

## 3. Non-goals (out of scope)

- **Bulk CSV seeding** for go-live — manual entry is fine for three customers. Defer to v1.1 if staff ask for it.
- **Auto-PO / reorder tracking** — when staff click "Request reorder" from the customer portal, it pings staff (spec #4). No purchase-order object in Supabase.
- **Demand forecasting / low-stock emails** — v1.1.
- **Multi-warehouse** — single implicit location per variant×org row.
- **Global (non-per-customer) stock** — not modelled. Every row is scoped to an `organization_id`.
- **Explicit "this customer is stocked" toggle** on `organizations` — derived from presence of rows in `variant_inventory`.
- **Variant backfill for all 3,818 products** — variants are created on demand, not pre-seeded.

## 4. Architecture

### 4.1 Route structure

New route group inside the existing `(portal)` segment:

```
src/app/(portal)/inventory/
  page.tsx                          Landing: list of orgs with ≥1 tracked variant
  [orgId]/page.tsx                  Products tracked for this org
  [orgId]/[productId]/page.tsx      Variants of this product for this org; adjustments UI
  events/page.tsx                   Global audit log (filterable by org, product, reason)
src/app/api/inventory/
  orgs/route.ts                     GET orgs with tracked variants
  [orgId]/products/route.ts         GET tracked products for org; POST to start tracking a product
  [orgId]/variants/route.ts         GET tracked variants for org
  [orgId]/variants/[variantId]/route.ts        PATCH stock_qty (adjustment), DELETE (untrack)
  [orgId]/variants/[variantId]/adjust/route.ts POST { delta, reason, note }
  events/route.ts                   GET paginated event log
src/app/api/products/[id]/variants/route.ts    GET / POST (create variant from color+size)
src/app/api/products/[id]/variants/bulk/route.ts POST (expand all color×size combinations)
```

### 4.2 Data layer

API routes use the existing `src/lib/supabase-server.ts` service-role client, gated by the new `inventory:write` permission (see §8). The reservation path runs through a SQL function for atomicity; everything else uses PostgREST.

### 4.3 Cross-app contract

The customer portal (`print-room-portal`) and — later — the CSR tool both read the same Postgres view `variant_availability`. No REST API for availability in v1. Writes only from the staff portal and from the reservation function.

### 4.4 Next.js 16 caveat

Both the staff portal and the customer portal are on Next.js 16 — the bundled docs at `node_modules/next/dist/docs/` must be consulted before writing route handlers. Async params, request/cookies APIs and server/client boundaries differ from pre-16 patterns.

## 5. Data model

### 5.1 New tables

```sql
-- The missing SKU join. One row per color × size that exists for a product.
-- Created on-demand, not backfilled.
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

-- Stock tracking, per variant, per customer.
-- Row exists ⇔ variant is tracked for that customer.
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

-- Append-only audit of every delta.
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
```

### 5.2 Column addition

```sql
alter table quote_items
  add column variant_id uuid references product_variants(id);
```

Nullable for now — legacy quote items (the seed rows that predate variants) won't have one. New quote items written via the CSR tool and customer portal must set it for stocked-inventory orgs.

### 5.3 Indexes

- `variant_inventory (organization_id, variant_id)` — covers the "list for org" query.
- `variant_inventory_events (organization_id, created_at desc)` — the audit log is read recent-first.
- `product_variants (product_id)` — one-to-many walk.
- `quote_items (variant_id) where variant_id is not null` — partial, for the dispatched-webhook lookup.

## 6. Variant creation & backfill

There are 3,818 products × (on average ~2.2 colors × ~4.3 sizes) ≈ ~36k potential variants. Blanket-creating all of them for every product is waste — 99% of products are made-to-order and never need variants.

**Rule:** variants are created lazily. Two triggers:

1. **Staff starts tracking a product for an org.** From a product's page in sub-app #1, staff picks an org and clicks "Track stock for [org]". This calls `POST /api/products/[id]/variants/bulk` — server expands every `color_swatch × size` row into a `product_variants` row (idempotent on the unique constraint), then creates `variant_inventory` rows with `stock_qty = 0` for that org.
2. **New quote line for a stocked-inventory product picks a color/size that has no variant row yet.** The CSR tool/customer portal helpers upsert the missing `product_variants` row (still deterministic by the `(product_id, color_swatch_id, size_id)` unique key) before creating the quote item.

Staff can delete individual `variant_inventory` rows to stop tracking specific variants for a customer — e.g. drop `Black/XS` if Bike Glendhu never sells it. Deleting the `product_variants` row itself is restricted; soft-delete via `is_active = false`.

## 7. Reservation contract

### 7.1 Postgres function

```sql
create or replace function reserve_quote_line(p_quote_item_id uuid)
returns void language plpgsql as $$
declare
  v_variant uuid;
  v_org uuid;
  v_qty integer;
  v_inv variant_inventory%rowtype;
begin
  select qi.variant_id, q.account_id, qi.quantity
    into v_variant, v_org, v_qty
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where qi.id = p_quote_item_id;

  -- Only orgs that opted in to stocking have rows. No row ⇒ nothing to reserve.
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

Companion functions (same pattern):
- `release_quote_line(p_quote_item_id uuid, p_reason text)` — cancel / edit-down.
- `adjust_quote_line_delta(p_quote_item_id uuid, p_old_qty integer, p_new_qty integer)` — edit-in-place.
- `ship_quote_line(p_quote_item_id uuid)` — called by Monday webhook; decrements `stock_qty` and `committed_qty` together.
- `apply_staff_adjustment(p_variant_id uuid, p_org_id uuid, p_delta integer, p_reason text, p_note text, p_staff_id uuid)` — manual intake / count / write-off.

### 7.2 Caller contract

The CSR tool and customer portal checkout both wrap quote submission in a transaction and call `reserve_quote_line` for each line. A thrown `OUT_OF_STOCK` rolls the whole submission back — partial reservation is never left behind.

### 7.3 Edit semantics

- Pre-ship qty change: `adjust_quote_line_delta` applies the delta; may throw `OUT_OF_STOCK` if increasing.
- Cancel: `release_quote_line` on every line with an existing commit event.
- Post-ship "edit" is not supported — once `order_ship` has fired for a line, further changes must go through a separate adjustment (documented to staff, not enforced in code yet).

## 8. Monday webhook extension

The existing handler at [print-room-portal/app/api/webhooks/monday/tracker-status/route.ts](print-room-portal/app/api/webhooks/monday/tracker-status/route.ts) already:
- Detects subitem events via `event.parentItemId` (line ~118).
- Maps `shipped` / `delivered` / `dispatched` labels to canonical key `'dispatched'` (see `lib/monday/status-mappings.ts` line ~94).
- Sets `production_complete_at` at the existing extension point (line ~308).

**Change:** when the event is on a subitem AND the canonical key is `'dispatched'`:
1. Resolve the subitem's `quote_item_id`. Source of truth: the Replit quote builder writes Monday subitem IDs back to the quote line when it pushes to Monday (see spec #3). In the interim, look up by subitem name == quote item product + variant name (fallback — acceptable while the Replit integration ships in parallel).
2. Call `ship_quote_line(quote_item_id)`.
3. Failure to resolve → log to `job_tracker_webhook_logs` with `status='orphan_ship_event'`; do not throw. A staff-portal reconciliation view surfaces orphans.

**Why keep the handler in `print-room-portal`:** both apps share one Supabase; moving the handler would only shuffle code. The inventory extension is a few lines of server code near the existing status handlers.

## 9. Staff UI

All UI built from existing primitives in `src/components/ui/`. New components under `src/components/inventory/`. No new dependencies.

### 9.1 Landing `/inventory`

- List cards: one per org that has ≥1 row in `variant_inventory`. Shows org name, total tracked variants, total units on hand, total committed, and last event timestamp.
- "+ Track new customer" action — opens an org picker (typeahead against `organizations.name`) and lands on the org's empty tracked-products page, ready to pick a product.

### 9.2 Org tracked-products `/inventory/[orgId]`

- Table of products tracked for this org: thumbnail, name, variant count, total on-hand, total committed, available.
- "+ Track new product" — opens a product picker (typeahead against products where `is_active = true`), then calls the bulk-expand endpoint.

### 9.3 Variant detail `/inventory/[orgId]/[productId]`

- Grid of variants: color swatch × size matrix, each cell shows `available / on-hand`.
- Row click opens a drawer with:
  - Current counts (stock, committed, available).
  - **Receive stock** form — qty + optional PO reference + optional note → `intake` event.
  - **Recount** form — absolute new qty + required note → `count_correction` event with computed delta.
  - **Write off** form — qty (positive entered, stored as negative delta) + required note → `damage_writeoff`.
  - **Untrack** button — destructive, confirms before removing the `variant_inventory` row.
  - Recent events (last 10) with filter-through to the global log.

### 9.4 Global events log `/inventory/events`

- Paginated table: timestamp, org, product/variant, delta_stock, delta_committed, reason, staff user, note, reference quote item id (linked).
- Filters: org, reason, date range, variant, staff.

## 10. Auth, permissions, RLS

### 10.1 Permission

- New key `inventory:write` on `staff_users.permissions`.
- Sidebar nav entry visible only to users with `inventory:write` OR role `admin`/`super_admin`.
- Helper `src/lib/auth/can.ts` (shared with sub-app #1) gains the new key.
- Every `/api/inventory/**` route guards server-side; 403 otherwise.

### 10.2 Row-level security

- `product_variants` — read: any authenticated staff or org-scoped customer. Write: service role only.
- `variant_inventory` — read: staff with `inventory:write`, plus users where `user_organizations.organization_id = variant_inventory.organization_id`. Write: service role only.
- `variant_inventory_events` — read: staff with `inventory:write`. No write via PostgREST (only SQL functions).
- `variant_availability` view inherits `variant_inventory` policy.

Pattern reused from `getCompanyAccess` in [print-room-portal/lib/company.ts:87](print-room-portal/lib/company.ts#L87).

## 11. Decisions made (with defaults applied per auto-mode)

| # | Decision | Default chosen | Override needed? |
|---|---|---|---|
| 1 | Stocked-customer flag | Derived from `variant_inventory` rows | Tell me if you want an explicit column on `organizations` |
| 2 | Variant backfill | Lazy, on-demand | Tell me if you want pre-expansion for the 3 customers on go-live |
| 3 | Bulk CSV seeding | Deferred to v1.1 | Tell me if day-one manual entry isn't practical |
| 4 | Edit post-submit, pre-ship | Live `committed_qty` delta | Tell me if you want immutable orders |
| 5 | Monday subitem → quote item resolution | Subitem ID on quote_items (written by Replit push, spec #3); name-match fallback | Tell me if you want a different matching strategy |
| 6 | Multi-warehouse | Single implicit location per row | Tell me if stock is split across physical sites |
| 7 | Permission key name | `inventory:write` | Tell me if you want a different key |

## 12. Dependencies & follow-ups (not in this spec)

- **Sub-app #3 (B2B catalogues & companies)** — may surface an explicit "stocked-inventory customer" toggle for discoverability; can coexist with the derived model.
- **Sub-app #4 (CSR tool)** and **customer portal checkout** — both call `reserve_quote_line` and read `variant_availability`. The out-of-stock UX spec (separate file) covers what the customer sees.
- **Replit quote builder rework (separate spec)** — needs to write Monday subitem IDs back onto `quote_items.monday_subitem_id` so the ship webhook can resolve lines deterministically.
- **v1.1 deferred:** bulk CSV import, explicit stocked-customer flag, reorder-point alerts, supplier PO tracking, multi-warehouse.

## 13. Verification

End-to-end happy path:
1. Seed Reburger as an `organization`. Track a product with 3 color × 4 size → 12 `product_variants` rows, 12 `variant_inventory` rows at `stock_qty = 0`.
2. Intake: +20 on Black/M → `variant_inventory.stock_qty = 20`, event row with `delta_stock = 20, reason = 'intake'`.
3. Create a quote + quote_item for Black/M × 5 for Reburger. Call `reserve_quote_line` → `committed_qty = 5`, event `order_commit`.
4. Edit to qty 7 → `adjust_quote_line_delta(5, 7)` → `committed_qty = 7`.
5. Attempt quote_item for Black/M × 20 → reservation raises `OUT_OF_STOCK`, transaction rolls back.
6. Fire mock Monday dispatched webhook for the subitem → `stock_qty = 13, committed_qty = 0`, event `order_ship`.
7. Cancel a second quote_item pre-ship → `release_quote_line` → `committed_qty` decrements, event `order_release`.
8. Recount to 15 → event `count_correction` with `delta_stock = 2`.
9. Untrack Black/XS (unused) → `variant_inventory` row deleted, no events rewritten.

Concurrency / race:
- Two clients reserve 5 units each when `available = 7`. Expectation: one succeeds (`committed_qty = 5`), the other rolls back with `OUT_OF_STOCK`. Enforced by `for update` in `reserve_quote_line`.

UI:
- Landing page only shows orgs with rows.
- Variant grid renders correctly for a product with single-color and multi-color variants.
- Events log filters round-trip.
- Non-permissioned staff get 403 on API and redirect on UI.
