# CSR Sub-app #4 — Spec/Plan vs On-Disk Delta

**Date:** 2026-04-29
**Author:** B7 reconciliation pass
**Sources:**
- Spec: `docs/superpowers/specs/2026-04-20-staff-portal-b2b-order-entry-csr-design.md`
- Plan: `docs/superpowers/plans/2026-04-20-staff-portal-b2b-order-entry-csr-plan.md`
- Sub-app #3 ship notes: `~/.claude/projects/.../memory/project_b2b_catalogues_spec_plan.md`
- DB verification: 8 SQL reads on `bthsxgmcnbvwwgvdveek` 2026-04-29 (🟡 approved)

## Headline

The CSR sub-app shipped on **2026-04-21** (Tasks 1–21 complete; Task 22 DB verification done, browser-manual UI checks deferred). What looked like a fresh execution job is actually a **reconciliation patch** against a shipped sub-app, because **sub-app #3 (catalogues + `is_b2b_only`) shipped 2026-04-27 — six days after CSR was built — and CSR has no awareness of either**.

Bundle scope confirmed with Jamie 2026-04-29: items A–D (real bugs) + E (manual UI walkthrough) + F (memory) ship together. Pricing decision locked: unify on `effective_unit_price` for both staff and customer surfaces.

---

## Spec/plan claims that are NOW CORRECT (skip — already on disk)

| # | Spec/plan said | Reality | Source |
|---|---|---|---|
| 1 | Add `quotes.order_ref unique` | Exists | migration `20260420_orders_schema` |
| 2 | Create `order_number_seq` | Exists | same migration |
| 3 | Add `organizations.customer_code` with `^[A-Z0-9]{2,6}$` check + unique | Exists | confirmed via `pg_constraint`; `organizations_customer_code_check` + `_key` |
| 4 | Add `b2b_accounts.organization_id uuid unique references organizations(id)` | Exists | `b2b_accounts_organization_id_fkey` + `_key` |
| 5 | `quote_items.variant_id` (added by Inventory) + `monday_subitem_id` | Exists | inventory sub-app shipped |
| 6 | `submit_b2b_order` RPC | Exists | migration `20260420_submit_b2b_order_fn`, args match plan, returns `(quote_id, order_id, order_ref)` |
| 7 | `allocate_order_ref(text)` helper | Exists | migration `20260420_allocate_order_ref_fn` |
| 8 | `reserve_quote_line` / `release_quote_line` / `adjust_quote_line_delta` | Exist | inventory sub-app |
| 9 | `get_unit_price(uuid, uuid, integer)` | Exists | migration `20260420_pricing_fn`; reads `b2b_accounts.tier_level → price_tiers.discount` |
| 10 | `b2b_accounts.payment_terms` mismatch (`'net_20'` vs CHECK `'net20'`) | **FIXED** | migration `20260420_submit_b2b_order_fn_fix_payment_terms`; RPC maps `'net_20'`/`'net-20'`/`'NET20'` → `'net20'` |
| 11 | All 6 API routes + 10 components + 3 pages | Exist | filesystem confirmed |
| 12 | Sidebar entry, `'orders'` / `'orders:write'` permission keys | Exist | per plan task 21 `[x]` |

**Net: ~92% of the original plan is shipped.** No further migrations needed for items 1–12.

---

## A — Pricing not catalogue-aware (BUG, both staff + customer)

**Spec/plan claim:** `get_unit_price(product, org, qty)` is the canonical pricing function consumed by both staff CSR and customer checkout (plan §"Shared contracts").

**Reality after sub-app #3 shipped 2026-04-27:**
- New canonical function: `effective_unit_price(p_product_id, p_org_id, p_qty)` — looks up the org's active catalogue; if a `b2b_catalogue_items` row exists for the product, returns `catalogue_unit_price(item, qty)` (catalogue's own bracket pricing); otherwise falls back to `get_unit_price`.
- Customer-portal `/shop` already uses it via `print-room-portal/lib/shop/effective-price.ts`.
- **Three places still call `get_unit_price` directly and get wrong prices for orgs with active catalogues:**
  - `print-room-staff-portal/src/app/api/pricing/quote-line/route.ts:28` (CSR live pricing)
  - `print-room-portal/lib/checkout/submit.ts:105` (customer checkout repricing on submit)
  - (No others — verified via grep.)

**Behavioural impact for PRT:** PRT has demo catalogue `ba207fd4-fffc-4fa7-9446-2fd5c7ca7035` with 3 master items + 1 B2B-only sticker. CSR-quoted prices for the 3 master items would diverge from `/shop` prices by whatever the catalogue markup overrides specify. Customer-portal submit re-prices on the server using `get_unit_price` — so the customer would see catalogue prices in `/shop`, then **be charged the non-catalogue price at submit**. Silent overcharge or undercharge depending on markup direction.

**Fix:** swap `get_unit_price` → `effective_unit_price` in the two call sites. Three-arg signature is identical, drop-in.

**Scope creep flag:** `effective_unit_price` does NOT apply tier discount on top of catalogue prices (catalogues are absolute). This matches the 2026-04-27 amendment removing `discount_pct`. No change to that semantic.

---

## B — Product typeahead not catalogue-aware + leaks B2B-only items (BUG)

**Spec/plan claim (§6.1):** Product typeahead matches `products.name`/`sku` filtered by `is_active`.

**Reality:**
- `print-room-staff-portal/src/app/api/products/search/route.ts:13-19` — plain `is_active=true` ilike on `products.name`. No `org_id` parameter, no `is_b2b_only` filter, no catalogue scope.
- After sub-app #3, this typeahead leaks **B2B-only items globally** (a CSR creating an order for org A would see "PRT Bespoke Logo Sticker" — a synthetic-master product that should only exist within PRT's catalogue).
- It also doesn't surface catalogue-scope context: a CSR creating a PRT order has no signal that PRT has a catalogue or which products are inside it.

**Fix (mirrors the `/shop` two-step pattern from sub-app #3):** add an optional `?organization_id=X` parameter:
- If absent or org has no active catalogue → return all `products` where `is_active=true` AND `is_b2b_only=false` (current behaviour minus B2B-only leakage).
- If present and org has an active catalogue → return the union of (a) products in the catalogue (with a `via_catalogue: true` flag for UI indication) and (b) global products where `is_b2b_only=false` and not already in (a).

UI tweak: surface a "via catalogue" pill on rows in (a) so the CSR knows the price came from PRT's catalogue rather than master tiers.

---

## C — `CompanySection` never reads existing `customer_code` (BUG)

**Spec/plan claim (§6.1):** "If `customer_code` is blank, inline 3–6 char input to set it."

**Reality:**
- `/api/organizations/search?q=X` returns only `id` + `name` — no `customer_code` column.
- `CompanySection.tsx:99-115` has a TODO comment confirming this; on org select, `customer_code` is hard-coded to `null` and the UI always shows the "Assign customer code" prompt.
- For PRT (which already has `customer_code='PRT'` per memory snapshot), staff would either (a) ignore the prompt and submit, which fails with HTTP 400 from `/api/orders` (`customer_code` required), or (b) try to set a code that fails the unique constraint.

**Fix options:**
1. **Recommended:** add `customer_code` to `/api/organizations/search` response — single column, no security concern, smallest delta.
2. Alternative: add a separate `GET /api/organizations/[id]` detail endpoint and call it from `selectOrg`. More routes for no upside.

Going with (1).

---

## D — `OrderFormClient` likely wires customer_email and other defaults badly

**Spec/plan claim:** plan task 18 step 2 has a `customer_email: state.b2bAccount?.payment_terms ? '...' : 'csr@theprint-room.co.nz'` line — clearly a placeholder ("`'...'`") that will fail submit.

**Action:** check `OrderFormClient.tsx` to confirm whether this placeholder shipped or got fixed. If shipped, replace with: pull from a per-org "primary contact" — but `b2b_accounts` doesn't store one. Pragmatic v1: free-text input on the form (CSR types the recipient's email). Captured during the manual UI walkthrough (item E) — leaving a small TODO if implementation doesn't already cover it.

---

## E — Manual UI verification still pending

Plan task 22 deferred 4 manual checks since 2026-04-21:
- Step 4 — submit via `/orders/new` (full happy path through Bike Glendhu fixture or PRT)
- Step 6 — over-commit UI banner ("OUT_OF_STOCK")
- Step 8 — cancel order via UI confirm dialog
- Step 10 — non-permissioned 403, tab flow, sticky-summary recalculation, submit-disabled-on-overcommit

Plus tasks 18/19/20 each have unchecked "manual check" steps for the same reason.

**Action:** browser walkthrough using PRT (org `ee155266…`, customer_code `'PRT'`, b2b_account tier_level=1, Wanaka HQ store, Basic Tee variants). Bundled at end after A–D land — needs a logged-in staff session and `MONDAY_API_TOKEN` for the Monday push assertions.

---

## F — Memory updates pending

`project_b2b_specs_set.md` and `project_b2b_plans_set.md` describe the sub-app #4 spec + plan but don't reflect the 2026-04-21 ship. Will append "shipped 2026-04-21 (with 2026-04-29 reconciliation patch for catalogue scope + is_b2b_only)".

Also worth a NEW project memory: **B2B pricing canonical decision** — `effective_unit_price` is the single price function for staff + customer surfaces; never call `get_unit_price` directly from app code. Save with the why (catalogue/non-catalogue divergence risk after sub-app #3) so future-me doesn't re-introduce it.

---

## Non-issues confirmed (don't fix)

- ~~`payment_terms` enum mismatch~~ — fixed at the RPC level on 2026-04-20.
- ~~`b2b_accounts.organization_id` doesn't exist~~ — exists, UNIQUE + FK to `organizations`.
- ~~`organizations.customer_code` doesn't exist~~ — exists, with CHECK + UNIQUE.
- ~~Need to add `quote_items.variant_id`~~ — added by inventory sub-app.
- ~~Need to write `submit_b2b_order` from scratch~~ — exists; CSR submit + customer checkout submit both already call it.
- ~~Need to write Monday production-job helper from scratch~~ — exists in both repos (small acceptable duplication, flagged in spec §12).

---

## Recommended task list for plan amendment

Eight tasks total. All scoped to `print-room-staff-portal` + `print-room-portal` (no schema migrations required — DB already in the right shape). 4-axis stack rationale: staff-only authenticated form (per-request rendering, no caching, no SEO); ecommerce concerns are pricing engine + catalogue scope + inventory reservation — all backed by RPCs that already exist.

| # | Task | Files | Type |
|---|---|---|---|
| 1 | Swap `get_unit_price` → `effective_unit_price` in CSR pricing endpoint | `print-room-staff-portal/src/app/api/pricing/quote-line/route.ts` | code |
| 2 | Swap `get_unit_price` → `effective_unit_price` in customer checkout submit repricing | `print-room-portal/lib/checkout/submit.ts:105` | code |
| 3 | Add `is_b2b_only=false` filter + optional `?organization_id=X` catalogue-scoped branch to product search | `print-room-staff-portal/src/app/api/products/search/route.ts` | code |
| 4 | Pass `organizationId` from `LineItemRow` to product search | `print-room-staff-portal/src/components/orders/LineItemRow.tsx` | code |
| 5 | Add `customer_code` to organizations search response | `print-room-staff-portal/src/app/api/organizations/search/route.ts` | code |
| 6 | Wire `customer_code` from search response into `CompanySection` `selectOrg` | `print-room-staff-portal/src/components/orders/CompanySection.tsx` | code |
| 7 | Manual UI walkthrough (Plan task 22 steps 4/6/8/10 + tasks 18/19/20 unchecked steps) | browser, staff session | manual |
| 8 | Memory: append shipped lines + new pricing canonical memory | `~/.claude/projects/.../memory/*` | docs |

Confidence: tasks 1–6 are surgical (≤30 LOC each). Task 7 needs a staff session + Monday token. Task 8 is housekeeping.

## Open questions for Jamie before plan amendment

None remaining. Decisions locked:
- Pricing: unify on `effective_unit_price` (Q1 confirmed 2026-04-29).
- Scope: bundle 1–6 + memory; manual walkthrough at the end (Q2 confirmed 2026-04-29).
- Plan amendment vs separate doc: amend the existing plan with a "Reconciliation patch 2026-04-29" section appended after task 22 — keeps history visible.
