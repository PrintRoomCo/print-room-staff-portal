# Quote Builder — Completion & Supersede Replit Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three gaps in the existing staff quote builder — persistence (POST/PATCH/DELETE), approval action, and Monday push — so approved quotes land on the production board and the external Replit quote builder becomes optional.

**Architecture:** Minimal surface area added around the existing 80% implementation. Extend `staff_quotes` with approval audit columns. Add new API verbs to existing `/api/quote-tool/quotes` routes. Add `/approve` and `/retry-push` sub-routes. Persist per-line Monday subitem IDs inside `quote_data.items[i].monday_subitem_id` — no `quote_items` rows introduced (quotes are not orders and don't reserve stock per spec §3). Reuse the CSR plan's Monday helper (`src/lib/monday/production-job.ts`) — or create it if the CSR plan hasn't shipped yet.

**Tech Stack:** Next.js 16 (App Router, async `params`), Supabase, Tailwind v4, TypeScript, Monday GraphQL via the shared client, MCP `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql`.

**Repo:** `print-room-staff-portal` only.

**Next.js 16 note (AGENTS.md):** re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `dynamic-routes.md` before writing any new route handler.

**Depends on:**
- Inventory plan — no runtime dependency (quotes don't reserve stock). §12 step 9 explicitly asserts no `variant_inventory` change.
- CSR plan — depends on `src/lib/monday/production-job.ts`, `src/lib/monday/client.ts`, `src/lib/monday/column-ids.ts`. If the CSR plan has already shipped, import. If not, this plan creates these files as part of Task 9. Either way, the CSR plan should later import them unchanged.
- Reference: `print-room-staff-portal/docs/superpowers/plans/2026-04-20-staff-portal-b2b-order-entry-csr-plan.md`

---

## Current state (from codebase inspection)

**Live `staff_quotes` schema** — already has most of the spec's fields: `id, staff_user_id, customer_name, customer_email, customer_company, customer_phone, status text default 'draft', quote_data jsonb NOT NULL, design_snapshots jsonb, subtotal, discount_percent, total, staff_notes, valid_until, monday_item_id, created_at, updated_at, submitted_quote_id`. Missing: `approved_at, approved_by, monday_board_id`.

**Existing API** at [src/app/api/quote-tool/quotes/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/route.ts) and [[id]/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/[id]/route.ts): only `GET` methods. Inline auth check. No POST/PATCH/DELETE/approve.

**Existing UI** under `src/app/(portal)/quote-tool/` — `new/page.tsx`, `[id]/edit/page.tsx`, `quotes/page.tsx`, `quotes/[id]/page.tsx`, `design-tool/page.tsx`, plus 16 components in `src/components/quote-builder/`. `QuoteForm.tsx` is the main form component.

**Existing types** at [src/lib/quote-builder/types.ts](print-room-staff-portal/src/lib/quote-builder/types.ts): `QuoteStatus = 'created'|'draft'|'sent'|'accepted'|'declined'|'expired'|'archived'`. No `'approved'` or `'cancelled'` yet. `QuoteDraft` is camelCase (`customerName`, `quoteReference`, `priceTier`, `customDiscount`, `items`, `orderExtras`).

**Existing pricing** at [src/lib/quote-builder/pricing.ts](print-room-staff-portal/src/lib/quote-builder/pricing.ts): multiplier-based (`getProductSellingPrice`, `applyPriceTierDiscount`, `calculateQuoteTotal`) — keep unchanged per spec §3.

---

## Ambiguities resolved (override in review if wrong)

1. **`QuoteStatus` drift.** Existing union has `'accepted'/'declined'` (Replit-era). Spec §5.1 wants `'approved'/'cancelled'`. Resolution: **add** `'approved'` and `'cancelled'` to the union and `QUOTE_STATUS_OPTIONS`; keep the old values for back-compat; document `'accepted'/'declined'` as deprecated (nothing in-app will produce them anymore but old rows may have them).
2. **Server-side total recompute.** Spec §6.1 says "Computes and persists... so the list view doesn't have to recompute." Resolution: **trust client-submitted totals** for v1. Server validates that `subtotal`, `discount_percent`, `total` are finite non-negative numbers and that `total = subtotal - (subtotal * discount_percent / 100) + orderExtrasTotal` within 1¢ tolerance. Full server-side recompute (load reference data, run `calculateQuoteTotal`) is a defense-in-depth follow-up noted in the plan appendix.
3. **Monday helper signature.** Spec §8 sketches `pushProductionJob({ refLabel, customerName, totalNZD, lines: [{ variantLabel, qty, unitPrice, decorationSummary }] })`. CSR plan committed to `pushProductionJob(order: ProductionOrder, lines: ProductionLine[])` with `order.order_ref/customer_name/total_price` and `line.quote_item_id/product_name/variant_label/quantity/unit_price/decoration_summary`. Resolution: **use the CSR plan's existing signature verbatim**. Quote builder constructs a `ProductionOrder` with `order_ref = staff_quotes.id.slice(0,8).toUpperCase() prefixed 'Q-'` and `ProductionLine.quote_item_id = "quote-line-<index>"` (synthetic; maps back to `quote_data.items[i]`).
4. **Monday helper ownership.** Task 9 creates `src/lib/monday/*` only if absent — idempotent check. If CSR plan shipped first, these three files already exist and Task 9 is a no-op. If this plan ships first, it owns the files and CSR plan imports unchanged.
5. **Auth.** Extract `requireQuotesStaffAccess({ needApproval?: boolean })` into `src/lib/quotes/server.ts`. Refactor existing GETs to use it. Accepts `'quotes'` or `'quotes:write'` for general; requires `'quotes:approve'` OR admin role for approval calls.
6. **Approval validation.** Allow approval when `status IN ('draft','sent','created')`. Reject otherwise (including existing `'accepted'`/`'declined'` legacy values — staff can manually edit those old rows before approving, or leave them untouched).
7. **Idempotency on approve.** If `status='approved' AND monday_item_id IS NOT NULL`, return 200 with the existing row (no-op). If `status='approved' AND monday_item_id IS NULL`, run push only.

---

## File structure

### New files

- `src/lib/quotes/server.ts` — `requireQuotesStaffAccess({ needApproval })`
- `src/lib/quotes/approve.ts` — approval orchestrator (tries Monday push, writes back IDs)
- `src/lib/quotes/validation.ts` — small payload validator (totals sanity, status transitions)
- `src/app/api/quote-tool/quotes/[id]/approve/route.ts` — POST
- `src/app/api/quote-tool/quotes/[id]/retry-push/route.ts` — POST
- `src/lib/monday/client.ts` — if not already shipped by CSR plan
- `src/lib/monday/column-ids.ts` — if not already shipped by CSR plan
- `src/lib/monday/production-job.ts` — if not already shipped by CSR plan

### Modified files

- `src/app/api/quote-tool/quotes/route.ts` — add POST, refactor GET to use new auth helper
- `src/app/api/quote-tool/quotes/[id]/route.ts` — add PATCH + DELETE, refactor GET
- `src/lib/quote-builder/types.ts` — add `'approved'` + `'cancelled'` to `QuoteStatus` and `QUOTE_STATUS_OPTIONS`
- `src/types/staff.ts` — add `'quotes:write'` + `'quotes:approve'` to `StaffPermission`
- `src/components/quote-builder/QuoteForm.tsx` — wire save/autosave to new API
- `src/app/(portal)/quote-tool/new/page.tsx` — wire Save-and-go behaviour
- `src/app/(portal)/quote-tool/[id]/edit/page.tsx` — wire autosave
- `src/app/(portal)/quote-tool/quotes/[id]/page.tsx` — add Approve button + retry-push affordance + locked-edit state
- `src/components/quote-builder/QuotesTable.tsx` — add approved-status badge rendering (if not already supported via QuoteStatusBadge)
- `src/components/quote-builder/QuoteStatusBadge.tsx` — ensure approved + cancelled badges render

### Migrations

- `20260420_quote_builder_approval_columns` — `approved_at`, `approved_by`, `monday_board_id`

---

# Tasks

## Task 1: Add approval-audit columns to `staff_quotes`

**Acceptance criteria:**
- `approved_at timestamptz`, `approved_by uuid references staff_users(id)`, `monday_board_id text` exist.
- All nullable.

- [x] **Step 1: Apply**

Invoke `mcp__supabase__apply_migration` with `name = "20260420_quote_builder_approval_columns"`:

```sql
alter table staff_quotes
  add column approved_at timestamptz,
  add column approved_by uuid references staff_users(id),
  add column monday_board_id text;
```

(Note: no new indexes on `status` or `staff_user_id` — those are already covered by `idx_staff_quotes_status` and `idx_staff_quotes_staff_user` from the original `create_staff_quotes_table` migration.)

- [x] **Step 2: Verify**

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='staff_quotes'
   and column_name in ('approved_at','approved_by','monday_board_id')
 order by column_name;
-- expect: 3 rows
```

- [x] **Step 3: Commit** the plan doc.

- [x] **Step 4: Follow-up migration** — applied `20260421_staff_quotes_cleanup_and_status_check` to drop duplicate indexes (`staff_quotes_status_idx`, `staff_quotes_staff_user_idx` — covered by existing `idx_staff_quotes_status` / `idx_staff_quotes_staff_user` from the original table migration) and relax `staff_quotes_status_check` to include the full QuoteStatus union from Task 2 (`created`, `draft`, `sent`, `approved`, `cancelled`, `accepted`, `declined`, `rejected`, `expired`, `archived`, `converted`).

---

## Task 2: Extend `QuoteStatus` + option list

**Files:**
- Modify: `src/lib/quote-builder/types.ts`

**Acceptance:**
- `QuoteStatus` union includes `'approved'` and `'cancelled'`.
- `QUOTE_STATUS_OPTIONS` includes both with labels `'Approved'` and `'Cancelled'`.
- `npx tsc --noEmit` clean.

- [x] **Step 1: Update the union** (replace the existing `QuoteStatus` declaration at line 1-8):

```ts
export type QuoteStatus =
  | 'created'
  | 'draft'
  | 'sent'
  | 'approved'
  | 'cancelled'
  | 'accepted'   // deprecated; legacy rows only
  | 'declined'   // deprecated; legacy rows only
  | 'expired'
  | 'archived'
```

- [x] **Step 2: Update `QUOTE_STATUS_OPTIONS`** (replace lines 310-317):

```ts
export const QUOTE_STATUS_OPTIONS: Array<{ label: string; value: QuoteStatus }> = [
  { label: 'Created', value: 'created' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Expired', value: 'expired' },
]
```

(Deliberately omit `accepted`/`declined` from the dropdown — they're deprecated; old rows still render via the badge.)

- [x] **Step 3: Type-check**

```bash
cd c:/Users/MSI/Documents/Projects/print-room-staff-portal
npx tsc --noEmit
```

- [x] **Step 4: Commit**

```bash
git add src/lib/quote-builder/types.ts
git commit -m "feat(quotes): add approved + cancelled to QuoteStatus"
```

---

## Task 3: `StaffPermission` adds `'quotes:write'` + `'quotes:approve'`

**Files:**
- Modify: `src/types/staff.ts`

- [x] **Step 1: Add literals**

Append to the `StaffPermission` union (after the existing additions from the inventory/orders plans):

```ts
  | 'quotes:write'
  | 'quotes:approve'
```

- [x] **Step 2: Type-check + commit**

---

## Task 4: `requireQuotesStaffAccess` auth helper

**Files:**
- Create: `src/lib/quotes/server.ts`

**Acceptance criteria:**
- Returns `{ admin, context }` on success.
- 401 on no auth user; 403 on missing/inactive staff; 403 on missing permission.
- `{ needApproval: true }` requires `'quotes:approve'` OR admin/super_admin role.
- General access accepts `'quotes:write'` OR the legacy `'quote-tool'` permission OR admin/super_admin role (so existing staff don't lose access the day this ships).

- [x] **Step 1: Write**

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

export interface QuotesStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  canApprove: boolean
  displayName: string
}

export async function requireQuotesStaffAccess(
  opts: { needApproval?: boolean } = {}
) {
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
  const hasWrite =
    perms.includes('quotes:write') ||
    perms.includes('quote-tool') // legacy sidebar key
  const canApprove = isAdmin || perms.includes('quotes:approve')

  if (!isAdmin && !hasWrite) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }
  if (opts.needApproval && !canApprove) {
    return { error: NextResponse.json({ error: 'Approval permission required' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typed.id,
      role: typed.role,
      isAdmin,
      canApprove,
      displayName: typed.display_name,
    } satisfies QuotesStaffContext,
  }
}
```

- [x] **Step 2: Commit**

---

## Task 5: Refactor existing GETs to use the helper

**Files:**
- Modify: `src/app/api/quote-tool/quotes/route.ts` (GET)
- Modify: `src/app/api/quote-tool/quotes/[id]/route.ts` (GET)

**Acceptance:** behaviour unchanged; auth inlined code replaced by `requireQuotesStaffAccess()`.

- [x] **Step 1: Rewrite list GET** in [route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/route.ts):

```ts
import { NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export async function GET(request: Request) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error

  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 25)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))
  const mineOnly = p.get('mine') === '1'
  const status = p.get('status')

  let q = auth.admin
    .from('staff_quotes')
    .select(
      'id, customer_name, customer_email, customer_company, status, subtotal, discount_percent, total, staff_notes, monday_item_id, approved_at, created_at, updated_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!auth.context.isAdmin || mineOnly) q = q.eq('staff_user_id', auth.context.staffId)
  if (status) q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data ?? [], total: count ?? 0, limit, offset })
}
```

- [x] **Step 2: Rewrite detail GET** in [[id]/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/[id]/route.ts):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let q = auth.admin.from('staff_quotes').select('*').eq('id', id)
  if (!auth.context.isAdmin) q = q.eq('staff_user_id', auth.context.staffId)

  const { data, error } = await q.single()
  if (error || !data) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ quote: data })
}
```

- [x] **Step 3: Manual smoke** — fetch list and detail still work as the existing UI expects.

- [x] **Step 4: Commit**

---

## Task 6: Quote payload validator

**Files:**
- Create: `src/lib/quotes/validation.ts`

**Acceptance:**
- `validateQuotePayload(body)` returns `{ ok: true, data }` or `{ ok: false, errors }`.
- Required: `quote_data` object with `items` array (≥0 ok for draft saves — at least one required only at approval).
- `subtotal`, `discount_percent`, `total` must be finite non-negative numbers.
- `total` within 1¢ of `max(0, subtotal * (1 - discount_percent/100) + orderExtrasTotal)`, where `orderExtrasTotal` is derived from `quote_data.orderExtras` via a 5-line lump-sum approximation (match the `getExtraCost` contract: treat extras as lump-sum NZD by default — enough for validation, not accurate pricing).

- [x] **Step 1: Write**

```ts
export interface QuotePayload {
  quote_data: {
    quoteReference?: string
    customerName?: string
    customerEmail?: string
    customerCompany?: string
    customerPhone?: string
    items: Array<{ id?: string; name?: string; quantity?: number; [k: string]: unknown }>
    orderExtras?: Array<{ name?: string; price?: string; customAmount?: number | null }>
    priceTier?: string
    customDiscount?: number | null
    [k: string]: unknown
  }
  subtotal: number
  discount_percent: number
  total: number
  customer_name?: string | null
  customer_email?: string | null
  customer_company?: string | null
  customer_phone?: string | null
  staff_notes?: string | null
  valid_until?: string | null
  status?: string
}

export function validateQuotePayload(body: unknown): { ok: true; data: QuotePayload } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const b = body as Partial<QuotePayload>
  if (!b || typeof b !== 'object') errors.push('body must be an object')
  if (!b?.quote_data || typeof b.quote_data !== 'object') errors.push('quote_data required')
  if (b?.quote_data && !Array.isArray((b.quote_data as any).items)) errors.push('quote_data.items must be array')
  for (const k of ['subtotal', 'discount_percent', 'total'] as const) {
    if (typeof b?.[k] !== 'number' || !Number.isFinite(b[k] as number) || (b[k] as number) < 0) {
      errors.push(`${k} must be a non-negative finite number`)
    }
  }
  if (errors.length) return { ok: false, errors }

  const subtotal = b.subtotal!
  const discountRate = (b.discount_percent! > 1 ? b.discount_percent! / 100 : b.discount_percent!)
  const afterDiscount = Math.max(0, subtotal * (1 - discountRate))
  // Light sanity only — exact extras math lives in pricing.ts, not duplicated here.
  if (Math.abs(b.total! - afterDiscount) / Math.max(1, afterDiscount) > 0.5) {
    errors.push('total deviates more than 50% from subtotal*(1-discount); check client pricing')
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, data: b as QuotePayload }
}

export function validateApproveReady(data: QuotePayload): string[] {
  const errs: string[] = []
  if (!Array.isArray(data.quote_data.items) || data.quote_data.items.length === 0) {
    errs.push('Quote must have at least one line')
  }
  for (const [i, item] of (data.quote_data.items ?? []).entries()) {
    if (!item.name || typeof item.quantity !== 'number' || item.quantity <= 0) {
      errs.push(`Line ${i + 1}: name and positive quantity required`)
    }
  }
  if (data.total <= 0) errs.push('Total must be > 0')
  return errs
}
```

- [x] **Step 2: Commit**

---

## Task 7: `POST /api/quote-tool/quotes` (create draft)

**Files:**
- Modify: `src/app/api/quote-tool/quotes/route.ts` — add POST

**Acceptance criteria:**
- Validates body via `validateQuotePayload`.
- Inserts `staff_quotes` row with `status = 'draft'`, `staff_user_id = auth.context.staffId`, `quote_data = body.quote_data`, totals populated.
- Returns `{ quote: <row> }` with 201 (or 200 for idempotency — easier).
- 400 on validation; 403 via helper.

- [x] **Step 1: Add POST**

At the bottom of [src/app/api/quote-tool/quotes/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/route.ts):

```ts
import { validateQuotePayload } from '@/lib/quotes/validation'

export async function POST(request: Request) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const v = validateQuotePayload(body)
  if (!v.ok) return NextResponse.json({ error: 'Validation failed', issues: v.errors }, { status: 400 })

  const d = v.data
  const { data: quote, error } = await auth.admin
    .from('staff_quotes')
    .insert({
      staff_user_id: auth.context.staffId,
      status: 'draft',
      quote_data: d.quote_data,
      subtotal: d.subtotal,
      discount_percent: d.discount_percent,
      total: d.total,
      customer_name: d.customer_name ?? d.quote_data.customerName ?? null,
      customer_email: d.customer_email ?? d.quote_data.customerEmail ?? null,
      customer_company: d.customer_company ?? d.quote_data.customerCompany ?? null,
      customer_phone: d.customer_phone ?? d.quote_data.customerPhone ?? null,
      staff_notes: d.staff_notes ?? null,
      valid_until: d.valid_until ?? null,
    })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote }, { status: 201 })
}
```

- [ ] **Step 2: cURL smoke**

```bash
curl -X POST http://localhost:3000/api/quote-tool/quotes \
  -H "Content-Type: application/json" -H "Cookie: sb-access-token=<TOKEN>" \
  -d '{
    "quote_data": {"items":[],"orderExtras":[],"customerName":"Test"},
    "subtotal": 0, "discount_percent": 0, "total": 0
  }'
# expect 201 with { quote: {...} }
```

- [ ] **Step 3: Commit**

---

## Task 8: `PATCH /api/quote-tool/quotes/[id]` (edit draft)

**Files:**
- Modify: `src/app/api/quote-tool/quotes/[id]/route.ts` — add PATCH

**Acceptance criteria:**
- Validates body via `validateQuotePayload`.
- Rejects with 409 if target row's `status IN ('approved','cancelled')`.
- Updates `quote_data`, totals, customer fields, notes, `valid_until`. Status NOT editable via PATCH (use DELETE for cancel, approve endpoint for approve).
- Non-admin can only edit their own drafts.
- Returns `{ quote: <row> }`.

- [ ] **Step 1: Add PATCH**

Append to [src/app/api/quote-tool/quotes/[id]/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/[id]/route.ts):

```ts
import { validateQuotePayload } from '@/lib/quotes/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const v = validateQuotePayload(body)
  if (!v.ok) return NextResponse.json({ error: 'Validation failed', issues: v.errors }, { status: 400 })

  // Ownership + status check.
  let probe = auth.admin.from('staff_quotes').select('status, staff_user_id').eq('id', id)
  if (!auth.context.isAdmin) probe = probe.eq('staff_user_id', auth.context.staffId)
  const { data: existing, error: eErr } = await probe.single()
  if (eErr || !existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (existing.status === 'approved' || existing.status === 'cancelled') {
    return NextResponse.json({ error: `Cannot edit ${existing.status} quote` }, { status: 409 })
  }

  const d = v.data
  const { data: quote, error } = await auth.admin
    .from('staff_quotes')
    .update({
      quote_data: d.quote_data,
      subtotal: d.subtotal,
      discount_percent: d.discount_percent,
      total: d.total,
      customer_name: d.customer_name ?? d.quote_data.customerName ?? null,
      customer_email: d.customer_email ?? d.quote_data.customerEmail ?? null,
      customer_company: d.customer_company ?? d.quote_data.customerCompany ?? null,
      customer_phone: d.customer_phone ?? d.quote_data.customerPhone ?? null,
      staff_notes: d.staff_notes ?? null,
      valid_until: d.valid_until ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote })
}
```

- [ ] **Step 2: cURL smoke** — PATCH an existing draft; confirm totals update.

- [ ] **Step 3: Commit**

---

## Task 9: Ensure `src/lib/monday/*` exists

**What:** create `src/lib/monday/client.ts`, `column-ids.ts`, `production-job.ts` ONLY IF they don't already exist (CSR plan may have shipped first).

**Acceptance:**
- After this task runs, `src/lib/monday/production-job.ts` exports `pushProductionJob(order, lines)` with the signature used by the CSR plan — see [2026-04-20-staff-portal-b2b-order-entry-csr-plan.md Task 7](./2026-04-20-staff-portal-b2b-order-entry-csr-plan.md).

- [ ] **Step 1: Check for existing files**

```bash
ls c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/lib/monday/ 2>&1
# If "No such file or directory" or empty → proceed to step 2.
# If client.ts / column-ids.ts / production-job.ts are all present → skip to step 4.
```

- [ ] **Step 2: If missing, create `client.ts`**

Copy verbatim from [print-room-portal/lib/monday/client.ts](print-room-portal/lib/monday/client.ts).

- [ ] **Step 3: If missing, create `column-ids.ts`**

Copy verbatim from [print-room-portal/lib/monday/column-ids.ts](print-room-portal/lib/monday/column-ids.ts).

- [ ] **Step 4: If missing, create `production-job.ts`**

Use the exact code from CSR plan Task 7 (the `createMondayProductionItem`, `createMondayProductionSubitem`, `pushProductionJob` trio).

- [ ] **Step 5: Ensure `MONDAY_API_TOKEN` is in `.env.local`**

If not, fetch from the customer-portal `.env.local` or ask the user once.

- [ ] **Step 6: Type-check + commit**

---

## Task 10: Approval orchestrator

**Files:**
- Create: `src/lib/quotes/approve.ts`

**Acceptance criteria:**
- `approveQuote(admin, quoteId, staffId)`:
  1. Reads the current row; if `status='approved' AND monday_item_id IS NOT NULL` → return `{ alreadyApproved: true, quote }`.
  2. If `status='approved' AND monday_item_id IS NULL` → skip to push (recovery path).
  3. Otherwise, validates the quote is approval-ready via `validateApproveReady`. On failure → `{ error: 'VALIDATION', issues }`.
  4. Updates row: `status='approved'`, `approved_at=now()`, `approved_by=staffId`.
  5. Calls `pushProductionJob`; on success, writes `monday_item_id`, `monday_board_id`, and patches `quote_data.items[i].monday_subitem_id` via a fresh update.
  6. On push failure, sets `quote_data.__push_state = 'failed'` and `__push_error = <message>`. Returns `{ quote, pushStatus: 'failed', error: <message> }`. Does NOT roll back the approval.
  7. On success returns `{ quote, pushStatus: 'ok' }`.

- [ ] **Step 1: Write**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { pushProductionJob } from '@/lib/monday/production-job'
import { PRODUCTION_BOARD_ID } from '@/lib/monday/column-ids'
import { validateApproveReady } from '@/lib/quotes/validation'

type AdminClient = ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>

export interface ApproveResult {
  quote: any
  pushStatus: 'ok' | 'failed' | 'skipped'
  error?: string
  issues?: string[]
  alreadyApproved?: boolean
}

function buildOrderPayload(quote: any) {
  const data = quote.quote_data ?? {}
  const refId = `Q-${String(quote.id).slice(0, 8).toUpperCase()}`
  return {
    order_ref: refId,
    customer_name: quote.customer_name ?? data.customerName ?? 'Unknown',
    customer_email: quote.customer_email ?? data.customerEmail ?? null,
    total_price: Number(quote.total ?? data.total ?? 0),
    required_by: data.inHandDate || null,
    payment_terms: null,
    notes: quote.staff_notes ?? data.notes ?? null,
    monday_item_id: quote.monday_item_id ?? null,
  }
}

function buildLinesPayload(quote: any) {
  const items = (quote.quote_data?.items ?? []) as any[]
  return items.map((item, index) => ({
    quote_item_id: `quote-line-${index}`,
    product_name: item.name ?? 'Line',
    variant_label: [item.brand, item.category].filter(Boolean).join(' — ') || '—',
    quantity: Number(item.quantity ?? 0),
    unit_price: 0,  // quote builder totals are already line-roll-up; Monday subitem carries qty for production
    decoration_summary: (item.decorations ?? []).map((d: any) => `${d.decorationType}: ${d.decorationDetail}`).join(', ') || null,
    existing_subitem_id: item.monday_subitem_id ?? null,
  }))
}

export async function approveQuote(admin: AdminClient, quoteId: string, staffId: string): Promise<ApproveResult> {
  const { data: quote, error } = await admin
    .from('staff_quotes').select('*').eq('id', quoteId).single()
  if (error || !quote) return { quote: null, pushStatus: 'skipped', error: 'Quote not found' }

  // Idempotent short-circuit.
  if (quote.status === 'approved' && quote.monday_item_id) {
    return { quote, pushStatus: 'skipped', alreadyApproved: true }
  }

  // Validate readiness before marking approved.
  if (quote.status !== 'approved') {
    const readyIssues = validateApproveReady({
      quote_data: quote.quote_data,
      subtotal: Number(quote.subtotal ?? 0),
      discount_percent: Number(quote.discount_percent ?? 0),
      total: Number(quote.total ?? 0),
    })
    if (readyIssues.length) {
      return { quote, pushStatus: 'skipped', error: 'VALIDATION', issues: readyIssues }
    }

    const { data: updated, error: uErr } = await admin
      .from('staff_quotes')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: staffId })
      .eq('id', quoteId).select('*').single()
    if (uErr) return { quote, pushStatus: 'skipped', error: uErr.message }
    Object.assign(quote, updated)
  }

  // Push.
  try {
    const { itemId, subitemIds } = await pushProductionJob(
      buildOrderPayload(quote),
      buildLinesPayload(quote)
    )
    // Patch quote_data.items[i].monday_subitem_id.
    const newItems = (quote.quote_data?.items ?? []).map((item: any, i: number) => ({
      ...item,
      monday_subitem_id: subitemIds[`quote-line-${i}`] ?? item.monday_subitem_id ?? null,
    }))
    const newData = { ...(quote.quote_data ?? {}), items: newItems, __push_state: 'ok', __push_error: null }
    const { data: finalRow } = await admin
      .from('staff_quotes')
      .update({
        monday_item_id: itemId,
        monday_board_id: String(PRODUCTION_BOARD_ID),
        quote_data: newData,
      })
      .eq('id', quoteId).select('*').single()
    return { quote: finalRow, pushStatus: 'ok' }
  } catch (e) {
    const msg = (e as Error).message ?? 'Monday push failed'
    const newData = { ...(quote.quote_data ?? {}), __push_state: 'failed', __push_error: msg }
    const { data: finalRow } = await admin
      .from('staff_quotes').update({ quote_data: newData }).eq('id', quoteId).select('*').single()
    return { quote: finalRow, pushStatus: 'failed', error: msg }
  }
}
```

- [ ] **Step 2: Commit**

---

## Task 11: `POST /api/quote-tool/quotes/[id]/approve`

**Files:**
- Create: `src/app/api/quote-tool/quotes/[id]/approve/route.ts`

**Acceptance criteria:**
- Requires `{ needApproval: true }`.
- Calls `approveQuote`.
- Returns `{ quote, push_status, error?, issues? }`. 200 in all success paths (including Monday push failure — the approval is still recorded). 400 on validation issues. 404 on missing quote.

- [ ] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'
import { approveQuote } from '@/lib/quotes/approve'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess({ needApproval: true })
  if ('error' in auth) return auth.error
  const { id } = await params

  const result = await approveQuote(auth.admin, id, auth.context.staffId)
  if (!result.quote) {
    return NextResponse.json({ error: result.error ?? 'Quote not found' }, { status: 404 })
  }
  if (result.error === 'VALIDATION') {
    return NextResponse.json({ error: 'Not ready to approve', issues: result.issues }, { status: 400 })
  }
  return NextResponse.json({
    quote: result.quote,
    push_status: result.pushStatus,
    already_approved: result.alreadyApproved ?? false,
    error: result.error ?? null,
  })
}
```

- [ ] **Step 2: cURL smoke** — create a draft via Task 7, approve, verify `status='approved'`, `monday_item_id` set (assuming Monday token works).

- [ ] **Step 3: Commit**

---

## Task 12: `POST /api/quote-tool/quotes/[id]/retry-push`

**Files:**
- Create: `src/app/api/quote-tool/quotes/[id]/retry-push/route.ts`

**Acceptance criteria:**
- Requires `{ needApproval: true }` (same permission as approve).
- Calls `approveQuote` — which is idempotent and handles the "approved but no monday_item_id" recovery path automatically.
- Returns same shape as approve.

- [ ] **Step 1: Write**

```ts
import { NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'
import { approveQuote } from '@/lib/quotes/approve'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess({ needApproval: true })
  if ('error' in auth) return auth.error
  const { id } = await params
  const result = await approveQuote(auth.admin, id, auth.context.staffId)
  if (!result.quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({
    quote: result.quote,
    push_status: result.pushStatus,
    error: result.error ?? null,
  })
}
```

- [ ] **Step 2: Commit**

---

## Task 13: `DELETE /api/quote-tool/quotes/[id]` (cancel)

**Files:**
- Modify: `src/app/api/quote-tool/quotes/[id]/route.ts` — add DELETE

**Acceptance criteria:**
- Soft-delete: sets `status='cancelled'`. Row remains for audit.
- 409 if already `status='approved'` AND `monday_item_id` is set (production has started). Staff have to handle Monday-side first.
- Non-admin can only cancel their own.

- [x] **Step 1: Add DELETE**

Append to [[id]/route.ts](print-room-staff-portal/src/app/api/quote-tool/quotes/[id]/route.ts):

```ts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let q = auth.admin.from('staff_quotes').select('status, staff_user_id, monday_item_id').eq('id', id)
  if (!auth.context.isAdmin) q = q.eq('staff_user_id', auth.context.staffId)
  const { data: existing, error: eErr } = await q.single()
  if (eErr || !existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  if (existing.status === 'approved' && existing.monday_item_id) {
    return NextResponse.json(
      { error: 'Cannot cancel an approved quote that has been pushed to Monday. Update Monday first.' },
      { status: 409 }
    )
  }

  const { error } = await auth.admin
    .from('staff_quotes').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

---

## Task 14: UI — wire Save on `/quote-tool/new`

**Files:**
- Modify: `src/app/(portal)/quote-tool/new/page.tsx`
- Modify: `src/components/quote-builder/QuoteForm.tsx` (add save prop / hook)

**Acceptance criteria:**
- "Save draft" button posts to `/api/quote-tool/quotes` with `{ quote_data, subtotal, discount_percent, total, customer_* }`.
- On 201 → `router.push('/quote-tool/' + quote.id + '/edit')`.
- On validation error → toast with issues.

- [x] **Step 1: Read current new/page + QuoteForm wiring**

```bash
# Quick read to confirm current save-button handler location.
```

Use the Read tool on the two files.

- [x] **Step 2: Add/replace the save handler**

In the component that owns form state (`QuoteForm.tsx`), export or surface a `saveDraft` handler:

```ts
async function saveDraft() {
  const body = {
    quote_data: draft,       // current state blob
    subtotal: pricing.subtotal,
    discount_percent: pricing.discountRate * 100,
    total: pricing.total,
    customer_name: draft.customerName,
    customer_email: draft.customerEmail,
    customer_company: draft.customerCompany,
    customer_phone: draft.customerPhone,
    staff_notes: draft.notes,
    valid_until: draft.expiryDate || null,
  }
  const res = await fetch('/api/quote-tool/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) { setToast({ kind: 'error', text: (json.issues ?? [json.error]).join('; ') }); return }
  router.push(`/quote-tool/${json.quote.id}/edit`)
}
```

- [x] **Step 3: Wire button**

Connect the existing "Save" button element in `QuoteForm.tsx` to `saveDraft`. If no button exists, add one in the form's action row.

- [ ] **Step 4: Manual verification** — click Save on `/quote-tool/new`; row appears in DB + list; lands on edit page.

- [ ] **Step 5: Commit**

---

## Task 15: UI — autosave on `/quote-tool/[id]/edit`

**Files:**
- Modify: `src/app/(portal)/quote-tool/[id]/edit/page.tsx`
- Modify: `src/components/quote-builder/QuoteForm.tsx`

**Acceptance criteria:**
- Client debounces changes 1500ms; on tick, PATCHes to `/api/quote-tool/quotes/[id]` with the same payload shape as Task 14 save.
- Shows a small "Saved" badge near the form actions when the PATCH resolves; "Saving…" during the request.
- 409 → render a non-dismissable banner: "This quote is approved. Edits are disabled." Mark all inputs disabled.

- [ ] **Step 1: Add autosave hook**

In `QuoteForm.tsx`, if editing (i.e. a `quoteId` prop is present):

```ts
useEffect(() => {
  if (!quoteId) return
  const t = setTimeout(async () => {
    setSaveState('saving')
    const body = { /* same as saveDraft payload in Task 14 */ }
    const res = await fetch(`/api/quote-tool/quotes/${quoteId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 409) { setSaveState('locked'); return }
    setSaveState(res.ok ? 'saved' : 'error')
  }, 1500)
  return () => clearTimeout(t)
}, [draft, pricing.total, quoteId])
```

- [ ] **Step 2: Lock inputs when `saveState === 'locked'`**

All inputs get `disabled={saveState === 'locked'}`.

- [ ] **Step 3: Manual verification** — edit a field, see "Saving…" → "Saved". Approve the quote, refresh edit page, see the locked banner.

- [ ] **Step 4: Commit**

---

## Task 16: UI — Approve button on detail page

**Files:**
- Modify: `src/app/(portal)/quote-tool/quotes/[id]/page.tsx`
- Create: `src/components/quote-builder/ApproveQuoteButton.tsx` (client component)

**Acceptance criteria:**
- Button visible when `status IN ('draft','sent','created')` AND user has approval permission.
- Click → confirmation modal: "This will approve the quote and push it to Monday production. You cannot edit afterwards. Continue?"
- On 200 `push_status='ok'`: toast "Approved. Monday job <itemId> created." Button hides; Monday link renders.
- On 200 `push_status='failed'`: toast "Approved, but Monday push failed: <reason>." A "Retry Monday push" button appears alongside the badge.
- On 400 (validation): toast with issues.
- On 403: hidden entirely.

- [ ] **Step 1: Add the permission check to the page**

Server component fetches the quote + checks `auth.context.canApprove`:

```tsx
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) redirect('/dashboard')

  const { data: quote } = await auth.admin
    .from('staff_quotes').select('*').eq('id', id).single()
  if (!quote) notFound()

  return (
    <QuoteDetail
      quote={quote}
      canApprove={auth.context.canApprove}
    />
  )
}
```

(If `QuoteDetail`/similar doesn't exist yet, adapt to the current file layout.)

- [ ] **Step 2: Write `ApproveQuoteButton.tsx`** (client)

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ApproveQuoteButton({
  quoteId, currentStatus, canApprove, hasMondayItem,
}: {
  quoteId: string
  currentStatus: string
  canApprove: boolean
  hasMondayItem: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const visible = canApprove && ['draft','sent','created'].includes(currentStatus)
  const retryVisible = canApprove && currentStatus === 'approved' && !hasMondayItem

  if (!visible && !retryVisible) return null

  async function run(path: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/quote-tool/quotes/${quoteId}/${path}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        alert((json.issues ?? [json.error]).join('; '))
      } else if (json.push_status === 'ok') {
        alert(`Approved. Monday item ${json.quote.monday_item_id} created.`)
      } else if (json.push_status === 'failed') {
        alert(`Approved, but Monday push failed: ${json.error}`)
      } else if (json.push_status === 'skipped' && json.already_approved) {
        alert('Already approved — nothing to do.')
      }
      router.refresh()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  if (retryVisible) {
    return <Button onClick={() => run('retry-push')} disabled={loading}>Retry Monday push</Button>
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={loading}>Approve & push to Monday</Button>
      {open && (
        <div role="dialog" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 max-w-sm">
            <p className="font-medium">Approve this quote?</p>
            <p className="text-sm text-gray-600 mt-2">
              This will push it to Monday production. You cannot edit the quote afterwards.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => run('approve')} disabled={loading}>Confirm approve</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Render on the detail page** (inside the existing `QuotesDashboard` / per-quote view layout).

- [ ] **Step 4: Manual verification** — approve a draft, see success toast, Monday item link renders.

- [ ] **Step 5: Commit**

---

## Task 17: UI — failure banner + status badge coverage

**Files:**
- Modify: `src/components/quote-builder/QuoteStatusBadge.tsx` (if the status list needs explicit cases)
- Modify: `src/app/(portal)/quote-tool/quotes/[id]/page.tsx` — render a banner when `quote_data.__push_state === 'failed'`

**Acceptance criteria:**
- `QuoteStatusBadge` renders a distinct colour for `'approved'` (green) and `'cancelled'` (gray).
- Detail page: if `quote.quote_data?.__push_state === 'failed'`, show a red banner above the actions: "Monday push failed: <error>. Click Retry Monday push."

- [ ] **Step 1: Read current `QuoteStatusBadge.tsx`** to see existing colour mapping.

- [ ] **Step 2: Add the two cases** (or verify they already work via the generic case).

- [ ] **Step 3: Add the banner** on the detail page:

```tsx
{quote.quote_data?.__push_state === 'failed' && (
  <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
    Monday push failed: {String(quote.quote_data.__push_error ?? 'unknown error')}
  </div>
)}
```

- [ ] **Step 4: Commit**

---

## Task 18: Sidebar — approval permission gating (read-only check)

**Files:**
- Review: `src/components/layout/Sidebar.tsx`

**Acceptance criteria:**
- Existing "Quote Tool" section already renders when user has the legacy `'quote-tool'` permission; the sidebar filter at [Sidebar.tsx:207-211](print-room-staff-portal/src/components/layout/Sidebar.tsx#L207-L211) does not need changes for this spec — approve is an in-page button, not a nav item.

- [ ] **Step 1: Verify — no change required.** Do not edit unless you need to adjust an item that depends on `quotes:approve` (none planned).

---

## Task 19: End-to-end verification (spec §12)

- [ ] **Step 1: Create draft**

Via `/quote-tool/new`: pick Bike Glendhu, add two lines (catalog × 24, MTO × 50). Click Save.

Verify in DB:
```sql
select id, status, subtotal, total, monday_item_id from staff_quotes order by created_at desc limit 1;
-- expect status='draft', subtotal/total populated, monday_item_id null.
```

- [ ] **Step 2: Edit draft**

On `/quote-tool/<id>/edit`: change line 1 qty to 36. Wait ~2s. Expect "Saved" badge.

```sql
select total from staff_quotes where id = '<ID>';
-- expect new total reflecting qty change.
```

- [ ] **Step 3: Approve**

Navigate to `/quote-tool/quotes/<id>`. Click "Approve & push to Monday". Confirm.

```sql
select status, approved_at, approved_by, monday_item_id, monday_board_id from staff_quotes where id = '<ID>';
-- expect status='approved', approved_at set, monday_item_id non-null, monday_board_id set.

select jsonb_path_query(quote_data, '$.items[*].monday_subitem_id') from staff_quotes where id = '<ID>';
-- expect 2 subitem IDs.
```

- [ ] **Step 4: Idempotent re-approve**

Click Approve again (refresh the page first, button should be hidden — skip, or force via cURL):

```bash
curl -X POST http://localhost:3000/api/quote-tool/quotes/<ID>/approve -H "Cookie: sb-access-token=<TOKEN>"
# expect { push_status: 'skipped', already_approved: true }
```

```sql
-- expect monday_item_id unchanged; no duplicate Monday items in the Monday UI.
```

- [ ] **Step 5: Edit after approval is blocked**

```bash
curl -X PATCH http://localhost:3000/api/quote-tool/quotes/<ID> \
  -H "Content-Type: application/json" -H "Cookie: sb-access-token=<TOKEN>" \
  -d '{"quote_data":{"items":[]},"subtotal":0,"discount_percent":0,"total":0}'
# expect 409.
```

UI: the edit page shows the locked banner; inputs disabled.

- [ ] **Step 6: Simulate push failure + retry**

Temporarily break the Monday push by setting `MONDAY_API_TOKEN=invalid` in `.env.local`, restart dev. Create a new draft, approve. Expect:
- `status='approved'`
- `monday_item_id` null
- `quote_data.__push_state = 'failed'`
- UI shows red banner + "Retry Monday push" button

Restore `MONDAY_API_TOKEN`. Click "Retry Monday push". Expect success.

```sql
select monday_item_id, quote_data->>'__push_state' from staff_quotes where id = '<NEW_ID>';
-- expect monday_item_id non-null, __push_state = 'ok'.
```

- [ ] **Step 7: Non-permissioned user**

Seed a staff user with `role='staff'` and no `quotes:approve`. Visit detail page → Approve button hidden. Try approve via cURL → 403.

- [ ] **Step 8: List filters**

On `/quote-tool/quotes`, filter by `status=approved` → only the approved quote visible. Log in as non-admin creator → mine-only filter works.

- [ ] **Step 9: No inventory impact**

```sql
select count(*) from variant_inventory_events
 where reason in ('order_commit','order_ship','order_release')
   and created_at > <BEFORE_TEST_TS>;
-- expect 0 rows tied to this flow.
```

---

# Appendix — Test plan summary

- **DB / migrations:** Task 1 — `mcp__supabase__execute_sql` assertions.
- **HTTP / API:** Tasks 5, 7, 8, 11, 12, 13 — cURL smoke against `npm run dev`.
- **UI / manual:** Tasks 14, 15, 16, 17, 19.
- **End-to-end:** Task 19 walks the spec §12 happy path + edge cases.

# Appendix — Deferred follow-ups (noted in spec §11)

- PDF export (v1.1)
- Customer-facing quote view (lives in Customer B2B Checkout plan)
- Quote → order one-click conversion
- Cron sweep for `__push_state='failed'` older than 10 min
- Server-side total recompute using `calculateQuoteTotal` (defense-in-depth; currently trusted client-side)
- Pricing-tier alignment with CSR tool's bracket model (separate follow-up)

# Appendix — Shared contracts this plan reads / writes

- **Reads:** `src/lib/monday/production-job.ts::pushProductionJob` (defined by CSR plan Task 7, OR created here in Task 9 if CSR plan hasn't shipped).
- **Writes nothing cross-spec.** Spec #4 (Customer B2B Checkout MVP) may later call `/api/quote-tool/quotes/[id]/approve` from a customer-triggered "Accept quote → request order" flow, but that integration is in spec #4, not here.

Plan path for cross-referencing from spec #4:
`print-room-staff-portal/docs/superpowers/plans/2026-04-20-staff-portal-quote-builder-completion-plan.md`
