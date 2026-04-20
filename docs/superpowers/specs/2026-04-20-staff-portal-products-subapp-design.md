# Sub-app #1 — Products — Design Spec

**Date:** 2026-04-20
**Status:** Approved (sections A–H, 2026-04-20)
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)

## 1. Context

The Print Room is moving B2B/workwear customers off Shopify onto an own-built platform. Architecture is two Next.js apps sharing one Supabase backend:

- `print-room-staff-portal` — internal/staff tools (this app)
- `print-room-portal` — customer-facing B2B portal

Four staff-portal sub-apps are planned in build order: **Products → Inventory → B2B catalogues & companies → B2B order entry (CSR)**. This spec covers sub-app #1.

Today, product editing for the workwear/uniforms range happens in `middleware-pr` — a standalone Node/Express/EJS tool against the same Supabase project (`bthsxgmcnbvwwgvdveek`), filtered to `platform = 'uniforms'`. It works but lives outside the staff portal, contributing to platform fragmentation.

Sub-app #1 ports `middleware-pr`'s product editor into the staff portal, adds a controlled-vocabulary type-tag system Chris asked for, and keeps `platform = 'uniforms'` scope for v1 (v1.1 will unify across `'print-room'` too).

## 2. Goals

- Full feature parity with `middleware-pr` for the `platform = 'uniforms'` slice (1,863 products as of 2026-04-20).
- Native staff-portal experience: same auth gate, same nav, same component primitives.
- New product-type filter (workwear / pre-order / B2B) using the existing `products.tags` column.
- "Live on Shopify" filter using the existing `products.shopify_product_id` column.
- Tabbed single-page editor (no page-jumps to manage variants).
- Path is open for v1.1 to drop the platform-scope guard and become the unified editor for all products.

## 3. Non-goals (out of scope)

- Editing `platform = 'print-room'` products (v1.1).
- Inventory / stock levels (sub-app #2).
- Per-company catalogue assignment & price overrides (sub-app #3).
- Variant inventory (color × size as a single SKU) — sub-app #2 introduces a `product_variants` table.
- Bulk import / CSV upload — `middleware-pr` doesn't have it; not adding now.
- Decommissioning `middleware-pr` immediately — both run side-by-side until parity is confirmed.

## 4. Architecture

### 4.1 Route structure

New route group inside the existing `(portal)` segment:

```
src/app/(portal)/products/
  page.tsx              List: search, filters, pagination (25/page)
  new/page.tsx          Create form (core fields only — sub-resources unlock after save)
  [id]/page.tsx         Tabbed editor (Details / Swatches / Sizes / Images / Pricing)
src/app/api/products/
  route.ts                                 POST create, GET list (server-side query)
  [id]/route.ts                            GET / PATCH / DELETE one product
  [id]/toggle-active/route.ts              POST quick toggle
  [id]/swatches/route.ts                   GET / POST swatches for product
  [id]/swatches/[swatchId]/route.ts        PATCH / DELETE
  [id]/sizes/route.ts                      GET / POST sizes
  [id]/sizes/[sizeId]/route.ts             PATCH / DELETE
  [id]/images/route.ts                     GET / POST images
  [id]/images/[imageId]/route.ts           PATCH / DELETE
  [id]/pricing-tiers/route.ts              GET / POST tiers
  [id]/pricing-tiers/[tierId]/route.ts     PATCH / DELETE
```

### 4.2 Data layer

API routes use the existing `src/lib/supabase-server.ts` client (service-role key, behind staff auth). RLS is not required on the products surface for v1 since access is gated by middleware + permission flag.

Page components are server components for the list view (initial render), with client components for interactive editing. The editor's tabs are client components with per-tab local form state and per-tab save buttons (no global form — keeps each tab independent and avoids losing in-progress edits in other tabs).

### 4.3 Hard-coded scope filter (v1)

Every server-side products query and every API mutation includes `.eq('platform', 'uniforms')`. The filter is centralized in a single helper (`src/lib/products/scope.ts` or similar) so v1.1 can swap it for a user-selectable filter in one place.

## 5. Data model

**No migrations required for v1.** All needed columns exist on the `products` table:

| Column | Type | Use |
|---|---|---|
| `tags` | `text[]` (NOT NULL, default `{}`) | Product-type labels: `workwear`, `preorder`, `b2b`. Existing `leavers` and `design-tool` reserved. |
| `shopify_product_id` | `text` | Presence = "live on Shopify" (no separate flag needed). |
| `platform` | `text` (NOT NULL, default `'print-room'`) | Source/pipeline. Untouched. v1 hard-filters to `'uniforms'`. |

### 5.1 Controlled vocabulary

Define in `src/lib/products/tags.ts`:

```ts
export const PRODUCT_TYPE_TAGS = ['workwear', 'preorder', 'b2b'] as const
export const RESERVED_TAGS = ['leavers', 'design-tool'] as const  // pre-existing
export const ALLOWED_TAGS = [...PRODUCT_TYPE_TAGS, ...RESERVED_TAGS]
```

Filter UI surfaces only `PRODUCT_TYPE_TAGS`. Reserved tags are preserved on save (no UI to add/remove them in v1).

### 5.2 Postgres CHECK constraint (deferred)

A CHECK constraint enforcing `tags <@ ARRAY['workwear','preorder','b2b','leavers','design-tool']` would catch typos at the DB layer. **Deferred to v1.1** — easier to add later than to walk back if other systems are writing free-form tags we don't yet know about. Application-level validation in the API routes is the v1 guard.

## 6. List page (`/products`)

### 6.1 Filters

| Filter | Behaviour |
|---|---|
| Search | `name ilike '%term%'` |
| Brand | Single-select dropdown |
| Category | Single-select dropdown |
| Garment family | Single-select (16-value list ported from `middleware-pr`) |
| Type tags | 3 checkboxes: Workwear / Pre-order / B2B. AND semantics (must include all checked). Empty = no filter. |
| Live on Shopify | Tri-state: All / Yes / No (queries `shopify_product_id IS NOT NULL` / `IS NULL`) |
| Active | Tri-state: All / Active / Inactive |

### 6.2 Layout

- 25 rows per page, total count shown.
- Each row: thumbnail (from `image_url` or first `product_images` entry), name, SKU, brand, category, badges for each tag + Shopify-live, active-toggle button, Edit link.
- Filter state encoded in URL query string (deep-linkable; survives back/forward).
- Empty state: "No products match these filters" with a Clear-filters link.

### 6.3 Garment family list (ported)

```ts
['accessories','belt','corporate','crew','headwear','healthcare',
 'hoodie','jacket','pants','polo','scrubs','shirt','shorts',
 'tee','trades','vest']
```

## 7. Tabbed editor (`/products/[id]`)

Top-tab navigation. Per-tab local form state. Per-tab Save button. No global form (keeps each tab independent).

### 7.1 Tab: Details

Editable fields (matches `middleware-pr` plus the new tag UI):

- **Identity:** name (required), sku, supplier_code, code, description
- **Classification:** brand_id (required, dropdown), category_id (required, dropdown), garment_family (dropdown), industry (multi-input → text[]), **product-type tags** (3 checkboxes)
- **Pricing & costs:** base_cost, markup_pct, decoration_eligible (bool), decoration_price
- **Specs & ops:** specs (JSON textarea with parse validation), safety_standard, moq, lead_time_days, sizing_type, default_sizes
- **Flags:** supports_labels, is_hero, is_active (toggle)
- **Read-only:** `shopify_product_id` displayed with "View in Shopify admin" link if present, "Not synced to Shopify" otherwise; `platform`, `created_at`, `updated_at`.

Validation:
- name: trim, required, non-empty
- brand_id, category_id: required
- specs: must parse as valid JSON if provided
- numeric fields: parsed via `parseFloat` / `parseInt`; nullable on empty
- tags on save: server-side guard rejects values not in `ALLOWED_TAGS`

### 7.2 Tab: Swatches

CRUD over `product_color_swatches` for the current product:

- Grid of swatch cards (hex color preview, name, optional image thumbnail).
- Add: native color picker + name + optional image URL.
- Edit/delete inline.

### 7.3 Tab: Sizes

CRUD over `sizes` for the current product:

- Quick-add row: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL.
- Custom-size text input + Add button.
- Delete inline.
- Drag-reorder is a nice-to-have — defer if it slips v1.

### 7.4 Tab: Images

CRUD over `product_images`:

- Paste URL + view-type select (front / back / side / detail).
- Grid preview, set-primary action, delete.
- Validation: URL must be http(s) and resolvable to an image (basic shape check, no fetch).

### 7.5 Tab: Pricing tiers

CRUD over `product_pricing_tiers`:

- Quantity-bracket rows: `min_qty`, `max_qty` (nullable for "+"), `price`.
- Add/edit/delete inline.
- Sort by `min_qty` ascending.

### 7.6 Component primitives

All UI built from `src/components/ui/`: `Button`, `Card`, `Input`, `Textarea`, `Badge`. New components live in `src/components/products/` (e.g. `ProductFilters.tsx`, `ProductTabs.tsx`, `SwatchManager.tsx`, etc.). No new dependencies.

Tab navigation is a simple custom tab list with active underline — no Radix/Headless additions.

Page background, spacing, font (DM Sans), and palette match the existing portal — no new design tokens.

## 8. Auth & permissions

- The existing `src/middleware.ts` (Supabase Auth check) already gates the `(portal)` group. No middleware change.
- Add a permission key `products:write` to `staff_users.permissions` JSONB.
- Access rule: `role IN ('admin', 'super_admin')` OR `permissions @> '["products:write"]'`.
- Sidebar nav: Products entry visible only to users with the permission (mirrors existing pattern in `src/components/layout/Sidebar.tsx`).
- Server-side guard on every API route in `src/app/api/products/**`: load `staff_users` row for the authenticated user, return 403 if access rule fails.
- A small helper `src/lib/auth/can.ts` (or similar) centralises the rule for both UI and API checks.

## 9. Decommission plan for `middleware-pr`

1. v1 ships and is announced to staff who use `middleware-pr`.
2. Both tools run side-by-side for ≥ 1 week.
3. If no parity gaps reported, `middleware-pr` Replit deployment is paused (not deleted — kept as a fallback for 1 month).
4. After 1 month of paused-with-no-issues, `middleware-pr` repo is archived on GitHub.

The Supabase project, products table, and all sub-tables are unchanged throughout. Both tools talk to the same DB; there's no cutover/migration moment.

## 10. Decisions made (with defaults applied per auto-mode)

| # | Decision | Default chosen | Override needed? |
|---|---|---|---|
| 1 | Permission key name | `products:write` | Tell me if you want a different key |
| 2 | Tag CHECK constraint timing | Defer to v1.1 | Tell me if you want it now |
| 3 | Decommission criterion | 1 week side-by-side, no parity gaps reported | Tell me if you want different |
| 4 | Spec doc location | This repo (`docs/superpowers/specs/`) | Move if you'd rather it live in a docs repo |

## 11. Dependencies & follow-ups (not in this spec)

- **Sub-app #2 (Inventory)** — will introduce `product_variants` (color_id × size_id, with stock/reservations). The size and swatch tables remain unchanged; variants reference them.
- **Sub-app #3 (B2B catalogues)** — per-company catalogue membership and price overrides. The product-type tag `b2b` is a *general* B2B-eligibility flag, not a per-company assignment.
- **Sub-app #4 (B2B order entry)** — consumes products + tier pricing + (sub-app #2) inventory.
- **v1.1 unification** — drop the hard-coded `platform = 'uniforms'` filter, surface `platform` as a top-level filter; add CHECK constraint on `tags`; assess decommissioning the older `platform = 'print-room'` editor (whatever currently edits those 1,955 rows).

## 12. Verification

- All 1,863 `platform = 'uniforms'` products list, paginate, and filter correctly.
- Type-tag filter narrows results when checked; combinations behave as AND.
- Live-on-Shopify tri-state queries `shopify_product_id` correctly.
- Each tab in the editor saves independently; no other tab's in-progress edits are lost.
- Sub-resource CRUD (swatches, sizes, images, pricing tiers) round-trips.
- Active toggle works from both list and editor.
- Permission check denies non-permitted staff with 403 on API and a redirect on UI.
- `middleware-pr` and the new editor both round-trip a product without conflict (last-write-wins acceptable for v1; updated_at always advances).
