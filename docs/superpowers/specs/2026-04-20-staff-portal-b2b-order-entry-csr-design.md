# Sub-app #4 — B2B Order Entry (CSR Tool) — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)

## 1. Context

Staff currently take B2B phone and email orders by creating Shopify draft orders. With the 2026-04-20 decision to move B2B customers off Shopify, that path is ending. Staff still need a way to enter orders on behalf of a company and have them flow into production and invoicing.

This sub-app is the staff-side counterpart to customer self-serve checkout (separate spec). Both write to the same `quotes` + `orders` + `quote_items` tables in Supabase; both push a Monday.com production job; both call `reserve_quote_line` for stocked-inventory customers (see [Inventory sub-app spec](./2026-04-20-staff-portal-inventory-subapp-design.md)). The CSR tool is optimised for a staff power-user taking a phone order, not a customer browsing.

Xero invoicing automation is **deferred to v1.1** — staff create the Xero quote manually from the Supabase order record in the meantime. v1 still captures every field Xero needs so v1.1 is a pure API integration task.

## 2. Goals

- Replace Shopify draft-order entry for phone/email orders on three retail-stocking customers and all other B2B companies.
- Capture: company, tier pricing, ship-to, payment terms, deposit %, line items, notes, required-by date.
- Apply quantity-bracket pricing from `product_pricing_tiers` multiplied by the customer's tier discount from `price_tiers`.
- Enforce inventory hard-block when a line oversells a stocked-inventory variant.
- Allocate a readable order reference `<customer_code>-<6-digit seq>` (e.g. `BIK-000247`).
- Push a Monday.com production job (item + subitems) and record the IDs back on the Supabase rows.
- Support pre-ship edits (qty change, line remove, cancel) that correctly adjust committed inventory.

## 3. Non-goals (out of scope)

- **Xero integration** — v1.1. No OAuth, no contact lookup, no quote push. Staff handle Xero manually.
- **Split-ship** — lives in the customer portal checkout (separate spec). CSR tool assumes one ship-to per order.
- **Shopify draft-order push** — we are moving off Shopify; CSR-created orders never touch Shopify. `quotes.shopify_draft_order_id` stays null.
- **Quote-to-order one-click conversion** — Chris confirmed quotes live in the Replit builder; conversion is handled there (see Replit spec). CSR always types orders fresh or accepts an already-approved quote as input.
- **Tier-pricing authoring UI** — existing `product_pricing_tiers` rows are consumed read-only in v1. A staff UI to create/edit tier prices per product is a follow-up (see §12).
- **Bulk line-item import** — CSR types lines one at a time. Paste/CSV is v1.1.
- **Credit-limit enforcement** — `b2b_accounts.credit_limit` exists but is not enforced in v1; displayed only.

## 4. Architecture

### 4.1 Route structure

New route group inside the existing `(portal)` segment:

```
src/app/(portal)/orders/
  page.tsx                      List: recent orders, filters by org/status/date
  new/page.tsx                  Single-page order entry form
  [id]/page.tsx                 Order detail; pre-ship edits; status timeline
src/app/api/orders/
  route.ts                      POST create (submit), GET list
  [id]/route.ts                 GET / PATCH (edits) / DELETE (cancel)
  [id]/lines/[lineId]/route.ts  PATCH qty/variant; DELETE line
src/app/api/pricing/quote-line/route.ts
                                POST {product_id, variant_id, qty, org_id} → {unit_price, total, tier_level, bracket}
src/app/api/organizations/[id]/customer-code/route.ts
                                PATCH — minimal endpoint to set customer_code from CSR tool until sub-app #3 ships
```

### 4.2 Data layer

Server-side API routes use `src/lib/supabase-server.ts` (service role key, staff-gated). Submit runs inside a single Postgres transaction: `quotes` insert → `quote_items` inserts → `orders` insert → `reserve_quote_line` per item → sequence-allocate ref → Monday push → writeback of `monday_item_id` / `monday_subitem_id`. Any step fails, the whole thing rolls back (except the Monday push — see §7.3).

### 4.3 Next.js 16 caveat

Both apps are on Next.js 16. Before touching route handlers or server/client boundaries, consult `node_modules/next/dist/docs/` per the repo's `AGENTS.md`. Async params and request APIs differ from earlier versions.

## 5. Data model

### 5.1 Column additions

```sql
alter table organizations
  add column customer_code text unique
  check (customer_code ~ '^[A-Z0-9]{2,6}$');

alter table quote_items
  add column monday_subitem_id text;

alter table quotes
  add column order_ref text unique;
-- Allocated on submit; format "<customer_code>-<padded seq>".
```

`quote_items.variant_id` is added by the Inventory spec and reused here.

### 5.2 Sequence

```sql
create sequence if not exists order_number_seq start 1;
```

Single global sequence. Display-only; `orders.id` UUID remains primary key. Zero-padded to 6 digits on format: `lpad(nextval('order_number_seq')::text, 6, '0')`. At current volume this sequence outlasts the business.

### 5.3 Pricing function

```sql
create or replace function get_unit_price(
  p_product_id uuid,
  p_org_id uuid,
  p_qty integer
) returns numeric language plpgsql stable as $$
declare
  v_tier_level integer;
  v_bracket_price numeric;
  v_discount numeric;
begin
  -- Customer tier
  select tier_level into v_tier_level
    from b2b_accounts
   where id = (select /* derive from org */ ... );   -- see note below

  -- Quantity-bracketed wholesale price
  select unit_price into v_bracket_price
    from product_pricing_tiers
   where product_id = p_product_id
     and is_active = true
     and p_qty between min_quantity and coalesce(max_quantity, 2147483647)
   order by min_quantity desc
   limit 1;

  -- Tier discount (customer-level)
  select coalesce(discount, 0) into v_discount
    from price_tiers
   where tier_id = v_tier_level::text;

  return round(coalesce(v_bracket_price, 0) * (1 - v_discount), 2);
end;
$$;
```

Note: `b2b_accounts` and `organizations` aren't yet linked (`b2b_accounts.shopify_customer_id` predates `organizations.id`). Spec adds `b2b_accounts.organization_id uuid references organizations(id)` so the lookup works. If an org has no `b2b_accounts` row, the pricing function returns the unadjusted bracket price (Tier 3 / 0% discount equivalent).

## 6. Order entry page (`/orders/new`)

Single-page form, sticky summary panel on the right. Keyboard-first. Tab order flows top-to-bottom.

### 6.1 Sections

1. **Company** — typeahead against `organizations.name`. Shows `customer_code`, tier_level, payment_terms, credit_limit (read-only), whether org has stocked inventory (derived from `variant_inventory` presence). If `customer_code` is blank, inline 3–6 char input to set it via the PATCH endpoint (will be replaced by sub-app #3).
2. **Ship-to** — dropdown of that org's `stores`. Last option: "Custom address". Inline form for address fields when custom. If org has no stores, Custom is default. Optional checkbox "Save as store" (creates `stores` row on submit).
3. **Line items** — rows with: product typeahead (matches `products.name` / `sku`, filtered by `is_active`), variant picker (color × size from `product_variants` or lazily-expanded `swatches × sizes`), qty, unit price (auto from `get_unit_price`, overridable with a visual indicator "manual override"), line total. Live stock check: if org has a `variant_inventory` row for the selected variant, show `available: N` pill next to qty. Red warning + submit-disable if entered qty > available.
4. **Decoration** — per-line collapsible: decoration_eligible? if yes, dropdown from product's decoration options (reuses the existing decoration price model). Out of scope to redesign decoration pricing here; spec inherits whatever sub-app #1 models.
5. **Terms** — payment_terms (default from `b2b_accounts.payment_terms`, overridable); deposit_percent (default from `default_deposit_percent`, overridable); required_by date picker.
6. **Notes** — `notes` (customer-visible) + `internal_notes` (staff-only). Both free text.
7. **Summary panel** — sticky on scroll; totals update live: subtotal, deposit, balance, required-by, line count, flagged out-of-stock lines.

### 6.2 Submit behaviour

- Button label: "Submit order". Disabled if any line oversells a stocked variant, or any required field is blank.
- On click: POST `/api/orders` with an idempotency key (client-generated uuid) stored as `quotes.idempotency_key`. Re-submits with the same key are no-ops; they return the original row.
- On success: redirect to `/orders/[id]` showing the allocated `order_ref` prominently, with a "Copy ref to clipboard" button.

## 7. Submit pipeline

### 7.1 Transactional order of operations

```
BEGIN;
  insert into quotes (...)            -- idempotency_key unique; returning id
  insert into quote_items (...)       -- one row per line, with variant_id
  insert into orders (quote_id, account_id, ...) returning id
  select lpad(nextval('order_number_seq')::text, 6, '0') into seq;
  update quotes set order_ref = customer_code || '-' || seq where id = quote.id;
  -- Reservation (throws OUT_OF_STOCK → rollback)
  perform reserve_quote_line(quote_item.id) for each quote_item;
COMMIT;
-- (outside txn — see 7.3)
  push monday item + subitems;
  update quotes set monday_item_id = ...;
  update quote_items set monday_subitem_id = ... per line;
```

### 7.2 Failure modes

- `OUT_OF_STOCK` from `reserve_quote_line` → rollback, surface which line to the client so user can edit.
- Unique-constraint collision on `quotes.idempotency_key` → return the existing row (success idempotent).
- Customer code missing → client-side validation blocks submit earlier; defence-in-depth check in API.

### 7.3 Monday push isolation

Monday push runs *after* COMMIT. Rationale: Monday is external and slow; holding a DB transaction open across its latency would lock inventory rows. If Monday push fails, the Supabase order still exists (correct state) with `monday_item_id = NULL`. A reconciliation button on the order detail page re-runs the push. A nightly job (v1.1) sweeps orders with null monday_item_id older than 10 minutes.

Idempotency on Monday's side: before calling `create_item`, the helper checks if `quotes.monday_item_id` is already set; if so, treat as success.

## 8. Monday push helper

New file `print-room-staff-portal/src/lib/monday/production-job.ts`. Mirrors the pattern from [print-room-portal/lib/monday/collections.ts](print-room-portal/lib/monday/collections.ts).

- Config: `MONDAY_PRODUCTION_BOARD_ID` env var (required); column-id env vars following existing naming (`MONDAY_COL_PRODUCTION_ORDER_REF`, `MONDAY_COL_PRODUCTION_CUSTOMER`, `MONDAY_COL_PRODUCTION_DUE_DATE`, etc.).
- Item columns: order ref, customer name, required-by date, total, payment terms, deposit %, notes.
- Subitem per `quote_item`: variant name (color + size), qty, unit price, decoration summary. Subitem ID is written back to `quote_items.monday_subitem_id` — this is what the Inventory spec's dispatched-webhook uses to find which line shipped.
- Error handling: throws on 4xx/5xx; caller wraps in try/catch and surfaces to reconciliation flow.

## 9. Orders list and detail

### 9.1 List `/orders`

Table columns: order_ref, org name, submitted_at, required_by, line count, total, payment status, production status (derived from `job_trackers.status`). Filters: org, status, date range, tier. Pagination 25/page.

### 9.2 Detail `/orders/[id]`

- Header: order_ref, org, submitted_at, status, total.
- Editable pre-ship: each line has inline qty/variant edit and a delete button. Edits call `adjust_quote_line_delta` or `release_quote_line` through the API. Cancel whole order calls `release_quote_line` for every line and sets `orders.status = 'cancelled'` (adds new enum value).
- Read-only post-ship: once any subitem in Monday has transitioned to `dispatched`, the detail page locks lines. Staff see a notice: "Some items shipped — edits disabled. For changes, create an adjustment."
- Sidebar: Monday item link, Xero quote link (null in v1 until v1.1).

## 10. Auth, permissions, RLS

- New permission key `orders:write` on `staff_users.permissions`.
- Sidebar "Orders" section visible when user has `orders:write` OR role in (`admin`, `super_admin`).
- API routes guard server-side via the shared `src/lib/auth/can.ts` helper (gains a new key).
- `quotes`, `orders`, `quote_items` remain staff-write via service-role; customer portal reads filter on `account_id = user's org`.
- No new RLS policies required for v1.

## 11. Decisions made (with defaults applied per auto-mode)

| # | Decision | Default chosen | Override needed? |
|---|---|---|---|
| 1 | Xero automation | Deferred to v1.1 | Tell me if v1 must include Xero |
| 2 | Order number sequence | Single global, zero-padded 6 digits | Tell me if you want per-customer sequences |
| 3 | Customer code location | New `organizations.customer_code` unique column | Tell me if it should live on `b2b_accounts` |
| 4 | Ship-to source | Dropdown of `stores`; custom-address fallback | — |
| 5 | Payment terms | Default from `b2b_accounts.payment_terms`, overridable | — |
| 6 | UX pattern | Single-page form + sticky summary | Tell me if you want a wizard |
| 7 | Monday push timing | Post-commit, out of transaction | — |
| 8 | Credit limit enforcement | Display-only, not enforced | Tell me if oversell on credit should block |
| 9 | Cancel rule | Pre-ship cancel allowed; post-ship locked | — |
| 10 | Permission key name | `orders:write` | — |

## 12. Dependencies & follow-ups (not in this spec)

- **Sub-app #2 (Inventory)** — must ship first. CSR tool calls `reserve_quote_line`, reads `variant_availability`, writes `quote_items.monday_subitem_id`.
- **Sub-app #3 (B2B catalogues & companies)** — will own the primary UI for `organizations.customer_code` and `b2b_accounts` CRUD. CSR tool includes a minimal inline editor for `customer_code` so it can stand up without waiting for sub-app #3.
- **Replit quote builder rework (separate spec)** — when quotes from the Replit tool are approved, they flow into Monday directly (per Chris). CSR tool does NOT consume Replit quotes in v1. If/when that changes, a "From existing quote…" action on `/orders/new` would pre-populate lines from a `quotes` row.
- **Customer B2B checkout MVP (separate spec)** — will share the pricing function, reservation function, and Monday push helper. Differences: customer UI, split-ship support, no custom-unit-price override.
- **v1.1 deferred:**
  - Xero OAuth, contact search, quote push.
  - Pricing-tier authoring UI (create/edit `product_pricing_tiers` rows per product; staff-accessible from the Products sub-app).
  - Bulk paste / CSV line-item import.
  - Credit-limit enforcement with override.
  - Monday push reconciliation sweep (cron).
  - "From existing quote" action if Replit integration surfaces needs.

## 13. Verification

End-to-end happy path:
1. Seed Bike Glendhu as an `organization` with `customer_code = 'BIK'`, `b2b_accounts` row tier_level=2, one store.
2. Set `variant_inventory` for one tracked variant (Black/M) to `stock_qty=10`.
3. Create an order: Bike Glendhu → ship-to their store → 3 lines: (a) stocked Black/M × 5, (b) made-to-order Navy/L × 50, (c) made-to-order Navy/XL × 50 → terms default → submit.
4. Assert:
   - `orders` row created, `quotes.order_ref = 'BIK-000001'`.
   - `quote_items` rows: 3 rows with correct `variant_id`, `unit_price` = bracket price × 0.95 (Tier 2 = 5% off).
   - `variant_inventory` for Black/M: `committed_qty = 5`.
   - `variant_inventory_events` has `order_commit` row.
   - Monday API called once to create item and 3 subitems; IDs written back.
5. Over-commit test: create second order for Black/M × 10 → rejected with `OUT_OF_STOCK`, no partial writes, Monday not called.
6. Edit: reduce line (a) qty to 3 → `committed_qty = 3`, event `order_release` delta=2.
7. Cancel order → all lines released, `orders.status = 'cancelled'`, Monday item receives a status update (future; v1 leaves Monday cancellation manual).
8. Idempotency: re-POST with the same idempotency_key → same `order_ref` returned, no new rows.

UX verification:
- Non-permissioned staff: 403 on API, redirect from UI.
- Power-user keyboard flow works end-to-end (Tab cycles correctly; Enter in line-item qty moves to next line).
- Sticky summary updates within 100ms of any edit.
- Submit disabled on over-sell; error message identifies the offending line.
