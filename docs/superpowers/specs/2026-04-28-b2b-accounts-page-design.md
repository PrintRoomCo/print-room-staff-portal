# `/b2b-accounts/[orgId]` Staff Page — Design Spec

**Date:** 2026-04-28
**Status:** Draft (design approved, awaiting implementation)
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)
**Source:** sub-app #3 spec §4.1 + §12 — "currently does not exist; will host the catalogues panel that consumes `/api/catalogues/by-org/[orgId]`". Catalogue editor's Assignment tab currently links to a 404.

## 1. Context

Sub-app #3 introduced the Assignment tab in the catalogue editor with a stub link to `/b2b-accounts/[orgId]` and an inline note "(route to be built in sibling spec)". This is that spec.

The page is the staff-facing account hub for a B2B organization: surfaces the org's commercial settings (`b2b_accounts` row), the org's locations (`stores` rows), the catalogues assigned to the org, and a derived "what this org actually sees" list that reflects either catalogue scope or the global B2B channel fallback per the `/shop` query semantics in sub-app #3 §7.

## 2. Goals

- Close the 404 from the catalogue editor's Assignment tab link.
- One staff page per org showing: identity, commercial terms, stores, catalogues, derived visible products.
- Inline edit b2b_account commercial fields without leaving the page.
- Inline edit stores; "+ Add store" dialog for new locations.
- Surface "Catalogue scope" vs. "Global B2B fallback" label so staff understand which `/shop` semantic is in effect.

## 3. Non-goals (out of scope)

- **Org admin** — name, address, customer_code edits live elsewhere (org-admin tool / Supabase). Header is read-only.
- **Multi-org catalogue assignment** — catalogues are 1:N org per sub-app #3. No "assign existing catalogue from another org" affordance.
- **Per-org activation toggling** — `product_type_activations` is a global B2B-channel flag, not per-org scoped. Toggling here would have global effect, which is misleading. Sibling spec needed if per-org activation is wanted (would require a `b2b_accounts ↔ products` join table).
- **Store delete** — set `is_active = false` instead. Hard delete is a separate spec.
- **Audit log** — out of scope. Tracked as v1.1.
- **Account-level pricing tier overrides** — the existing `b2b_accounts.tier_level → price_tiers.discount` mechanism stays the source of truth for non-catalogue pricing. No new per-org pricing surface here.

## 4. Architecture

### 4.1 Route structure

```
src/app/(portal)/b2b-accounts/[orgId]/page.tsx        Server component, parallel fetch
src/app/api/b2b-accounts/by-org/[orgId]/route.ts      GET account by org
src/app/api/b2b-accounts/route.ts                     POST create with defaults
src/app/api/b2b-accounts/[id]/route.ts                PATCH editable fields
src/app/api/stores/by-org/[orgId]/route.ts            GET stores by org
src/app/api/stores/route.ts                           POST create
src/app/api/stores/[id]/route.ts                      PATCH editable fields
```

### 4.2 Components

```
src/components/b2b-accounts/AccountTermsCard.tsx       Client island — inline edit b2b_account
src/components/b2b-accounts/StoresPanel.tsx            Client island — list + add + inline edit
src/components/b2b-accounts/AddStoreDialog.tsx         Modal for store creation
src/components/b2b-accounts/VisibleProductsList.tsx    Server-rendered table (no edits)
```

The Catalogues section reuses existing `CreateCatalogueDialog` with `defaultOrgId={params.orgId}` and an existing list query. No new components needed.

### 4.3 Auth helper

```
src/lib/b2b-accounts/server.ts        requireB2BAccountsStaffAccess
```

Mirrors the shape of `src/lib/catalogues/server.ts`. Permission key: `b2b_accounts:write`. Falls back to `admin` / `super_admin` role check.

### 4.4 Data layer

Initial render fetches in parallel via `getSupabaseAdmin`:

```ts
Promise.all([
  admin.from('organizations').select('...').eq('id', orgId).single(),
  admin.from('b2b_accounts').select('...').eq('organization_id', orgId).maybeSingle(),
  admin.from('stores').select('...').eq('organization_id', orgId).order('name'),
  admin.from('b2b_catalogues').select('id, name, is_active, ...').eq('organization_id', orgId),
  // visible-products derivation runs after catalogues resolves (sequential dependency)
])
```

The visible-products derivation:
- If any active catalogue exists → fetch all `b2b_catalogue_items` for the org's active catalogues, project to source `products` rows.
- Else → fetch `products` joined to `product_type_activations` filtered to the global B2B channel (mirrors `/shop` fallback query exactly).

Tag in the section header reflects which branch ran.

## 5. Data model

No schema changes. Reads/writes against existing tables:

| Table | Used for | RLS impact |
|---|---|---|
| `organizations` | Header, address read-only | None — service role |
| `b2b_accounts` | Account terms panel, edits | None — service role |
| `stores` | Stores panel, edits + add | None — service role |
| `b2b_catalogues` | Catalogues list | Existing RLS preserves customer-side scoping; staff use service role |
| `b2b_catalogue_items` | Visible-products list | Same |
| `product_type_activations` | Visible-products fallback | None — service role |

CHECK constraints to honour in UI:
- `b2b_accounts.payment_terms ∈ {'prepay','net20','net30'}`
- `b2b_accounts.default_deposit_percent ∈ {0,30,40,50,100}`

## 6. UI panels

### 6.1 Header (read-only)
- Org name (h1), customer_code badge, address (one-line).

### 6.2 Account terms (inline-editable)
- Fields: `tier_level` (1/2/3 dropdown), `payment_terms` (prepay/net20/net30 select), `default_deposit_percent` (0/30/40/50/100 select), `is_trusted` (checkbox), `credit_limit` (number input), `is_active` (toggle).
- Read-only: `platform`, `created_at`.
- Save on blur for inputs / on change for selects + checkbox. Errors surface inline above the card.
- If no `b2b_accounts` row exists for this org, panel shows: "No B2B account on file — [Create with default terms]". Button POSTs `/api/b2b-accounts` with `{ organization_id }`; server fills safe defaults (`tier_level=3`, `payment_terms='net30'`, `default_deposit_percent=0`, `is_trusted=false`, `is_active=true`, `platform='print-room'`).

### 6.3 Stores panel
- Table columns: name, address (one-line), is_active toggle, edit button.
- Inline edit row expands beneath on edit click.
- Footer: "+ Add store" button → `AddStoreDialog` with name + address fields. POST creates and refreshes.
- No delete — staff toggle `is_active` off instead.

### 6.4 Catalogues
- Table columns: name, # items, is_active, created_at, link to `/catalogues/[id]`.
- "+ New catalogue" button opens existing `CreateCatalogueDialog` with `organization_id` pre-filled.

### 6.5 What this org sees
- Section header: badge "Catalogue scope" (green) or "Global B2B fallback" (grey).
- Table columns: image, name, sku, link to `/products/[id]`.
- Read-only — toggling product visibility per-org isn't supported (see §3 non-goals).

## 7. API contracts

```ts
// GET /api/b2b-accounts/by-org/[orgId] → 200 { account: B2BAccount | null }
// POST /api/b2b-accounts → { organization_id } → 201 { id }
//   server fills defaults if any field omitted
// PATCH /api/b2b-accounts/[id] → Partial<{
//   tier_level: 1 | 2 | 3
//   payment_terms: 'prepay' | 'net20' | 'net30'
//   default_deposit_percent: 0 | 30 | 40 | 50 | 100
//   is_trusted: boolean
//   credit_limit: number | null
//   is_active: boolean
// }> → 200 { ok: true }

// GET /api/stores/by-org/[orgId] → 200 { stores: Store[] }
// POST /api/stores → { organization_id, name, address fields } → 201 { id }
// PATCH /api/stores/[id] → Partial<Store> → 200 { ok: true }
```

All routes guarded by `requireB2BAccountsStaffAccess`. Service-role writes; RLS not applicable.

## 8. 4-axis stack rationale

- **Rendering** — server component for initial fetch (per-request auth, fresh data, no SEO need). Client islands for inline-edit forms only. No CSR-only client routes.
- **Caching** — `dynamic = 'force-dynamic'`. Per-request, authenticated. No CDN cache.
- **Performance** — 4 parallel queries on initial load (org / account / stores / catalogues), then a 5th sequential query for visible-products that depends on the catalogues result. All indexed by `organization_id` or PK. PATCH endpoints are single-row updates. No expected regression on `/shop` or `/catalogues` performance.
- **Ecommerce pattern** — n/a (internal admin tooling).

## 9. Auth, permissions, RLS

- Permission key: `b2b_accounts:write`.
- Access rule (in `requireB2BAccountsStaffAccess`): `role in ('admin','super_admin') OR permissions @> '["b2b_accounts:write"]' OR permissions @> '["b2b_accounts"]'`.
- Sidebar nav: do NOT add a top-level entry in v1 — the page is reached via the catalogue editor's Assignment tab. Sidebar entry can land in a follow-up if staff want a list-of-orgs view.
- RLS: no new policies required. Reads + writes happen via service role on staff-gated API routes.

## 10. Verification

- Visit `/b2b-accounts/ee155266-200c-4b73-8dbd-be385db3e5b0` (PRT) — header shows "The Print Room Test", customer_code `PRT`, address line.
- Account terms panel shows current values (tier_level=1, payment_terms='net30', default_deposit_percent=0, is_trusted=true, platform='print-room').
- Edit tier_level → 2 → save → reload reflects 2.
- Edit payment_terms → invalid value blocked by select dropdown options.
- Stores panel shows Wanaka HQ; toggle is_active off → row visually fades and persists.
- "+ Add store" dialog → submit minimal name → row appears.
- Catalogues panel shows "PRT Demo Catalogue"; clicking row navigates to `/catalogues/[id]`.
- "+ New catalogue" opens dialog with PRT pre-filled.
- "What this org sees" header reads "Catalogue scope"; lists the 4 PRT Demo Catalogue items.
- Set catalogue is_active=false (via catalogue editor) → reload `/b2b-accounts/[orgId]` → header flips to "Global B2B fallback"; lists global B2B-channel products.
- Catalogue editor's Assignment tab link to `/b2b-accounts/[orgId]` no longer 404s.
- Non-permissioned staff: 403 on API routes, redirect from page (matches `requireCataloguesStaffAccess` pattern).
- New org with no `b2b_accounts` row → panel shows "Create with default terms"; clicking POSTs and refreshes with the new row in place.

## 11. Dependencies & follow-ups

- Consumes existing `GET /api/catalogues/by-org/[orgId]` (sub-app #3 §4.1).
- Reuses existing `CreateCatalogueDialog` component (sub-app #3 §6.5).
- **Follow-ups not in this spec:**
  - Top-level `/b2b-accounts` list page (all orgs).
  - Per-org product activation toggle (requires schema change).
  - Store hard-delete + restore.
  - Audit trail on b2b_account edits.
  - Account-level pricing tier overrides.

## 12. Open questions

None blocking. Defaults applied:
- New `b2b_accounts` row defaults: `tier_level=3`, `payment_terms='net30'`, `default_deposit_percent=0`, `is_trusted=false`, `is_active=true`, `platform='print-room'`.
- Permission key name: `b2b_accounts:write`.
- No sidebar entry in v1.
