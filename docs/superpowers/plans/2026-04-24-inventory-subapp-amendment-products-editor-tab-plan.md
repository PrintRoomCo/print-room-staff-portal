# Inventory Sub-app — 2026-04-24 Amendment — Products-Editor Inventory Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an **Inventory** tab to the Products sub-app's product editor — a peer of Swatches, Sizes, Images, Pricing — that surfaces per-org variant inventory inline so staff don't have to bounce between the Products page and the dedicated Inventory sub-app for the common "edit product, then top up stock" flow.

**Architecture:** Thin UI addition inside the already-shipped Products sub-app. Reuses the existing inventory primitives at `src/components/inventory/VariantGrid.tsx` + `AdjustDrawer.tsx`. One new read-side API endpoint returns per-org variants for a given product; writes still flow through the existing `/api/inventory/[orgId]/variants/[variantId]/adjust` endpoints. Permissions and RPCs are unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (service-role admin client + PostgREST), existing `TabNav` + `TabDef` primitives at `src/components/products/TabNav.tsx`.

---

## Context & scope

### Spec source

[docs/superpowers/specs/2026-04-20-staff-portal-inventory-subapp-design.md](../specs/2026-04-20-staff-portal-inventory-subapp-design.md) — §14 Amendment 2026-04-24.

Single item in scope: **§14.1 — Editing inventory from the Products sub-app.** Chris's 2026-04-24 call: inventory is a separate tab (not nested under Swatches) because Swatches carries colour→image mapping and Inventory carries stock counts — conceptually distinct.

### What this plan does NOT change

- The **data model** — `product_variants`, `variant_inventory`, `variant_inventory_events` (spec §5.1) are unchanged.
- The **RPCs** — `reserve_quote_line`, `release_quote_line`, `adjust_quote_line_delta`, `ship_quote_line`, `apply_staff_adjustment` (spec §7.1) are unchanged and are the only write paths.
- The **`inventory:write` permission gate** (spec §10.1) is unchanged.
- The **dedicated Inventory sub-app routes** at `/inventory`, `/inventory/[orgId]`, `/inventory/[orgId]/[productId]`, `/inventory/events` remain authoritative for cross-org views and the audit log. This tab is a convenience entry only.

### Relationship to the parent Inventory sub-app plan

[docs/superpowers/plans/2026-04-20-staff-portal-inventory-subapp-plan.md](./2026-04-20-staff-portal-inventory-subapp-plan.md) has 27 tasks covering the inventory schema, RPCs, webhook extension, and dedicated Inventory sub-app UI. This amendment plan is intentionally scoped as a **follow-up PR** that lands AFTER the parent plan — it depends on primitives (`VariantGrid`, `AdjustDrawer`) and the data model (`variant_inventory`, `product_variants`) from the parent.

If the parent plan has not shipped, this plan will fail at Task 1 (no data to query). Check parent-plan completion before starting.

### Current state (verified 2026-04-24 pre-plan)

- **ProductEditor** at [src/components/products/ProductEditor.tsx](../../src/components/products/ProductEditor.tsx) — uses `TabNav` with a `TABS: TabDef[]` array. Tab body switches on `active` key. Tabs are: details, swatches, sizes, images, pricing.
- **Existing inventory components** at [src/components/inventory/](../../src/components/inventory/) — includes `VariantGrid` (takes `{ orgId, productId, variants: VariantRow[] }`), `AdjustDrawer`, `TrackOrgPicker`, `OrgCard`, `TrackedProductsTable`, `TrackProductPicker`, `EventsFilters`, `EventsTable`.
- **VariantRow** type exported from `VariantGrid.tsx`.

### Tooling & verification baseline

No test runner in this repo (same as the customer portal). Verification per task:

- **Compile check:** `npx tsc --noEmit` from `print-room-staff-portal/`.
- **Build check:** `npm run build` from `print-room-staff-portal/`.
- **Runtime check:** `npm run dev`, exercise in a browser as a staff user with `inventory:write`.

### Files this plan touches

**Create:**
- `src/app/api/products/[id]/inventory-by-org/route.ts` — GET per-product inventory grouped by org.
- `src/components/products/tabs/InventoryTab.tsx` — new tab component.

**Modify:**
- `src/components/products/ProductEditor.tsx` — register the new tab.

That's it. Five files to look at, three to change. Small plan.

---

## Task 0: Pre-flight

**Files:** none (verification only).

- [x] **Step 0.1: Confirm parent plan has shipped** — verified 2026-04-24: schema (`product_variants`, `variant_inventory`, `variant_inventory_events`) live in Supabase; API routes `/api/inventory/*` all present; pages `/inventory`, `/inventory/[orgId]`, `/inventory/[orgId]/[productId]`, `/inventory/events` all live under `(portal)` route group; sidebar entry + `Boxes` import already wired in `Sidebar.tsx`; `inventory_orgs_summary`, `inventory_products_summary`, `inventory_events_search`, `inventory_variants_for_org` RPCs confirmed via existing API routes. Parent plan checkboxes were never ticked, but the code shipped.

Check the task checklist in [docs/superpowers/plans/2026-04-20-staff-portal-inventory-subapp-plan.md](./2026-04-20-staff-portal-inventory-subapp-plan.md). At minimum, these must be complete:

- Task 1: inventory schema (`product_variants`, `variant_inventory`, `variant_inventory_events`, `variant_availability`).
- The `VariantGrid` + `AdjustDrawer` components must be functional on `/inventory/[orgId]/[productId]`.

If the parent plan's Task 1 is not checked, stop here. Come back when it is.

- [x] **Step 0.2: Branch and baseline** — staying on `feat/product-editor` per Jamie's 2026-04-24 call (no new branch). Working tree clean, `npx tsc --noEmit` silent, clean `npm run build` succeeded with all 4 `/inventory/*` routes compiled as dynamic.

```bash
git status
git checkout -b feat/products-inventory-tab-2026-04-24
npx tsc --noEmit
npm run build
```

Expected: clean working tree → new branch created → zero TypeScript errors → build succeeds.

- [ ] **Step 0.3: Visual baseline** — deferred; no UI changes yet, Jamie can capture before Task 4 if a before/after comparison is wanted.

```bash
npm run dev
```

Visit `/products/[any active id]`. Confirm the ProductEditor renders with 5 tabs (Details, Swatches, Sizes, Images, Pricing) and each tab renders without error. Capture a screenshot. Stop the dev server.

- [x] **Step 0.4: Baseline commit marker** — commit `ae0ff8c` on `feat/product-editor`.

```bash
git commit --allow-empty -m "chore: baseline before products inventory-tab amendment"
```

---

## Task 1: `GET /api/products/[id]/inventory-by-org` endpoint

**Goal:** Return the set of variants with inventory rows for a given product, grouped by the organization that tracks them. One HTTP call populates the entire tab.

**Files:**
- Create: `src/app/api/products/[id]/inventory-by-org/route.ts`

- [x] **Step 1.1: Confirm the Inventory sub-app's variant-fetch pattern** — existing `/api/inventory/[orgId]/variants/route.ts` uses `inventory_variants_for_org(p_org_id, p_product_id)` RPC returning `VariantRow[]`. Endpoint adapted to a two-phase approach: PostgREST query for tracking orgs, then per-org RPC fan-out.

Before writing a new endpoint, check whether the parent Inventory sub-app already has a per-product variant endpoint (e.g. `/api/inventory/[orgId]/variants?product_id=X`). If yes, the new endpoint can be a thin wrapper that fans out across orgs. If no, write the query directly.

Grep:

```bash
grep -rn "variant_inventory" src/app/api
```

Adapt the query pattern (joins, column names) to match what's actually in the repo at that point.

- [x] **Step 1.2: Create the route file** — created at `src/app/api/products/[id]/inventory-by-org/route.ts`. Adapted from plan's sample: uses `requireInventoryStaffAccess` (existing helper) instead of the plan's non-existent `requirePermission`; two-phase query (PostgREST tracking orgs + per-org `inventory_variants_for_org` RPC) instead of a single deep-nested select, for parity with the four `(portal)/inventory/*` pages.

Create `src/app/api/products/[id]/inventory-by-org/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import type { VariantRow } from '@/components/inventory/VariantGrid'

export interface InventoryOrgBundle {
  org_id: string
  org_name: string
  variants: VariantRow[]
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 16 async params — must await per repo's AGENTS.md guidance.
  const { id: productId } = await params

  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin
    .from('variant_inventory')
    .select(
      `
      variant_id,
      organization_id,
      stock_qty,
      committed_qty,
      updated_at,
      organizations ( id, name ),
      product_variants!inner (
        product_id,
        color_swatch_id,
        size_id,
        product_color_swatches ( name, hex ),
        sizes ( label, display_order )
      )
    `
    )
    .eq('product_variants.product_id', productId)

  if (error) {
    console.error('[ProductInventoryByOrg API] query failed:', error.message)
    return NextResponse.json({ orgs: [] }, { status: 500 })
  }

  // Group by org_id, flatten into VariantRow shape.
  const byOrg = new Map<string, InventoryOrgBundle>()

  for (const row of (data ?? []) as any[]) {
    const orgId = row.organization_id
    const orgName = row.organizations?.name ?? 'Unknown'
    if (!byOrg.has(orgId)) {
      byOrg.set(orgId, { org_id: orgId, org_name: orgName, variants: [] })
    }
    byOrg.get(orgId)!.variants.push({
      variant_id: row.variant_id,
      product_id: row.product_variants?.product_id,
      color_swatch_id: row.product_variants?.color_swatch_id ?? null,
      color_label: row.product_variants?.product_color_swatches?.name ?? null,
      color_hex: row.product_variants?.product_color_swatches?.hex ?? null,
      size_id: row.product_variants?.size_id ?? null,
      size_label: row.product_variants?.sizes?.label ?? null,
      size_order: row.product_variants?.sizes?.display_order ?? null,
      stock_qty: row.stock_qty ?? 0,
      committed_qty: row.committed_qty ?? 0,
      available_qty: (row.stock_qty ?? 0) - (row.committed_qty ?? 0),
    })
  }

  // Alphabetical sort of orgs for deterministic rendering.
  const orgs = Array.from(byOrg.values()).sort((a, b) =>
    a.org_name.localeCompare(b.org_name)
  )

  return NextResponse.json({ orgs })
}
```

**Auth helper note (patched 2026-04-24):** sample above uses the existing `requireInventoryStaffAccess` helper at `@/lib/inventory/server` — returns `{ admin, context } | { error: NextResponse }` with 401 for unauth / 403 for missing `inventory` or `inventory:write` perm / 403 for admin-or-super_admin-or-bust. No new `requirePermission` helper needed. (Original plan referenced a non-existent `@/lib/auth/can` helper; corrected when Task 1 landed.)

**If the `display_order` column on `sizes` doesn't exist:** use whatever ordering column the parent plan uses (`order`, `position`, etc.). Default to `null` if absent and VariantGrid will fall back to insertion order.

- [x] **Step 1.3: Compile** — `npx tsc --noEmit` silent (zero errors). Verified both by implementer and controller.

```bash
npx tsc --noEmit
```

Expected: zero errors. The `any[]` cast on the query result is intentional — PostgREST join shapes are hard to type without generated types. Leave the cast.

- [ ] **Step 1.4: Smoke-test the endpoint** — deferred to Task 4 where Jamie drives the browser as an authenticated staff user.

```bash
npm run dev
```

Log in as a staff user with `inventory:write`. Hit `http://localhost:3000/api/products/[existing-product-id]/inventory-by-org` for a product that at least one customer is tracking (per parent plan's seed fixtures). Expected:

- Status 200
- JSON body `{ orgs: [{ org_id, org_name, variants: [...] }, ...] }`.
- For a product nobody tracks → `{ orgs: [] }`.

Log out → hit again → expect 401/403 depending on the auth helper.

Stop the dev server.

- [x] **Step 1.5: Commit** — committed with plan-file ticks + `requirePermission` sample patch bundled in.

```bash
git add src/app/api/products/\[id\]/inventory-by-org/route.ts
git commit -m "feat(inventory): GET /api/products/[id]/inventory-by-org for editor tab"
```

---

## Task 2: `InventoryTab` component

**Goal:** Orchestrator that fetches the per-org bundles and renders one `VariantGrid` per org with a header. Empty state when nobody tracks the product.

**Files:**
- Create: `src/components/products/tabs/InventoryTab.tsx`

- [ ] **Step 2.1: Create the component**

Create `src/components/products/tabs/InventoryTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VariantGrid } from '@/components/inventory/VariantGrid'
import type { InventoryOrgBundle } from '@/app/api/products/[id]/inventory-by-org/route'

interface InventoryTabProps {
  productId: string
}

export function InventoryTab({ productId }: InventoryTabProps) {
  const [orgs, setOrgs] = useState<InventoryOrgBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/products/${productId}/inventory-by-org`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? 'You need inventory:write to view per-product inventory.'
              : `Failed to load inventory (status ${res.status}).`
          )
        }
        return res.json() as Promise<{ orgs: InventoryOrgBundle[] }>
      })
      .then((data) => {
        setOrgs(data.orgs ?? [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load inventory.')
        setLoading(false)
      })
  }, [productId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        <p className="mb-2">No customers are tracking stock for this product yet.</p>
        <p>
          Use the{' '}
          <Link href="/inventory" className="text-blue-600 hover:underline">
            Inventory sub-app
          </Link>{' '}
          to start tracking this product for a customer.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-xs text-gray-500">
        Inventory adjustments on this page update the same data as the dedicated
        Inventory sub-app. Cross-org views and the audit log live in the{' '}
        <Link href="/inventory" className="text-blue-600 hover:underline">
          Inventory sub-app
        </Link>
        .
      </div>

      {orgs.map((bundle) => (
        <section key={bundle.org_id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {bundle.org_name}
            </h3>
            <Link
              href={`/inventory/${bundle.org_id}/${productId}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Open in Inventory sub-app →
            </Link>
          </div>
          <VariantGrid
            orgId={bundle.org_id}
            productId={productId}
            variants={bundle.variants}
          />
        </section>
      ))}
    </div>
  )
}
```

Key behaviour:
- One `VariantGrid` per org — staff see all customers who track this product at once.
- Per-org "Open in Inventory sub-app" link deep-links to the product's existing variant-detail page, so staff can bounce to the full tooling for recounts / write-offs / audit log if needed.
- Empty state explicitly points at `/inventory` with an explanation — doesn't just dead-end.
- Error state surfaces the 403 specifically so non-permissioned staff understand why they can't see anything.

- [ ] **Step 2.2: Compile**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `InventoryOrgBundle` import path fails (e.g. the App Router rewrites `route.ts` export paths), move the type to `src/types/inventory.ts` and import from there instead.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/products/tabs/InventoryTab.tsx
git commit -m "feat(inventory): InventoryTab component for products editor"
```

---

## Task 3: Register the Inventory tab in `ProductEditor`

**Goal:** Make the tab reachable from the product editor UI, peer of Swatches (not nested).

**Files:**
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 3.1: Add the import**

At the top of `src/components/products/ProductEditor.tsx`, add alongside the other tab imports (line 7-11):

```ts
import { InventoryTab } from './tabs/InventoryTab'
```

- [ ] **Step 3.2: Extend the `TABS` array**

Replace the `TABS` array at lines 14-20:

```ts
const TABS: TabDef[] = [
  { key: 'details', label: 'Details' },
  { key: 'swatches', label: 'Swatches' },
  { key: 'sizes', label: 'Sizes' },
  { key: 'images', label: 'Images' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'inventory', label: 'Inventory' },
]
```

Order matters here: **Inventory comes LAST**, per Chris's 2026-04-24 call — a peer of Swatches, not nested, but visually sits after Pricing so the common editing flow (Details → Swatches → Sizes → Images → Pricing) stays front-of-mind and Inventory is visible but out of the way for products without tracked stock.

- [ ] **Step 3.3: Add the tab body switch**

In the tab body at lines 96-113, add one more conditional:

```tsx
{active === 'pricing' && <PricingTab productId={product.id} />}
{active === 'inventory' && <InventoryTab productId={product.id} />}
```

- [ ] **Step 3.4: Compile**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/products/ProductEditor.tsx
git commit -m "feat(products): register Inventory tab in ProductEditor"
```

---

## Task 4: End-to-end dev-server verification

**Goal:** Confirm the full flow works — tab appears, data loads, grids render, empty state behaves, non-permissioned staff see the error.

**Files:** none (verification only).

- [ ] **Step 4.1: Compile + build clean**

```bash
npx tsc --noEmit && npm run build
```

Expected: both succeed with zero errors.

- [ ] **Step 4.2: Dev session**

```bash
npm run dev
```

- [ ] **Step 4.3: Populated tab**

- Sign in as a staff user with `inventory:write`.
- Navigate to `/products/[id]` for a product tracked by Reburger / Bike Glendhu / Otago Polytech (whichever the parent plan seeded).
- Click the **Inventory** tab.
- Expected: one section per tracking org, each showing a `VariantGrid`. Per-org "Open in Inventory sub-app →" link present. Cell click opens `AdjustDrawer` (delegated — we don't own that component).

- [ ] **Step 4.4: Empty tab**

- Navigate to `/products/[id]` for a product nobody tracks (any non-stocked product).
- Click **Inventory**.
- Expected: empty state copy with a link to `/inventory`.

- [ ] **Step 4.5: Permission gate**

- Sign in as a staff user WITHOUT `inventory:write` (if any exists in the seed).
- Click **Inventory** on any product.
- Expected: red error banner: "You need inventory:write to view per-product inventory."

If no such staff account exists in the seed, skip 4.5 and note the gap — it can be tested against prod auth later.

- [ ] **Step 4.6: Deep-linking**

- With the tab open, copy the URL. Should end with `#inventory`.
- Close the page, paste the URL, reopen. Tab reopens to Inventory directly (hash-based deep linking via `useEffect` at [ProductEditor.tsx:35-38](../../src/components/products/ProductEditor.tsx#L35-L38) already handles this — no new code needed, just verify).

- [ ] **Step 4.7: Commit verification marker**

```bash
git commit --allow-empty -m "chore: verified Inventory tab end-to-end"
```

---

## Self-review checklist

**Spec coverage:**
- [x] §14.1 Products-editor Inventory tab as peer of Swatches — Task 3
- [x] Same API routes + permissions + RPCs — Tasks 1 + 2 (new read endpoint only; writes still flow through existing adjust endpoints via `AdjustDrawer`)
- [x] Reuses `src/components/inventory/...` primitives (`VariantGrid`) — Task 2
- [x] Cross-org views + audit log remain in the dedicated sub-app — explicitly linked from the tab

**Placeholder scan:** No `TBD`, `TODO`, or unspecified branches.

**Type consistency:**
- `InventoryOrgBundle` — defined in Task 1 (route file), consumed in Task 2 (tab component).
- `VariantRow` — consumed in Task 1 (assembling the bundle), consumed in Task 2 (passed through to `VariantGrid`).
- `productId: string` prop on `InventoryTab` matches the pattern already used by `SwatchesTab`, `SizesTab`, `ImagesTab`, `PricingTab`.

**External dependencies:**
- Parent Inventory sub-app plan Task 1 (schema) must have landed.
- `VariantGrid` + `AdjustDrawer` must be callable with the documented props.
- `requirePermission` auth helper must exist at `@/lib/auth/can` with the `inventory:write` key.

**Not fabricated:**
- `ProductEditor.tsx` structure verified at lines 1-117 (2026-04-24).
- Existing tabs verified via glob: `DetailsTab.tsx`, `ImagesTab.tsx`, `PricingTab.tsx`, `SizesTab.tsx`, `SwatchesTab.tsx`.
- Inventory primitives verified via glob: `AdjustDrawer.tsx`, `EventsFilters.tsx`, `EventsTable.tsx`, `OrgCard.tsx`, `TrackOrgPicker.tsx`, `TrackProductPicker.tsx`, `TrackedProductsTable.tsx`, `VariantGrid.tsx`.
- `VariantRow` type confirmed at `src/components/inventory/VariantGrid.tsx:6-18`.

---

## Out-of-scope reminders

- **Pricing editor enhancements** — separate spec + plan (Stream B).
- **Metafields** — separate spec + plan (Stream B).
- **B2B catalogues & companies sub-app #3** — pending spec brainstorming.
- **Bulk operations from this tab** (e.g. "start tracking for new org from the product page") — dedicated Inventory sub-app covers that at `/inventory/[orgId]` → Track new product. Adding a mirror here is a v1.1 ergonomics call, not in scope.

---

## Dependencies & follow-ups

**Blocks:**
- None. This is a terminal amendment.

**Depends on:**
- Parent 2026-04-20 Inventory sub-app plan — Task 1 (schema), VariantGrid + AdjustDrawer components, `inventory:write` permission.

**Follow-ups (v1.1):**
- If staff report the per-product Inventory tab is heavier than the dedicated sub-app for bulk work, consider a "Start tracking" affordance in the empty state that calls the parent plan's `POST /api/products/[id]/variants/bulk` endpoint directly. v1 keeps the empty state read-only to avoid duplicating functionality.

---

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
