# Quote Builder — Completion & Supersede Replit Tool — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)

## 1. Context

Boss Chris's original ask on 2026-04-20 was to add a QTY field and Monday subitem push to his external Replit quote builder (`data-exporter-chrisbrun1289.replit.app`). During brainstorm the direction shifted: rather than improving the external tool, we're completing the existing staff quote builder inside `print-room-staff-portal`, superseding the Replit app the same way the Products sub-app is superseding `middleware-pr`. One fewer external system to maintain and one less contributor to the platform-fragmentation problem documented in `project_platform_fragmentation.md`.

The staff quote builder is roughly 80% built:
- Routes exist under `/quote-tool/` — list, new, edit, detail.
- Components under `src/components/quote-builder/` (16 files) cover product picking, qty entry, pricing preview, design snapshots.
- Pricing engine at `src/lib/quote-builder/pricing.ts` applies tier discounts via `price_tiers.discount`.
- `staff_quotes` table has `quote_data jsonb`, `status text default 'draft'`, `discount_percent`, `valid_until`, `monday_item_id`, `submitted_quote_id`.

What it's missing is the plumbing that turns a draft into a production job:
1. **Persistence** — `POST/PUT /api/quote-tool/quotes` don't exist; drafts aren't being saved.
2. **Approval action** — no "Approve" button, no `approved_at` write, no status transition to the terminal state.
3. **Monday push on approval** — `monday_item_id` column exists but nothing writes it.
4. **Customer-facing quote view** — no shareable link; this is deferred to the Customer B2B Checkout MVP spec where customer-side quote submission is its own feature.

This spec closes 1, 2, and 3. Item 4 is explicitly a follow-up handled in a separate document.

## 2. Goals

- Staff can save, edit, and reload a quote draft from the staff quote builder.
- Staff can mark a quote approved in one click; the approval event is audited and timestamped.
- On approval, a Monday production-board item is created with one subitem per line; the IDs are written back to `staff_quotes.monday_item_id` and per-line subitem IDs are persisted in the quote's `quote_data` jsonb.
- The Monday push is idempotent: re-approving an already-pushed quote is a no-op.
- A failed Monday push does not silently swallow the approval; the UI shows a retry affordance.
- The Replit quote-builder tool becomes optional within one quarter; staff migrate to the internal builder on their own pace.

## 3. Non-goals (out of scope)

- **Customer-facing quote view** — a customer portal route where the recipient clicks Accept is scoped into the Customer B2B Checkout MVP spec (Request a Quote flow).
- **Pricing-engine rewrite** — existing multiplier-based pricing in `src/lib/quote-builder/pricing.ts` stays. Unifying with the CSR tool's `product_pricing_tiers × price_tiers` lookup is the separate pricing-tier follow-up Chris flagged.
- **Quote → order one-click conversion** — deferred. Approved quotes push to Monday; the CSR tool still types orders fresh in v1. A future feature can pre-populate `/orders/new` from a `staff_quotes.id`.
- **PDF export** — v1.1. Not in this spec.
- **Inventory reservation on approval** — explicitly no. A quote is not an order. Reservation happens only when an `orders` row is created (via CSR tool or customer checkout). An approved Replit-style quote in Monday doesn't commit stock.
- **Replit tool deprecation / shutdown** — out of scope. Both can coexist; staff choose.

## 4. Architecture

### 4.1 Route additions

```
src/app/api/quote-tool/quotes/
  route.ts                          POST create, GET list (filter by staff/status)
  [id]/route.ts                     GET / PATCH / DELETE
  [id]/approve/route.ts             POST — approve + Monday push
  [id]/retry-push/route.ts          POST — retry Monday push only (idempotent)
```

Existing UI under `src/app/(portal)/quote-tool/*` stays — only new/changed behaviours wire into it.

### 4.2 Next.js 16 caveat

Both apps are on Next.js 16. Before writing route handlers, consult `node_modules/next/dist/docs/` per the repo's `AGENTS.md`. Async params / request APIs differ from earlier versions.

## 5. Data model

### 5.1 Column additions

```sql
alter table staff_quotes
  add column approved_at timestamptz,
  add column approved_by uuid references staff_users(id),
  add column monday_board_id text;

-- status is text (not enum) so no enum change needed.
-- Permitted values after this change: 'draft','sent','approved','cancelled','expired'.
```

Per-line Monday subitem IDs live inside `staff_quotes.quote_data.items[].monday_subitem_id` — no schema change; jsonb absorbs it. This keeps the quote's line structure self-contained in the jsonb blob that the existing UI already reads and writes.

### 5.2 Rationale for not introducing `quote_items` rows

`staff_quotes.quote_data` is already canonical for the builder. Splitting lines into a relational table would force a larger refactor of the existing components with no immediate pay-off. If/when customer-side quote submission lands (Customer B2B Checkout spec), it can write the same jsonb shape for consistency.

## 6. Persistence — save & load

### 6.1 `POST /api/quote-tool/quotes`

Request body: the client's current `QuoteDraft` shape from `src/lib/quote-builder/types.ts`. Server:
- Validates required fields: customer identity (`customer_name` OR `customer_email` OR `customer_company` — at least one), at least one line item.
- Inserts `staff_quotes` row with `status = 'draft'`, `quote_data` = the draft jsonb, `staff_user_id` from session.
- Computes and persists `subtotal`, `discount_percent`, `total` from the pricing engine so the list view doesn't have to recompute.
- Returns the new row; client navigates to `/quote-tool/[id]/edit`.

### 6.2 `PATCH /api/quote-tool/quotes/[id]`

- Updates `quote_data`, totals, `customer_*` fields, `staff_notes`, `valid_until`.
- Disallowed if `status IN ('approved','cancelled')` — approved quotes are locked (Monday is now the source of truth for production changes).
- Autosave pattern: client debounces 1500ms and calls PATCH; UI shows a small "saved" toast.

### 6.3 `GET /api/quote-tool/quotes` and `[id]`

- List: paginated 25/page, filters by `staff_user_id` (mine-only toggle), `status`, date range.
- Detail: full row including `quote_data`.

## 7. Approval

### 7.1 `POST /api/quote-tool/quotes/[id]/approve`

Server pipeline, inside a single transaction *except* the Monday call (see 7.3):

1. Load `staff_quotes` row. Require `status IN ('draft','sent')`. Idempotent guard: if `status = 'approved'` and `monday_item_id IS NOT NULL`, return 200 with the existing row.
2. Update `status = 'approved'`, `approved_at = now()`, `approved_by = <caller>`.
3. COMMIT.
4. Call the Monday push helper (§8). On success, write `monday_item_id`, `monday_board_id`, and patch `quote_data.items[i].monday_subitem_id` with the returned subitem IDs.
5. On Monday failure: leave the approval in place, mark an internal flag `quote_data.__push_state = 'failed'`, return 200 with a body that includes `push_status: 'failed'`. The UI surfaces the retry button.

### 7.2 Approval button UX

- On the detail page, visible when `status IN ('draft','sent')` and the quote passes validation (at least one line, all lines have qty, total > 0).
- Click → confirmation modal: "This will approve the quote and push it to Monday production. You cannot edit afterwards."
- On success: toast "Approved. Monday job #123 created." Button hides; detail page shows the Monday link.
- On push failure: toast "Approved, but Monday push failed: <reason>. Retry push?" with a retry action that POSTs to `/retry-push`.

### 7.3 Why transactional approval but out-of-transaction Monday push

Monday is external, slow, and occasionally flaky. Holding a DB transaction open across the Monday call would lock `staff_quotes` for seconds during a network hiccup. Decoupling also means a transient Monday failure doesn't cost us an approval the staff already confirmed; the retry path reconciles the IDs. The idempotency guard in step 1 ensures duplicate approvals can't create duplicate Monday items.

## 8. Monday push

Shared helper — same file the CSR tool uses: `src/lib/monday/production-job.ts` (new, created by the CSR tool spec). This sub-app imports it directly.

Function signature (cross-ref to CSR tool spec §8):

```ts
pushProductionJob({
  refLabel: string,            // "QUOTE-<short id>" or staff-chosen label
  customerName: string,
  totalNZD: number,
  requiredBy?: Date,
  paymentTerms?: string,
  notes?: string,
  lines: Array<{
    variantLabel: string,      // "Classic Tee - Navy / L"
    qty: number,
    unitPrice: number,
    decorationSummary?: string,
  }>,
}) => Promise<{ itemId: string; boardId: string; subitemIds: string[] }>
```

### 8.1 Subitem mapping

One subitem per `quote_data.items[]` entry. Subitem IDs returned by Monday are written back to `quote_data.items[i].monday_subitem_id` in order. If the CSR tool or customer checkout later consumes an approved quote as the basis for an order, it can reuse those subitem IDs (future work).

### 8.2 Board ID

`MONDAY_PRODUCTION_BOARD_ID` env var, shared with the CSR tool. Approved quotes and CSR-entered orders both land on the same production board, so the production team sees one queue.

### 8.3 Failure behaviour

- Any non-2xx or timeout (10s): treat as failed, set `quote_data.__push_state = 'failed'`.
- The approval record stays; no rollback.
- Retry endpoint `/retry-push` repeats step 4 of §7.1 with the same idempotency guard (skip if `monday_item_id` is already set).

## 9. Auth, permissions

- Reuse the existing staff auth middleware + `staff_users` check — same pattern as the Products sub-app.
- Permissions:
  - `quotes:write` — can create/edit drafts. Default granted to all staff roles.
  - `quotes:approve` — can approve. Restricted to `admin` / `super_admin` by default; individually grantable.
- Server-side guard on `/api/quote-tool/**` routes.

## 10. Decisions made (with defaults applied per auto-mode)

| # | Decision | Default chosen | Override needed? |
|---|---|---|---|
| 1 | Customer-facing quote view | Deferred to Customer B2B Checkout spec | Tell me if staff need it in this spec |
| 2 | Line-item persistence shape | `quote_data` jsonb (existing) | Tell me if you want a relational `quote_items` join |
| 3 | Pricing engine | Keep existing multiplier model | Tell me if you want unification with CSR tier model now |
| 4 | Monday board | Shared `MONDAY_PRODUCTION_BOARD_ID` with CSR tool | Tell me if quotes should go to a separate "incoming" board |
| 5 | Reservation on approval | No — quotes don't reserve stock | Tell me if quotes should soft-reserve |
| 6 | PDF export | v1.1 | — |
| 7 | Edits after approval | Disallowed; Monday is source of truth | Tell me if you want amendable approved quotes |
| 8 | Approval permission | New `quotes:approve` key, restricted default | Tell me if all staff can approve |

## 11. Dependencies & follow-ups (not in this spec)

- **CSR tool (sub-app #4)** — owns `src/lib/monday/production-job.ts`. This spec imports that helper. The two specs are co-shippable: if quote builder ships first, it temporarily owns the helper and the CSR tool imports it.
- **Pricing-tier alignment** — separate follow-up Chris flagged. Unifies the quote builder's multiplier-based pricing with the CSR tool's `product_pricing_tiers × price_tiers` lookup. Touches both surfaces.
- **Customer B2B Checkout MVP** — covers the customer-side "Request a Quote" flow where customers build a draft they can submit to staff for pricing. That spec references this one for the approval/Monday-push plumbing.
- **Platform fragmentation follow-up** — once this ships, Chris's Replit tool is superseded. Agreed decommission path: soft-pause the Replit deployment once staff are comfortable with the internal builder (no hard deadline).
- **v1.1 deferred:**
  - PDF export.
  - Customer-facing view (absorbed into Customer B2B Checkout spec).
  - Quote → order one-click conversion.
  - Monday push reconciliation sweep (cron) for quotes stuck with `__push_state = 'failed'`.
  - Migration of `quote_data` jsonb into relational rows if cross-referencing needs outgrow jsonb.

## 12. Verification

End-to-end happy path:
1. Open `/quote-tool/new`, pick Bike Glendhu (tier 2), add two lines: catalog product × 24, MTO product × 50. Hit save → `staff_quotes` row created with `status = 'draft'`, totals populated.
2. Return via `/quote-tool/[id]/edit`, change line 1 qty to 36, autosave fires → PATCH updates totals.
3. Click Approve → `status = 'approved'`, `approved_at` set, Monday item created with 2 subitems, `monday_item_id` + per-line `monday_subitem_id` written back.
4. Click Approve again → 200, no new Monday item, same row returned (idempotent).
5. Try editing after approval → API returns 409; UI edit button hidden.
6. Simulate Monday push failure (stub helper to throw) → approval completes, `__push_state = 'failed'`, retry button appears. Retry → Monday item created, flag cleared.
7. Non-permissioned user: 403 on approve API, approve button hidden in UI.
8. List `/quote-tool/quotes`: drafts visible to creator, approved quotes visible to all, filters work.
9. Assert no `variant_inventory.committed_qty` was changed (quote doesn't reserve stock).
