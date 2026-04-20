# B2B Order-Entry (CSR Tool) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-portal B2B Order-Entry sub-app so CSRs can take phone/email orders, apply quantity-bracket pricing × customer-tier discount, reserve stocked inventory, allocate a readable `<customer_code>-<seq>` reference, push a production job to Monday, and edit/cancel orders pre-ship.

**Architecture:** Single-page order-entry form with a sticky summary. Submit runs through one atomic Postgres RPC (`submit_b2b_order`) that writes `quotes` + `quote_items` + `orders`, calls `reserve_quote_line` per item, allocates `order_ref` from the global `order_number_seq`, and commits. Monday push runs **after** commit (external and slow — holding a DB transaction across Monday's latency would lock inventory rows). Monday IDs are written back; failures leave the order in a recoverable state plus a "Retry Monday push" button on the detail page.

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase (Postgres + RLS + Auth), Tailwind v4, TypeScript, Monday.com GraphQL via `fetch`, MCP `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql`.

**Repo:** `print-room-staff-portal` (everything in this plan — no customer-portal changes).

**Next.js 16 note (per AGENTS.md):** always re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `dynamic-routes.md` before writing new route handlers. `params` is `Promise<...>`; `cookies()`/`headers()` are async.

**Depends on Inventory plan (spec #1):**
- RPCs: `reserve_quote_line`, `release_quote_line`, `adjust_quote_line_delta`
- Columns: `quote_items.variant_id`, `quote_items.monday_subitem_id`
- View: `variant_availability`
- Reference: `print-room-staff-portal/docs/superpowers/plans/2026-04-20-staff-portal-inventory-subapp-plan.md`

---

## Ambiguities resolved (override in review if wrong)

1. **Pricing semantics.** Spec §5.3 leaves `/* derive from org */` blank. Resolution: `get_unit_price` reads bracket from `product_pricing_tiers` by `p_qty` only (ignores `tier_level` — per the data, `tier_level` is an ordinal bracket index, **not** a customer tier). Customer tier comes from `b2b_accounts.tier_level` → `price_tiers.discount`. No `b2b_accounts` row → fall back to Tier 3 (0% discount), unadjusted bracket price.
2. **`orders.account_id → b2b_accounts.id` is a hard FK.** `b2b_accounts` is currently empty (0 rows). CSR submit auto-creates a `b2b_accounts` row for the org on first order (tier_level=3, payment_terms='net_20', default_deposit_percent=0, platform='b2b', company_name from `organizations.name`). Subsequent orders for the same org reuse that row.
3. **`b2b_accounts.organization_id uuid unique references organizations(id)`** is added (nullable — legacy rows stay null). Enables the org → account lookup.
4. **`quotes.order_ref` added; `quotes.idempotency_key` already exists** in the live schema. Skip the idempotency_key add in §5.1.
5. **`orders.status` enum already has `'cancelled'`** — no enum migration needed. Spec §9.2's "adds new enum value" is stale.
6. **Monday helper created fresh in staff-portal.** The customer-portal helpers at `print-room-portal/lib/monday/*` cannot be cross-imported (different repo). New files in `src/lib/monday/` mirror that shape verbatim (small, acceptable duplication — flagged in §12 of spec #4 as expected). Board/column constants duplicated from [print-room-portal/lib/monday/column-ids.ts](print-room-portal/lib/monday/column-ids.ts).
7. **Submit pipeline.** DB side is wrapped in one RPC `submit_b2b_order` (atomic). Monday push is separate (post-commit, with a dedicated "retry" endpoint for recovery).
8. **`requireOrdersStaffAccess`** mirrors [src/lib/products/server.ts:28-70](print-room-staff-portal/src/lib/products/server.ts#L28-L70) — accepts `'orders'` or `'orders:write'` on `staff_users.permissions`, admin bypass. Adds both literals to `StaffPermission`.
9. **Tier-pricing authoring UI** deferred to v1.1 (spec §12). Seed data is managed by hand for v1.

---

## File structure

### New files

**Server + auth:**
- `src/types/orders.ts`
- `src/lib/orders/server.ts` — `requireOrdersStaffAccess`
- `src/lib/orders/submit.ts` — calls `submit_b2b_order` RPC + post-commit Monday push
- `src/lib/monday/client.ts`
- `src/lib/monday/column-ids.ts`
- `src/lib/monday/production-job.ts`

**API routes:**
- `src/app/api/orders/route.ts` — POST (create), GET (list)
- `src/app/api/orders/[id]/route.ts` — GET, DELETE (cancel whole)
- `src/app/api/orders/[id]/lines/[lineId]/route.ts` — PATCH (qty/variant), DELETE
- `src/app/api/orders/[id]/monday-reconcile/route.ts` — POST (retry push)
- `src/app/api/pricing/quote-line/route.ts` — POST
- `src/app/api/organizations/[id]/customer-code/route.ts` — PATCH

**Pages:**
- `src/app/(portal)/orders/page.tsx` — list
- `src/app/(portal)/orders/new/page.tsx` — form
- `src/app/(portal)/orders/[id]/page.tsx` — detail

**Components (all under `src/components/orders/`):**
- `CompanySection.tsx`, `ShipToSection.tsx`, `LineItemsTable.tsx`, `LineItemRow.tsx`, `TermsSection.tsx`, `SummaryPanel.tsx`, `OrderFormClient.tsx` (top-level client component), `OrdersList.tsx`, `OrderDetailClient.tsx`, `LineEditRow.tsx`

### Modified files

- `src/types/staff.ts` — add `'orders'` and `'orders:write'`
- `src/components/layout/Sidebar.tsx` — add Orders section

### Migrations (via `mcp__supabase__apply_migration`)

- `20260420_orders_schema` — `quotes.order_ref`, `order_number_seq`, `organizations.customer_code`, `b2b_accounts.organization_id`
- `20260420_pricing_fn` — `get_unit_price`
- `20260420_submit_b2b_order_fn` — the transactional submit RPC
- `20260420_allocate_order_ref_fn` — helper

---

# Tasks

## Task 1: Order-entry schema additions

**Acceptance criteria:**
- `quotes.order_ref text unique` exists (nullable until allocation).
- `order_number_seq` sequence exists, starts at 1.
- `organizations.customer_code text unique` with check `^[A-Z0-9]{2,6}$`.
- `b2b_accounts.organization_id uuid unique references organizations(id)` (nullable).
- Index on `quotes.order_ref`.

- [x] **Step 1: Apply the migration**

Invoke `mcp__supabase__apply_migration` with `name = "20260420_orders_schema"`:

```sql
alter table quotes add column order_ref text unique;
create sequence if not exists order_number_seq start 1;

alter table organizations
  add column customer_code text unique
  check (customer_code is null or customer_code ~ '^[A-Z0-9]{2,6}$');

alter table b2b_accounts
  add column organization_id uuid unique references organizations(id);

create index quotes_order_ref_idx on quotes (order_ref) where order_ref is not null;
```

- [x] **Step 2: Verify** via `mcp__supabase__execute_sql`:

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='quotes' and column_name='order_ref';
-- expect: 1 row

select sequence_name from information_schema.sequences
 where sequence_schema='public' and sequence_name='order_number_seq';
-- expect: 1 row

select column_name from information_schema.columns
 where table_schema='public' and table_name='organizations' and column_name='customer_code';
-- expect: 1 row

select column_name from information_schema.columns
 where table_schema='public' and table_name='b2b_accounts' and column_name='organization_id';
-- expect: 1 row
```

- [x] **Step 3: Commit** the plan doc.

---

## Task 2: `get_unit_price` pricing function

**Acceptance criteria:**
- Product with bracket rows for qty range: returns `bracket_price * (1 - tier_discount)` rounded to 2 dp.
- Qty outside all brackets: returns `0`.
- No `b2b_accounts` row for the org: returns unadjusted bracket price (0% discount).
- Org has a `b2b_accounts` row but `tier_level` null: 0% discount.

- [x] **Step 1: Apply the migration**

`mcp__supabase__apply_migration` name `20260420_pricing_fn`:

```sql
create or replace function get_unit_price(
  p_product_id uuid,
  p_org_id uuid,
  p_qty integer
) returns numeric language plpgsql stable as $$
declare
  v_tier_level integer;
  v_bracket_price numeric;
  v_discount numeric := 0;
begin
  select tier_level into v_tier_level
    from b2b_accounts
   where organization_id = p_org_id
   limit 1;

  select unit_price into v_bracket_price
    from product_pricing_tiers
   where product_id = p_product_id
     and is_active = true
     and p_qty between min_quantity and coalesce(max_quantity, 2147483647)
   order by min_quantity desc
   limit 1;

  if v_tier_level is not null then
    select coalesce(discount, 0) into v_discount
      from price_tiers
     where tier_id = v_tier_level::text;
  end if;

  return round(coalesce(v_bracket_price, 0) * (1 - coalesce(v_discount, 0)), 2);
end;
$$;
```

- [x] **Step 2: Smoke test**

```sql
-- With a real product_id + org_id that has pricing brackets seeded:
select get_unit_price(
  (select id from products where id in (select distinct product_id from product_pricing_tiers) limit 1),
  (select id from organizations limit 1),
  100
);
-- expect: a numeric price, non-zero if brackets cover qty=100.

select get_unit_price(
  '00000000-0000-0000-0000-000000000000',
  (select id from organizations limit 1),
  100
);
-- expect: 0 (no brackets for made-up product).
```

- [x] **Step 3: Commit**

---

## Task 3: `allocate_order_ref(p_customer_code text)` helper

**What & why:** pulls `nextval('order_number_seq')`, zero-pads to 6 digits, concatenates. Kept as a standalone function so it can be called inside `submit_b2b_order` (cleaner than embedding).

**Acceptance:**
- Returns `'<customer_code>-000001'` on first call, `'...-000002'` on second.

- [x] **Step 1: Apply**

`mcp__supabase__apply_migration` name `20260420_allocate_order_ref_fn`:

```sql
create or replace function allocate_order_ref(p_customer_code text)
returns text language sql as $$
  select p_customer_code || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$;
```

- [x] **Step 2: Smoke test**

```sql
select allocate_order_ref('BIK');
select allocate_order_ref('BIK');
-- expect BIK-000001 then BIK-000002 (values monotonic; exact numbers depend on seq state).
```

- [x] **Step 3: Commit**

---

## Task 4: `submit_b2b_order` RPC — atomic submit

**Scope:** one Postgres function that:
1. Inserts a `quotes` row.
2. Inserts a `quote_items` row per line.
3. Finds-or-creates a `b2b_accounts` row for the org.
4. Inserts an `orders` row.
5. Allocates `order_ref` and updates `quotes`.
6. Calls `reserve_quote_line` for each line (raises `OUT_OF_STOCK` → whole txn rolls back).
7. Returns `{ quote_id, order_id, order_ref }`.

**Idempotency:** caller passes `p_idempotency_key`. If an existing `quotes.idempotency_key` match exists, the function short-circuits — returns the existing row's IDs without doing any writes.

**Acceptance criteria:**
- All-or-nothing: if reservation fails, no rows persist.
- Repeat call with same idempotency_key: returns existing IDs, no duplicates.
- Caller must pass `customer_code` — function does NOT look it up (enforced server-side in the API route).

- [x] **Step 1: Apply**

`mcp__supabase__apply_migration` name `20260420_submit_b2b_order_fn`:

```sql
create or replace function submit_b2b_order(
  p_idempotency_key text,
  p_organization_id uuid,
  p_customer_code text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_payment_terms text,
  p_required_by date,
  p_notes text,
  p_internal_notes text,
  p_lines jsonb  -- array of {product_id, product_name, variant_id?, quantity, unit_price, customizations?}
) returns table (quote_id uuid, order_id uuid, order_ref text)
language plpgsql as $$
declare
  v_existing_quote_id uuid;
  v_existing_order_id uuid;
  v_existing_ref text;
  v_quote_id uuid;
  v_order_id uuid;
  v_order_ref text;
  v_account_id uuid;
  v_subtotal numeric := 0;
  v_line jsonb;
  v_qi_id uuid;
begin
  -- Idempotency short-circuit.
  select q.id, q.order_ref, o.id
    into v_existing_quote_id, v_existing_ref, v_existing_order_id
    from quotes q
    left join orders o on o.quote_id = q.id
   where q.idempotency_key = p_idempotency_key
   limit 1;

  if v_existing_quote_id is not null then
    quote_id := v_existing_quote_id;
    order_id := v_existing_order_id;
    order_ref := v_existing_ref;
    return next;
    return;
  end if;

  -- Compute subtotal from lines.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_subtotal := v_subtotal
      + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
  end loop;

  -- Insert the quote.
  insert into quotes (
    organization_id, status, customer_email, customer_name, customer_phone,
    line_items, subtotal, total_amount, platform, currency,
    payment_terms, required_by, notes, internal_notes,
    shipping_address, idempotency_key, submitted_at
  ) values (
    p_organization_id, 'approved', p_customer_email, p_customer_name, p_customer_phone,
    p_lines, v_subtotal, v_subtotal, 'b2b', 'NZD',
    p_payment_terms, p_required_by, p_notes, p_internal_notes,
    p_shipping_address, p_idempotency_key, now()
  ) returning id into v_quote_id;

  -- Insert quote_items.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into quote_items (
      quote_id, product_id, product_name, quantity, unit_price, total_price,
      variant_id, customizations
    ) values (
      v_quote_id,
      v_line->>'product_id',
      v_line->>'product_name',
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price')::numeric,
      (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric,
      nullif(v_line->>'variant_id','')::uuid,
      v_line->'customizations'
    );
  end loop;

  -- Find-or-create b2b_accounts for this org.
  select id into v_account_id from b2b_accounts where organization_id = p_organization_id;
  if v_account_id is null then
    insert into b2b_accounts (
      organization_id, company_name, tier_level, payment_terms,
      default_deposit_percent, platform, is_trusted
    ) values (
      p_organization_id,
      (select name from organizations where id = p_organization_id),
      3, coalesce(p_payment_terms, 'net_20'), 0, 'b2b', false
    ) returning id into v_account_id;
  end if;

  -- Insert order.
  insert into orders (
    quote_id, account_id, status, total_price, shipping_address, placed_at, created_at
  ) values (
    v_quote_id, v_account_id, 'awaiting-production', v_subtotal,
    p_shipping_address, now(), now()
  ) returning id into v_order_id;

  -- Allocate order_ref.
  v_order_ref := allocate_order_ref(p_customer_code);
  update quotes set order_ref = v_order_ref where id = v_quote_id;

  -- Reserve inventory for each line. Raises OUT_OF_STOCK → txn rollback.
  for v_qi_id in select id from quote_items where quote_id = v_quote_id loop
    perform reserve_quote_line(v_qi_id);
  end loop;

  quote_id := v_quote_id;
  order_id := v_order_id;
  order_ref := v_order_ref;
  return next;
end;
$$;
```

- [x] **Step 2: SQL smoke test**

```sql
begin;
  -- Seed: org with customer_code, product with pricing brackets.
  update organizations set customer_code = 'TST' where id = '<ORG>';

  select * from submit_b2b_order(
    'idk-test-1',
    '<ORG>',
    'TST',
    'Test Customer',
    'test@example.com',
    null,
    jsonb_build_object('line1','123 Test St','city','Wellington'),
    'net_20',
    null,
    'public note',
    'internal note',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', '<PROD>',
        'product_name', 'Test Product',
        'quantity', 5,
        'unit_price', 10.00,
        'variant_id', null
      )
    )
  );
  -- expect one row: (quote_id, order_id, order_ref='TST-000001')

  -- Idempotency: same key returns same values.
  select * from submit_b2b_order(
    'idk-test-1', '<ORG>', 'TST', 'Test', 'test@example.com',
    null, '{}'::jsonb, 'net_20', null, null, null,
    '[]'::jsonb
  );
  -- expect same row back.

  select count(*) from quotes where idempotency_key = 'idk-test-1';
  -- expect 1
rollback;
```

- [x] **Step 3: Commit**

---

## Task 5: Monday GraphQL client

**Files:**
- Create: `src/lib/monday/client.ts` — mirror of [print-room-portal/lib/monday/client.ts](print-room-portal/lib/monday/client.ts) verbatim (works as-is; no ENV differences).

- [x] **Step 1: Create the file**

Copy the contents of `print-room-portal/lib/monday/client.ts` into `print-room-staff-portal/src/lib/monday/client.ts`. No modifications — it's a self-contained fetch wrapper around `MONDAY_API_URL` with the `MONDAY_API_TOKEN` env var.

- [x] **Step 2: Confirm env**

Add `MONDAY_API_TOKEN` to the staff-portal's `.env.local` (already in the customer-portal; verify by reading `.env.local` and/or asking the user for the token once).

- [x] **Step 3: Type-check**

```bash
cd c:/Users/MSI/Documents/Projects/print-room-staff-portal
npx tsc --noEmit
```

- [x] **Step 4: Commit**

---

## Task 6: Monday column-ids (production board)

**Files:**
- Create: `src/lib/monday/column-ids.ts` — duplicate of [print-room-portal/lib/monday/column-ids.ts](print-room-portal/lib/monday/column-ids.ts).

- [x] **Step 1: Copy the file verbatim**

Destination: `print-room-staff-portal/src/lib/monday/column-ids.ts`. Include the `PRODUCTION_BOARD_ID`, `PRODUCTION_COLUMNS`, `PRODUCTION_SUBITEM_COLUMNS`, `ProductionSubitemSizeKey` exports.

- [x] **Step 2: Commit**

---

## Task 7: Monday production-job helper

**Files:**
- Create: `src/lib/monday/production-job.ts`

**Acceptance criteria:**
- Exports `createMondayProductionItem(order): Promise<{ itemId: string }>`.
- Exports `createMondayProductionSubitem(parentItemId, line): Promise<{ subitemId: string }>`.
- Exports `pushProductionJob(order, lines): Promise<{ itemId, subitemIds: Record<lineId, subitemId> }>` — top-level orchestrator that creates item, then subitems in series with a 300ms gap (matches collections.ts pattern for rate-limit friendliness).
- Idempotency: if `order.monday_item_id` is already set, skips item creation and only adds missing subitems.
- Errors thrown on GraphQL failure; caller handles.

- [x] **Step 1: Write the helper**

```ts
import { mondayApiCall } from './client'
import { PRODUCTION_BOARD_ID, PRODUCTION_COLUMNS, PRODUCTION_SUBITEM_COLUMNS } from './column-ids'

interface ProductionOrder {
  order_ref: string
  customer_name: string
  customer_email: string | null
  total_price: number
  required_by: string | null
  payment_terms: string | null
  notes: string | null
  monday_item_id: string | null
}

interface ProductionLine {
  quote_item_id: string
  product_name: string
  variant_label: string  // "Black / M" etc.
  quantity: number
  unit_price: number
  decoration_summary: string | null
  existing_subitem_id: string | null
}

export async function createMondayProductionItem(order: ProductionOrder): Promise<{ itemId: string }> {
  if (order.monday_item_id) return { itemId: order.monday_item_id }

  const columnValues: Record<string, unknown> = {}
  columnValues[PRODUCTION_COLUMNS.customerEmail] = order.customer_email
    ? { email: order.customer_email, text: order.customer_email } : null
  columnValues[PRODUCTION_COLUMNS.quoteTotal] = order.total_price
  if (order.required_by) {
    columnValues[PRODUCTION_COLUMNS.inHandDate] = { date: order.required_by }
  }

  const mutation = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `
  const result = await mondayApiCall<{ create_item: { id: string } }>(mutation, {
    boardId: String(PRODUCTION_BOARD_ID),
    itemName: `${order.order_ref} — ${order.customer_name}`,
    columnValues: JSON.stringify(columnValues),
  })
  return { itemId: result.create_item.id }
}

export async function createMondayProductionSubitem(
  parentItemId: string,
  line: ProductionLine
): Promise<{ subitemId: string }> {
  if (line.existing_subitem_id) return { subitemId: line.existing_subitem_id }

  const mutation = `
    mutation ($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
      create_subitem(parent_item_id: $parentItemId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `
  const result = await mondayApiCall<{ create_subitem: { id: string } }>(mutation, {
    parentItemId,
    itemName: `${line.product_name} — ${line.variant_label} × ${line.quantity}`,
    columnValues: JSON.stringify({}),
  })
  return { subitemId: result.create_subitem.id }
}

export async function pushProductionJob(
  order: ProductionOrder,
  lines: ProductionLine[]
): Promise<{ itemId: string; subitemIds: Record<string, string> }> {
  const { itemId } = await createMondayProductionItem(order)
  const subitemIds: Record<string, string> = {}
  for (const line of lines) {
    const { subitemId } = await createMondayProductionSubitem(itemId, line)
    subitemIds[line.quote_item_id] = subitemId
    await new Promise((r) => setTimeout(r, 300))
  }
  return { itemId, subitemIds }
}
```

- [x] **Step 2: Type-check + commit**

---

## Task 8: `StaffPermission` adds `'orders'` + `'orders:write'`

**Files:**
- Modify: `src/types/staff.ts`

- [x] **Step 1: Add literals**

Append to the `StaffPermission` union:

```ts
  | 'orders'
  | 'orders:write'
```

- [x] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [x] **Step 3: Commit**

---

## Task 9: `requireOrdersStaffAccess` helper

**Files:**
- Create: `src/lib/orders/server.ts`

- [x] **Step 1: Write** — exact mirror of [src/lib/products/server.ts:28-70](print-room-staff-portal/src/lib/products/server.ts#L28-L70), substituting `'orders'` / `'orders:write'` for the products keys:

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

export interface OrdersStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

export async function requireOrdersStaffAccess() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = getSupabaseAdmin()
  const { data: staff, error } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (error || !staff) return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }

  const typed = staff as StaffRow
  const perms = Array.isArray(typed.permissions) ? typed.permissions : []
  const isAdmin = typed.role === 'admin' || typed.role === 'super_admin'
  const hasOrdersPerm = perms.includes('orders') || perms.includes('orders:write')
  if (!isAdmin && !hasOrdersPerm) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typed.id,
      role: typed.role,
      isAdmin,
      displayName: typed.display_name,
    } satisfies OrdersStaffContext,
  }
}
```

- [x] **Step 2: Commit**

---

## Task 10: Orders types

**Files:**
- Create: `src/types/orders.ts`

- [x] **Step 1: Write**

```ts
export type OrderStatus =
  | 'awaiting-production'
  | 'in-production'
  | 'fulfilled'
  | 'shipped'
  | 'cancelled'

export interface OrderLineInput {
  product_id: string
  product_name: string
  variant_id: string | null
  quantity: number
  unit_price: number
  customizations?: Record<string, unknown> | null
}

export interface OrderSubmitRequest {
  idempotency_key: string
  organization_id: string
  customer_code: string
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  shipping_address: Record<string, unknown>
  payment_terms: string
  required_by?: string | null
  notes?: string | null
  internal_notes?: string | null
  lines: OrderLineInput[]
}

export interface OrderSubmitResponse {
  quote_id: string
  order_id: string
  order_ref: string
  monday_item_id: string | null
  monday_push_error: string | null
}
```

- [x] **Step 2: Commit**

---

## Task 11: `POST /api/pricing/quote-line`

**Files:**
- Create: `src/app/api/pricing/quote-line/route.ts`

**Acceptance criteria:**
- `POST { product_id, organization_id, quantity }` → `{ unit_price, total, tier_level, bracket: { min_quantity, max_quantity } | null }`.
- 403 without perm.
- 400 on invalid/missing fields.

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function POST(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  let body: { product_id?: string; organization_id?: string; quantity?: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { product_id, organization_id, quantity } = body
  if (!product_id || !organization_id || !quantity || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'product_id, organization_id, positive integer quantity required' }, { status: 400 })
  }

  const [priceResult, bracketResult, tierResult] = await Promise.all([
    auth.admin.rpc('get_unit_price', {
      p_product_id: product_id, p_org_id: organization_id, p_qty: quantity,
    }),
    auth.admin.from('product_pricing_tiers')
      .select('min_quantity, max_quantity, tier_level')
      .eq('product_id', product_id).eq('is_active', true)
      .lte('min_quantity', quantity)
      .order('min_quantity', { ascending: false }).limit(1).maybeSingle(),
    auth.admin.from('b2b_accounts').select('tier_level').eq('organization_id', organization_id).maybeSingle(),
  ])
  if (priceResult.error) return NextResponse.json({ error: priceResult.error.message }, { status: 500 })

  const unit_price = Number(priceResult.data ?? 0)
  return NextResponse.json({
    unit_price,
    total: Number((unit_price * quantity).toFixed(2)),
    tier_level: tierResult.data?.tier_level ?? 3,
    bracket: bracketResult.data
      ? { min_quantity: bracketResult.data.min_quantity, max_quantity: bracketResult.data.max_quantity }
      : null,
  })
}
```

- [x] **Step 2: cURL smoke** (deferred to Task 22 E2E — skipped to avoid `npm run dev` collision with 5 concurrent agents)

```bash
curl -X POST http://localhost:3000/api/pricing/quote-line \
  -H "Content-Type: application/json" -H "Cookie: sb-access-token=<TOKEN>" \
  -d '{"product_id":"<PROD>","organization_id":"<ORG>","quantity":100}'
# Expect: {"unit_price":X, "total":Y, "tier_level":Z, "bracket":{...}}
```

- [x] **Step 3: Commit**

---

## Task 12: `PATCH /api/organizations/[id]/customer-code`

**Files:**
- Create: `src/app/api/organizations/[id]/customer-code/route.ts`

**Acceptance criteria:**
- Body `{ customer_code: string }` — must match `/^[A-Z0-9]{2,6}$/`.
- Rejects with 409 on unique-constraint collision.
- 403 without perm.

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params
  let body: { customer_code?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const code = body.customer_code?.trim()
  if (!code || !/^[A-Z0-9]{2,6}$/.test(code)) {
    return NextResponse.json({ error: 'customer_code must be 2-6 uppercase letters or digits' }, { status: 400 })
  }

  const { error } = await auth.admin
    .from('organizations').update({ customer_code: code }).eq('id', id)
  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ ok: true, customer_code: code })
}
```

- [x] **Step 2: cURL smoke + commit** — cURL smoke deferred to Task 22 E2E.

---

## Task 13: `src/lib/orders/submit.ts` — submit orchestrator

**Files:**
- Create: `src/lib/orders/submit.ts`

**What it does:** 1) calls the `submit_b2b_order` RPC, 2) on success calls `pushProductionJob` from Monday helper, 3) writes back `quotes.monday_item_id` and `quote_items.monday_subitem_id`, 4) returns the combined response. If Monday push errors, returns with `monday_push_error` set — never throws from the HTTP handler's perspective.

- [x] **Step 1: Write**

```ts
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { OrderSubmitRequest, OrderSubmitResponse } from '@/types/orders'
import { pushProductionJob } from '@/lib/monday/production-job'

export async function submitB2BOrder(req: OrderSubmitRequest): Promise<OrderSubmitResponse> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin.rpc('submit_b2b_order', {
    p_idempotency_key: req.idempotency_key,
    p_organization_id: req.organization_id,
    p_customer_code: req.customer_code,
    p_customer_name: req.customer_name,
    p_customer_email: req.customer_email,
    p_customer_phone: req.customer_phone ?? null,
    p_shipping_address: req.shipping_address,
    p_payment_terms: req.payment_terms,
    p_required_by: req.required_by ?? null,
    p_notes: req.notes ?? null,
    p_internal_notes: req.internal_notes ?? null,
    p_lines: req.lines,
  })
  if (error) throw new Error(`submit_b2b_order failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  const { quote_id, order_id, order_ref } = row

  // Fetch full order + lines for Monday push.
  const pushResult = await tryPushMonday(admin, order_id, quote_id)

  return {
    quote_id,
    order_id,
    order_ref,
    monday_item_id: pushResult.monday_item_id,
    monday_push_error: pushResult.error,
  }
}

async function tryPushMonday(
  admin: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  quoteId: string
): Promise<{ monday_item_id: string | null; error: string | null }> {
  try {
    const { data: order } = await admin
      .from('quotes')
      .select('order_ref, customer_name, customer_email, total_amount, required_by, payment_terms, notes, monday_item_id')
      .eq('id', quoteId).single()
    if (!order) return { monday_item_id: null, error: 'quote not found' }

    const { data: lines } = await admin
      .from('quote_items')
      .select(`
        id, product_name, quantity, unit_price, customizations, monday_subitem_id,
        product_variants (
          color_swatch_id, size_id,
          product_color_swatches (label),
          sizes (label)
        )
      `)
      .eq('quote_id', quoteId)

    const productionOrder = {
      order_ref: order.order_ref,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      total_price: Number(order.total_amount),
      required_by: order.required_by,
      payment_terms: order.payment_terms,
      notes: order.notes,
      monday_item_id: order.monday_item_id,
    }

    const productionLines = (lines ?? []).map((l: any) => ({
      quote_item_id: l.id,
      product_name: l.product_name,
      variant_label: [
        l.product_variants?.product_color_swatches?.label,
        l.product_variants?.sizes?.label,
      ].filter(Boolean).join(' / ') || '—',
      quantity: l.quantity,
      unit_price: Number(l.unit_price),
      decoration_summary: null,
      existing_subitem_id: l.monday_subitem_id,
    }))

    const { itemId, subitemIds } = await pushProductionJob(productionOrder, productionLines)

    await admin.from('quotes').update({ monday_item_id: itemId }).eq('id', quoteId)
    for (const [quoteItemId, subitemId] of Object.entries(subitemIds)) {
      await admin.from('quote_items')
        .update({ monday_subitem_id: subitemId })
        .eq('id', quoteItemId)
    }
    return { monday_item_id: itemId, error: null }
  } catch (e) {
    return { monday_item_id: null, error: (e as Error).message }
  }
}

export async function retryMondayPush(orderId: string): Promise<{ monday_item_id: string | null; error: string | null }> {
  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('orders').select('quote_id').eq('id', orderId).single()
  if (!order) return { monday_item_id: null, error: 'order not found' }
  return tryPushMonday(admin, orderId, order.quote_id)
}
```

- [x] **Step 2: Commit**

---

## Task 14: `POST /api/orders` — submit

**Files:**
- Create: `src/app/api/orders/route.ts`

**Acceptance criteria:**
- Body matches `OrderSubmitRequest`. Required: `idempotency_key`, `organization_id`, `customer_code`, `customer_name`, `customer_email`, `shipping_address`, `payment_terms`, `lines` (≥1).
- 400 on validation failure (itemises missing fields).
- 409 with `{ error: 'OUT_OF_STOCK', line_index: N }` if any line fails reservation (parses from Postgres error message — `reserve_quote_line` raises SQLSTATE P0001 with message `OUT_OF_STOCK`).
- 200 on success with `OrderSubmitResponse`.
- Also implements `GET` for the list page (filters: `org_id`, `status`, `from`, `to`, `limit`, `offset`).

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { submitB2BOrder } from '@/lib/orders/submit'
import type { OrderSubmitRequest } from '@/types/orders'

export async function POST(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  let body: Partial<OrderSubmitRequest>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const missing: string[] = []
  for (const k of ['idempotency_key','organization_id','customer_code','customer_name','customer_email','shipping_address','payment_terms'] as const) {
    if (!body[k]) missing.push(k)
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) missing.push('lines')
  if (missing.length) return NextResponse.json({ error: 'Missing fields', missing }, { status: 400 })

  try {
    const result = await submitB2BOrder(body as OrderSubmitRequest)
    return NextResponse.json(result)
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('OUT_OF_STOCK')) {
      return NextResponse.json({ error: 'OUT_OF_STOCK' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 25)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))

  let q = auth.admin.from('orders')
    .select(`
      id, status, total_price, placed_at, quote_id,
      quotes!inner (
        order_ref, customer_name, organization_id, required_by,
        organizations:organization_id ( name )
      )
    `, { count: 'exact' })
    .order('placed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (p.get('status')) q = q.eq('status', p.get('status')!)
  if (p.get('org_id')) q = q.eq('quotes.organization_id', p.get('org_id')!)
  if (p.get('from')) q = q.gte('placed_at', p.get('from')!)
  if (p.get('to')) q = q.lte('placed_at', p.get('to')!)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [], total: count ?? 0, limit, offset })
}
```

- [x] **Step 2: cURL smoke** — submit an order; rerun with same idempotency_key (expect identical response). _Deferred to Task 22 E2E per plan addendum._

- [x] **Step 3: Commit**

---

## Task 15: `GET /api/orders/[id]` and `DELETE` (cancel)

**Files:**
- Create: `src/app/api/orders/[id]/route.ts`

**Acceptance criteria:**
- `GET` returns order + joined quote + lines (with variant color/size labels) + b2b_account info.
- `DELETE` (cancel): rejects 409 if ANY line has a Monday subitem in `dispatched` status (requires checking `job_trackers` or a stored status on quote_items — v1 uses `variant_inventory_events` to detect `order_ship` presence). On accept: calls `release_quote_line(line_id, 'cancelled')` for each line, sets `orders.status = 'cancelled'`.
- 403 without perm.

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  const { data: order, error } = await auth.admin
    .from('orders')
    .select(`
      id, status, total_price, placed_at, account_id,
      quotes!inner (
        id, order_ref, customer_name, customer_email, customer_phone,
        organization_id, required_by, payment_terms, notes, internal_notes,
        shipping_address, monday_item_id,
        organizations:organization_id ( id, name, customer_code )
      )
    `)
    .eq('id', id).single()
  if (error || !order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lines } = await auth.admin
    .from('quote_items')
    .select(`
      id, product_id, product_name, quantity, unit_price, total_price,
      variant_id, monday_subitem_id, customizations,
      product_variants (
        color_swatch_id, size_id,
        product_color_swatches (label, hex),
        sizes (label, order_index)
      )
    `)
    .eq('quote_id', (order.quotes as any).id)

  return NextResponse.json({ order, lines: lines ?? [] })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  const { data: order } = await auth.admin.from('orders').select('quote_id, status').eq('id', id).single()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status === 'cancelled') return NextResponse.json({ ok: true, note: 'already cancelled' })

  const { data: lines } = await auth.admin
    .from('quote_items').select('id').eq('quote_id', order.quote_id)
  const lineIds = (lines ?? []).map((l) => l.id)

  // Block cancel if any line has already shipped (order_ship event exists).
  const { count } = await auth.admin
    .from('variant_inventory_events')
    .select('*', { count: 'exact', head: true })
    .in('reference_quote_item_id', lineIds).eq('reason', 'order_ship')
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Cannot cancel — some lines have shipped' }, { status: 409 })
  }

  for (const lineId of lineIds) {
    const { error: rErr } = await auth.admin.rpc('release_quote_line', {
      p_quote_item_id: lineId, p_reason: 'cancelled',
    })
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  }
  await auth.admin.from('orders').update({ status: 'cancelled' }).eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [x] **Step 2: cURL smoke + commit**

---

## Task 16: `PATCH` + `DELETE` line item

**Files:**
- Create: `src/app/api/orders/[id]/lines/[lineId]/route.ts`

**Acceptance criteria:**
- `PATCH { quantity?: number, variant_id?: string }`:
  - qty change: reads current `quote_items.quantity`, calls `adjust_quote_line_delta(lineId, old_qty, new_qty)`. On success, also updates `quote_items.quantity` and `total_price`.
  - variant change: `release_quote_line(old)` → update `variant_id` → `reserve_quote_line(new)`. Rollback manually if the reserve throws.
- `DELETE`: calls `release_quote_line` then deletes the line.
- Both 409 if `order_ship` already recorded on that line (post-ship immutable).

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

async function isShipped(admin: any, lineId: string) {
  const { count } = await admin
    .from('variant_inventory_events')
    .select('*', { count: 'exact', head: true })
    .eq('reference_quote_item_id', lineId).eq('reason', 'order_ship')
  return (count ?? 0) > 0
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { lineId } = await params
  if (await isShipped(auth.admin, lineId)) {
    return NextResponse.json({ error: 'Line already shipped — edits disabled' }, { status: 409 })
  }
  let body: { quantity?: number; variant_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: line, error: lErr } = await auth.admin
    .from('quote_items').select('quantity, unit_price, variant_id').eq('id', lineId).single()
  if (lErr || !line) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

  if (typeof body.quantity === 'number' && body.quantity !== line.quantity) {
    if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be positive int' }, { status: 400 })
    }
    const { error: rErr } = await auth.admin.rpc('adjust_quote_line_delta', {
      p_quote_item_id: lineId, p_old_qty: line.quantity, p_new_qty: body.quantity,
    })
    if (rErr) {
      const status = rErr.message?.includes('OUT_OF_STOCK') ? 409 : 500
      return NextResponse.json({ error: rErr.message }, { status })
    }
    await auth.admin.from('quote_items')
      .update({
        quantity: body.quantity,
        total_price: Number(line.unit_price) * body.quantity,
      })
      .eq('id', lineId)
  }

  if (body.variant_id && body.variant_id !== line.variant_id) {
    const { error: relErr } = await auth.admin.rpc('release_quote_line', {
      p_quote_item_id: lineId, p_reason: 'variant_change',
    })
    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 })
    await auth.admin.from('quote_items').update({ variant_id: body.variant_id }).eq('id', lineId)
    const { error: resErr } = await auth.admin.rpc('reserve_quote_line', { p_quote_item_id: lineId })
    if (resErr) {
      // Roll back: re-reserve old variant, flip variant_id back.
      await auth.admin.from('quote_items').update({ variant_id: line.variant_id }).eq('id', lineId)
      await auth.admin.rpc('reserve_quote_line', { p_quote_item_id: lineId })
      const status = resErr.message?.includes('OUT_OF_STOCK') ? 409 : 500
      return NextResponse.json({ error: resErr.message }, { status })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { lineId } = await params
  if (await isShipped(auth.admin, lineId)) {
    return NextResponse.json({ error: 'Line already shipped' }, { status: 409 })
  }
  const { error: rErr } = await auth.admin.rpc('release_quote_line', {
    p_quote_item_id: lineId, p_reason: 'line_removed',
  })
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  const { error: dErr } = await auth.admin.from('quote_items').delete().eq('id', lineId)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [x] **Step 2: cURL smoke (edit up, edit down, variant swap, delete) + commit** (cURL deferred to Task 22)

---

## Task 17: `POST /api/orders/[id]/monday-reconcile`

**Files:**
- Create: `src/app/api/orders/[id]/monday-reconcile/route.ts`

**Acceptance criteria:**
- Calls `retryMondayPush(orderId)`. Returns `{ monday_item_id, error }`.
- Idempotent — re-pushing an already-pushed order is a no-op (the helper skips existing item/subitems).

- [x] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { retryMondayPush } from '@/lib/orders/submit'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params
  const result = await retryMondayPush(id)
  return NextResponse.json(result)
}
```

- [x] **Step 2: Commit**

---

## Task 18: UI — `/orders/new` (order entry form)

**Files:**
- Create: `src/app/(portal)/orders/new/page.tsx`
- Create: `src/components/orders/OrderFormClient.tsx` (`'use client'`)
- Create: `src/components/orders/CompanySection.tsx`
- Create: `src/components/orders/ShipToSection.tsx`
- Create: `src/components/orders/LineItemsTable.tsx`
- Create: `src/components/orders/LineItemRow.tsx`
- Create: `src/components/orders/TermsSection.tsx`
- Create: `src/components/orders/SummaryPanel.tsx`

**Acceptance criteria (from spec §6):**
- Page server-renders the empty shell; `OrderFormClient` owns form state.
- Company section: typeahead `organizations.name`; on select, shows customer_code (inline 3–6-char editor if blank — calls PATCH endpoint). Displays tier_level, payment_terms, credit_limit (read-only) from `b2b_accounts`. Flag: stocked-inventory (boolean from presence of `variant_inventory` rows for that org).
- Ship-to: dropdown from `stores` for that org + "Custom address" fallback. Checkbox "Save as store" → adds `stores` row on submit.
- Line items: product typeahead (`products` where `is_active`, filter `platform='b2b'` optional), variant picker (color+size → upserts `product_variants` via `POST /api/products/[id]/variants` from spec #1 plan), qty, unit_price (fetched via `/api/pricing/quote-line` on qty change; editable with a visual "override" marker), live `available: N` pill when org has `variant_inventory` for the variant.
- Submit disabled when: any required field blank, any line's qty > available (stocked), or a client-generated idempotency_key is missing.
- On submit: POST to `/api/orders`; on 200, router-push to `/orders/<id>`; on 409 `OUT_OF_STOCK`, show red banner identifying the offending line.

- [ ] **Step 1: `page.tsx` (server)**

```tsx
import { redirect } from 'next/navigation'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { OrderFormClient } from '@/components/orders/OrderFormClient'

export const dynamic = 'force-dynamic'

export default async function NewOrderPage() {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) redirect('/dashboard')
  return <OrderFormClient />
}
```

- [ ] **Step 2: `OrderFormClient.tsx`** (`'use client'`)

Full top-level form. State shape:
```ts
{
  organization: { id, name, customer_code } | null,
  b2bAccount: { tier_level, payment_terms, credit_limit, default_deposit_percent } | null,
  stocked: boolean,
  shipTo: { storeId: string | null, address: { line1, city, state, postalCode, country, phone } } | { storeId: null, address: {...}, saveAsStore: boolean },
  lines: Array<{ tmpId, productId, productName, variantId, colorSwatchId, sizeId, quantity, unitPrice, unitPriceOverride, availableQty }>,
  terms: { paymentTerms, depositPercent, requiredBy },
  notes: string,
  internalNotes: string,
  idempotencyKey: string,   // crypto.randomUUID() set once on mount
  submitting: boolean,
  error: { message, lineIndex: number | null } | null,
}
```

Layout: two-column grid `grid-cols-1 lg:grid-cols-[1fr_320px]`, summary panel sticky `top-4` on the right.

Render `<CompanySection>`, `<ShipToSection>`, `<LineItemsTable>`, `<TermsSection>`, `<textarea>` x2 (notes, internal_notes), `<SummaryPanel>`.

Submit handler:
```ts
async function onSubmit() {
  const body = {
    idempotency_key: state.idempotencyKey,
    organization_id: state.organization!.id,
    customer_code: state.organization!.customer_code,
    customer_name: state.organization!.name,
    customer_email: state.b2bAccount?.payment_terms ? '...' : 'csr@theprint-room.co.nz',
    shipping_address: state.shipTo.address,
    payment_terms: state.terms.paymentTerms,
    required_by: state.terms.requiredBy,
    notes: state.notes, internal_notes: state.internalNotes,
    lines: state.lines.map((l) => ({
      product_id: l.productId, product_name: l.productName,
      variant_id: l.variantId, quantity: l.quantity, unit_price: l.unitPrice,
    })),
  }
  const res = await fetch('/api/orders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) {
    setError({ message: json.error, lineIndex: null })
    return
  }
  router.push(`/orders/${json.order_id}`)
}
```

- [ ] **Step 3: Section components**

- `CompanySection.tsx` — typeahead against `/api/organizations/search?q=` (reuse endpoint from spec #1 Task 20 if shipped; else add a minimal one in this task). On select, fetches `b2b_accounts` (GET `/api/b2b-accounts?organization_id=X` — minimal new endpoint, or inline Supabase fetch via a new API route). Shows inline customer-code editor when blank; POSTs to `/api/organizations/[id]/customer-code`.
- `ShipToSection.tsx` — select from `/api/stores?organization_id=X` (new minimal GET endpoint OR reuse one if exists). "Custom address" fills inline form; "Save as store" checkbox stored in state (not written in this task — requires a separate stores insert step in `submitB2BOrder` which v1 does not do; flag as follow-up if user wants it).
- `LineItemsTable.tsx` — renders `LineItemRow`s plus a "+ Add line" button. Tab order: product → variant → qty → unit-price → next line. Enter in qty moves focus to the next line.
- `LineItemRow.tsx` — product typeahead (re-use `/api/products/search?q=`). On product select, queries variants via `GET /api/products/[id]/variants` (spec #1 Task 13) OR shows color+size pickers that upsert via `POST /api/products/[id]/variants` when user commits. Live stock pill fetched from `/api/inventory/[orgId]/variants?product_id=X` (spec #1 Task 16). Debounce pricing calls to `/api/pricing/quote-line` at 300ms.
- `TermsSection.tsx` — payment terms `<select>`, deposit % `<input>`, required-by `<input type="date">`.
- `SummaryPanel.tsx` — pure presentational: subtotal (sum of `qty * unit_price`), deposit (subtotal × depositPercent/100), balance, line count, out-of-stock flag list.

- [ ] **Step 4: Manual verification** — full happy path with a seeded org + product. Check keyboard flow.

- [ ] **Step 5: Commit**

---

## Task 19: UI — `/orders` list

**Files:**
- Create: `src/app/(portal)/orders/page.tsx`
- Create: `src/components/orders/OrdersList.tsx`

**Acceptance criteria (spec §9.1):**
- Server component; reads `searchParams` for filters (`status`, `org_id`, `from`, `to`, `page`).
- Fetches `/api/orders` server-side (call the handler via the supabase admin client directly to avoid self-HTTP).
- Columns: order_ref, org, submitted_at, required_by, line count, total, status.
- Filter form posts via URL-change (client component wrapping inputs, submit resets `page=1`).
- Pagination `prev`/`next` using `limit=25` default.

- [x] **Step 1: Write the page** — server fetches via `requireOrdersStaffAccess` + direct SELECT on `orders` join `quotes` join `organizations`.

- [x] **Step 2: Write `OrdersList.tsx`** — presentational.

- [ ] **Step 3: Manual check** — create two orders (task 18), land on list, confirm both appear, filters work.

- [x] **Step 4: Commit**

---

## Task 20: UI — `/orders/[id]` detail

**Files:**
- Create: `src/app/(portal)/orders/[id]/page.tsx`
- Create: `src/components/orders/OrderDetailClient.tsx` (`'use client'`)
- Create: `src/components/orders/LineEditRow.tsx`

**Acceptance criteria (spec §9.2):**
- Header shows `order_ref`, org name, `submitted_at`, status, total. "Copy ref" button.
- Line table: qty & variant inline editable (calls PATCH from Task 16). "Remove line" with confirm (calls DELETE).
- "Cancel order" button (red, confirm dialog) → DELETE `/api/orders/[id]`.
- If `monday_item_id` is null (push failed), show "Retry Monday push" button → POST `/api/orders/[id]/monday-reconcile`.
- If any line has an `order_ship` event, lock all edits with a yellow banner: "Some items shipped — edits disabled."
- Sidebar: Monday item link (`https://theprintroom.monday.com/boards/<PRODUCTION_BOARD_ID>/pulses/<monday_item_id>` if set), Xero link placeholder (null in v1).

- [ ] **Step 1: Write the page** — server fetches via `requireOrdersStaffAccess` and Task 15's SELECT.

- [ ] **Step 2: `OrderDetailClient.tsx`** — accepts props, owns edit state.

- [ ] **Step 3: `LineEditRow.tsx`** — inline editor for one line.

- [ ] **Step 4: Manual check** — create order, edit qty down, edit qty up (within stock), try over-commit (expect 409 red banner), cancel order (confirm release events written).

- [ ] **Step 5: Commit**

---

## Task 21: Sidebar entry for Orders

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [x] **Step 1: Add `ShoppingCart` to the lucide imports** (line 33 area):

```tsx
  Package,
  ShoppingCart,
  Boxes,  // (already added by spec #1 plan — skip if already present)
} from 'lucide-react'
```

- [x] **Step 2: Insert new section between Quote Tool and Products** (after existing quote-tool entry around line 83):

```tsx
  {
    id: 'orders' as const,
    label: 'Orders',
    icon: ShoppingCart,
    permission: 'orders',
    items: [
      { label: 'All Orders', href: '/orders', icon: ShoppingCart },
      { label: 'New Order', href: '/orders/new', icon: FilePlus },
    ],
  },
```

- [x] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Note: the `NavSection.id` union already accepts `StaffPermission`, which now includes `'orders'`. No type change needed.

- [x] **Step 4: Visual check + commit**

---

## Task 22: End-to-end verification (spec §13)

Manual run-through on dev. Each step sits behind a checkbox.

- [ ] **Step 1: Seed Bike Glendhu** — create an `organizations` row with `name='Bike Glendhu'`. Set `customer_code='BIK'` via the PATCH endpoint (Task 12). Create one `stores` row linked to that org.

- [ ] **Step 2: Seed b2b_accounts manually** (since submit will auto-create if missing, but §13 wants tier_level=2):

```sql
insert into b2b_accounts (organization_id, tier_level, payment_terms, default_deposit_percent, platform, company_name, is_trusted)
  values ('<BIK>', 2, 'net_20', 0, 'b2b', 'Bike Glendhu', true);
```

- [ ] **Step 3: Seed inventory** — use spec #1's `/inventory` UI to track a product, receive 10 units into Black/M.

- [ ] **Step 4: Submit the order** via `/orders/new`:
  - Company: Bike Glendhu.
  - Ship-to: the seeded store.
  - Line A: the stocked product → Black/M × 5.
  - Line B: a made-to-order product → Navy/L × 50.
  - Line C: same MTO product → Navy/XL × 50.
  - Terms: default net_20, deposit 0%, no required-by.

- [ ] **Step 5: Assert** via `mcp__supabase__execute_sql`:

```sql
select order_ref from quotes where idempotency_key = '<IDK>';
-- expect BIK-000001

select product_name, unit_price, quantity, variant_id from quote_items
  where quote_id = (select id from quotes where order_ref = 'BIK-000001');
-- expect 3 rows, unit_price = bracket × 0.95 (Tier 2 = 5% off).

select stock_qty, committed_qty from variant_inventory
  where variant_id = '<BLACK_M_VARIANT>';
-- expect stock_qty=10, committed_qty=5.

select reason, delta_committed from variant_inventory_events
  where reference_quote_item_id in (select id from quote_items where quote_id = ...);
-- expect order_commit rows.

select monday_item_id from quotes where order_ref = 'BIK-000001';
-- expect non-null (or test fails — check Monday API token).

select monday_subitem_id from quote_items where quote_id = ... ;
-- expect non-null for all 3 lines.
```

- [ ] **Step 6: Over-commit test** — repeat the form, Black/M × 10 (only 5 available). Expect 409 banner "OUT_OF_STOCK", no new rows.

```sql
select count(*) from quotes where idempotency_key = '<NEW_IDK>';
-- expect 0 (all writes rolled back).
```

- [ ] **Step 7: Pre-ship edit** — on `/orders/<id>`, reduce line A qty 5 → 3.

```sql
select committed_qty from variant_inventory where variant_id = '<BLACK_M_VARIANT>';
-- expect 3 (10 - 7 = 3).
-- There was no line ship yet, so: started stock=10, committed=5, then adjust(5,3): delta=-2, committed=3. Stock still 10.

select reason, delta_committed from variant_inventory_events
  where reference_quote_item_id = '<LINE_A_ID>' order by created_at desc;
-- expect a row with reason='order_release', delta_committed=-2.
```

- [ ] **Step 8: Cancel the order** — click Cancel on detail page, confirm.

```sql
select status from orders where id = '<ORD>';
-- expect 'cancelled'.

select committed_qty from variant_inventory where variant_id = '<BLACK_M_VARIANT>';
-- expect 0 (released the remaining 3).
```

- [ ] **Step 9: Idempotency** — POST `/api/orders` twice with the same `idempotency_key`. Second call returns same `order_ref`, no duplicate rows.

```sql
select count(*) from quotes where idempotency_key = '<IDK>';
-- expect 1 after both calls.
```

- [ ] **Step 10: UX verification** (manual)
  - Non-permissioned staff: `/orders` redirects to `/dashboard`, `/api/orders` returns 403.
  - Tab flow from company → ship-to → each line (qty) → next line works.
  - Sticky summary recalculates on every keystroke.
  - Submit button disabled when Black/M line qty > available.

---

# Appendix — Test plan summary

- **SQL/DB tests:** Tasks 1, 2, 3, 4 — all via `mcp__supabase__execute_sql`, wrapped in `begin…rollback`.
- **HTTP/API tests:** Tasks 11, 12, 14, 15, 16, 17 — cURL smoke against `npm run dev`.
- **UI/manual:** Tasks 18, 19, 20, 21.
- **End-to-end integration:** Task 22 — the §13 walk-through.

# Appendix — Shared contracts this plan establishes (consumed by spec #4)

- **Function:** `get_unit_price(product_id, org_id, qty)` — used identically by customer-portal checkout.
- **Function:** `submit_b2b_order(...)` — reusable for customer checkout (with a lightweight wrapper for its customer-UI fields).
- **Function:** `allocate_order_ref(customer_code)`.
- **Column adds:** `quotes.order_ref`, `organizations.customer_code`, `b2b_accounts.organization_id`.
- **Sequence:** `order_number_seq`.
- **Helper file:** `src/lib/monday/production-job.ts` — spec #4 duplicates this into the customer-portal repo (per spec's explicit call-out in §12; the two repos cannot share code without a monorepo or package).
- **Permission keys:** `'orders'`, `'orders:write'`.

Spec #4 (Customer B2B Checkout MVP) should reference this plan path:
`print-room-staff-portal/docs/superpowers/plans/2026-04-20-staff-portal-b2b-order-entry-csr-plan.md`
