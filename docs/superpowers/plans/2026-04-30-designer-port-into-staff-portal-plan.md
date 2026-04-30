# Designer (Design Tool) — Ported Into Staff Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the design tool's catalog / design-canvas / review pages into the staff portal as native staff-only routes under `/(portal)/designer/`, ending in a B2B catalogue item that carries both raw artwork (`design_artwork`) and a rendered design snapshot (`design_snapshots`) — so the customer portal PDP can render the designed mockup without any design-tool dependency. Reuses the existing `design_submissions` flow with `status='approved'` from the start. Net schema change: zero.

**Spec:** [2026-04-30-designer-port-into-staff-portal-design.md](../specs/2026-04-30-designer-port-into-staff-portal-design.md) (locked 2026-04-30, all §9 decisions resolved).

**Supersedes:** the iframe-based proof-builder integration deleted 2026-04-29 (`memory/project_proof_iframe_consolidation.md`).

**Architecture:**
- New route group `src/app/(portal)/designer/` with three top-level segments (`catalog/`, `design/[productId]/[instanceId]/`, `review/[instanceId]/`).
- `@print-room-studio/pricing` is consumed via `pnpm`/`npm` `file:` protocol from the sister monorepo `print-room-studio/packages/pricing/` (already a workspace package — no extraction needed).
- Design-tool RPC client wrappers (`embroidery-rpc-client.ts`, `heat-rpc-client.ts`) and the snapshot worker are re-ported as staff-portal local files under `src/lib/designer/` and `src/components/designer/`.
- New write paths: `design_artwork` (table empty today; first production usage) + `proof_catalogue_links` (table empty today; first production usage).
- Customer portal `/shop` and PDP read-through patches in `print-room-portal` — flagged **CROSS-REPO**.
- Design-tool's public `/design`, `/review`, `/catalog` routes get a layout-level staff-auth guard (per §9.5 lock) — flagged **CROSS-REPO**.

**Tech Stack:** Next.js 16 (App Router, async `params`), React 19, Tailwind v4, TypeScript, Supabase (Auth + Postgres + RPC + Storage), Fabric.js (ported), html2canvas (ported, v1, client-side per §9.4 lock), Sharp (new auto-swatch endpoint, k=5 colour quantisation), pnpm workspace consumption via `file:` protocol per §9.1 lock.

**Repos touched:**
- `print-room-staff-portal` — primary. New route group + components + lib + API routes.
- `print-room-studio/apps/design-tool` — §9.5 layout-level auth guard (CROSS-REPO).
- `print-room-studio/packages/pricing` — verify existing package builds and exports cover what the staff portal needs; promote `embroidery-rpc-client.ts` / `heat-rpc-client.ts` from app-internal to package-public if they're prerequisites of the consumed exports (CROSS-REPO; first-task investigation).
- `print-room-portal` — `app/(portal)/shop/page.tsx` and `app/(portal)/shop/[productId]/page.tsx` get LEFT JOINs to `proof_catalogue_links` + `design_snapshots` with fallback to `product_images.file_url` (CROSS-REPO).

**Next.js 16 note (per both staff-portal AND customer-portal AGENTS.md):** `params` in pages and route handlers is `Promise<...>` — always `await`. Server files reading cookies use `await cookies()`. Re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `…/page.md` before writing route handlers or pages.

**Verification policy:** No JS test framework is installed in `print-room-staff-portal`. Customer portal `print-room-portal` has vitest configured but per-task it's only worth wiring tests for the queries in Phase 5; for everything else, verification is `npx tsc --noEmit` + `npm run build` + dev-server smoke per Jamie's plan policy (`memory/project_b2b_plans_set.md`).

**Destructive-write policy:** This plan introduces ZERO schema migrations (per spec §5 — "net schema change is zero"). Every existing table is reused. If a task discovers a missing column or constraint, surface to Jamie before applying any migration. **Do not call `mcp__claude_ai_Supabase__apply_migration`.** SQL probes via `mcp__claude_ai_Supabase__execute_sql` are read-only and OK.

---

## Ambiguities Resolved (per spec §9 — locked 2026-04-30)

1. **§9.1 Workspace strategy — extract to package + file: protocol locally.**
   *Decision:* Consume `@print-room-studio/pricing` from staff portal via `npm install file:../print-room-studio/packages/pricing`. Defer npm publish until CI requires it.
   *Rationale:* (a) full pnpm-workspace expansion is too much upfront cost for a single integration point; (c) symlinks are fragile; (b) keeps the package source single-sourced. The `file:` protocol works for the single-developer setup.
   *Refinement discovered during exploration 2026-04-30:* the package ALREADY EXISTS at `print-room-studio/packages/pricing/`. Phase 1 Task 1.1 is therefore consumption, not extraction. RPC client wrappers `embroidery-rpc-client.ts` and `heat-rpc-client.ts` currently live at `apps/design-tool/src/lib/pricing/` (app-internal) — Task 1.2 evaluates whether they need to be promoted into `packages/pricing/` so the staff portal can call the RPCs without re-porting; the cheap path is re-port.

2. **§9.2 Designer-catalog visibility — `decoration_eligible=true` AND canvas-readiness join.**
   *Decision:* Catalog query filters `decoration_eligible=true AND EXISTS (SELECT 1 FROM product_images WHERE product_id=p.id AND view_lower='front')`.
   *Rationale:* Without a front-view image, the Fabric.js canvas renders an empty grey square — a v1 guard. The Add Product modal in §6.1 always uploads a front-view image, so all designer-created products auto-pass.

3. **§9.3 Catalogue-item price source — store both, surface diff.**
   *Decision:* `b2b_catalogue_items.metafields.pricing_snapshot` holds the design-tool snapshot at submission time. The catalogue editor recomputes `effective_unit_price` live and surfaces the diff as a chip on each item ("Snapshot: $42.50 · Live: $44.00 · diff +$1.50").
   *Rationale:* Snapshot for audit, live for display. Account managers can re-snapshot via "Refresh from design" or update the live price upstream.

4. **§9.4 Snapshot capture — client-side v1, instrument and escalate.**
   *Decision:* Keep the design tool's `<SnapshotCaptureWorker>` (html2canvas) as-is. Add structured logging on every snapshot upload outcome (success/failure + `userAgent` + `viewport` + `view` + `bytes`). Escalate to server-side renderer only if Phase 4 demo or post-launch monitoring shows >5% capture failures.
   *Rationale:* Existing 10 successful `design_snapshots` rows in production suggest html2canvas works in the design tool's context. Logging gives the data to make a future call.

5. **§9.5 Customer self-serve cutoff — hide behind staff auth (don't delete).**
   *Decision:* Add a layout-level auth guard at `print-room-studio/apps/design-tool/src/app/(public-design)/layout.tsx` (a new route group wrapping `catalog/`, `design/`, `review/`). Redirect unauthenticated requests to the staff portal sign-in URL.
   *Rationale:* Preserves the option to flip on customer self-serve later — it becomes a config flag rather than a re-port. Prevents accidental URL discovery while routes are dormant.

---

## Pre-flight — PRT cleanup (✅ 2026-04-30)

Two transactional cleanups completed before this plan starts:

- **Round 1** (8 PRT-test products + 2 empty PRT catalogues — `Collection 1` + `PRT Demo Catalogue`): 142 rows deleted across 11 tables. Audit pre-flagged cascade-safe; verified in-flight + post-COMMIT.
- **Round 2** (9 surviving b2b-channel products per Jamie's clean-slate call so Phase 2 dogfoods Add Product as the seed): 217 rows deleted across 7 tables. `Custom Manufactured` brand's `hero_product_id` SET NULL (was test stub `aaaaaaa1…`).

PRT today: org / store / b2b_account / `hello@` admin link preserved; **zero `b2b`-channel active products**, **zero catalogues**, **zero `b2b_catalogue_items`**. Phase 2's Add Product modal IS the seed of the next `Barnard Tank`, `Box Hood`, `Box Tee`, etc., uploaded by hand through the new flow.

---

## File structure

### New files (staff portal: `print-room-staff-portal`)

- `src/app/(portal)/designer/layout.tsx` — staff-auth gated layout (mirrors existing `(portal)` shell)
- `src/app/(portal)/designer/catalog/page.tsx` — ported `CatalogView` host + "+ Add product" tile
- `src/app/(portal)/designer/design/[productId]/[instanceId]/page.tsx` — ported design canvas host
- `src/app/(portal)/designer/review/[instanceId]/page.tsx` — ported review host + "Add to B2B catalogue" panel
- `src/app/(portal)/designer/_dev/pricing-test/page.tsx` — Phase 1 demo gate route (dev-only, removable)
- `src/app/api/designer/upload-asset/route.ts` — re-port of design tool's `/api/upload-asset`
- `src/app/api/designer/products/auto-swatch/route.ts` — NEW Sharp k=5 colour quantisation
- `src/app/api/designer/submissions/route.ts` — NEW transactional `design_submissions` + `b2b_catalogue_items` + `proof_catalogue_links` insert
- `src/app/api/designer/snapshot-log/route.ts` — NEW structured logging sink for §9.4 instrumentation (writes to `application_logs` or stdout if no table)
- `src/components/designer/catalog/CatalogView.tsx` — ported
- `src/components/designer/catalog/FilterBar.tsx` — ported
- `src/components/designer/catalog/AddProductTile.tsx` — NEW; opens AddProductModal
- `src/components/designer/AddProductModal.tsx` — NEW; orchestrates 7-call sequence per spec §4.3 Path B
- `src/components/designer/design/DesignPage.tsx` — ported
- `src/components/designer/design/ProductHeaderControls.tsx` — ported
- `src/components/designer/design/ConfirmDetailsModal.tsx` — ported
- `src/components/designer/design/MethodCard.tsx` — ported
- `src/components/designer/design/ValidationPanel.tsx` — ported
- `src/components/designer/design/customization/ProductCustomizer.tsx` — ported (large: 2948 lines)
- `src/components/designer/design/customization/product-customization-panel.tsx` — ported
- `src/components/designer/design/viewers/ProductViewerCanvas.tsx` — ported (large: 1971 lines)
- `src/components/designer/design/labels/NeckLabelRenderer.tsx` — ported
- `src/components/designer/design/labels/NeckLabelOverlay.tsx` — ported
- `src/components/designer/design/labels/EnhancedNeckLabelControls.tsx` — ported
- `src/components/designer/design/labels/FabricRealisticLabel.tsx` — ported
- `src/components/designer/design/controls/*.tsx` — ported (`ArtworkDimensionsInputs`, `ArtworkSizeSlider`, `PrintAreaSelector`, `SvgColorFilters`, `ArtworkReusePicker`)
- `src/components/designer/review/ReviewPage.tsx` — ported (host of the review row + dialog panel)
- `src/components/designer/review/SnapshotCaptureWorker.tsx` — ported, with §9.4 logging hook added
- `src/components/designer/review/ProductList.tsx` — ported (the `ReviewRow` export)
- `src/components/designer/review/ProductViewerWithSnapshots.tsx` — ported (large: 1529 lines)
- `src/components/designer/review/IsolatedSizeGrid.tsx` — ported
- `src/components/designer/review/IsolatedPricingDisplay.tsx` — ported
- `src/components/designer/review/AddToCatalogueDialog.tsx` — NEW
- `src/components/catalogues/CatalogueItemPriceDiffChip.tsx` — NEW (§9.3 chip on `/(portal)/catalogues/[id]`)
- `src/contexts/designer/DesignContext.tsx` — ported
- `src/contexts/designer/NeckLabelProvider.tsx` — ported
- `src/contexts/designer/ProductViewsProvider.tsx` — ported
- `src/lib/designer/pricing/index.ts` — barrel that re-exports from `@print-room-studio/pricing` + adds the staff-side wrappers (or a slim local copy of the RPC clients depending on Task 1.2 outcome)
- `src/lib/designer/pricing/embroidery-rpc-client.ts` — re-port of `apps/design-tool/src/lib/pricing/embroidery-rpc-client.ts` (only if Task 1.2 chooses re-port over package promotion)
- `src/lib/designer/pricing/heat-rpc-client.ts` — re-port of the design-tool's heat RPC client (same condition)
- `src/lib/designer/cart-storage.ts` — ported localStorage state for in-progress designs (auth-aware; see Task 3.1)
- `src/lib/designer/design-persistence.ts` — ported `design_drafts` writer
- `src/lib/designer/snapshot-storage.ts` — ported `design_snapshots` writer (with logging hook)
- `src/lib/designer/artwork-storage.ts` — NEW; wraps `upload-asset` and writes `design_artwork` rows
- `src/lib/designer/snapshot-logger.ts` — NEW; lightweight client-side logger that POSTs to `/api/designer/snapshot-log`
- `src/types/designer.ts` — DTOs for the submissions endpoint + AddProductModal payload + AddToCatalogueDialog payload

### Modified files (staff portal)

- `package.json` — add `"@print-room-studio/pricing": "file:../print-room-studio/packages/pricing"` and `"sharp": "^0.34.0"` (pin to version in design-tool's package.json — verify in Task 2.4); reuse existing react/next versions.
- `src/components/layout/Sidebar.tsx` — add new "Designer" `NavSection` after the existing "Quote Tool" section
- `src/types/staff.ts` — add `'designer'` and (if needed) `'designer:write'` literals to the `StaffPermission` union
- `src/lib/staff/permissions.ts` (or wherever permission helpers live — confirm in Task 1.4) — add `requireDesignerStaffAccess()`
- `src/app/(portal)/catalogues/[id]/page.tsx` — wire `CatalogueItemPriceDiffChip` into the items table render path

### Modified files (customer portal: `print-room-portal`) **CROSS-REPO**

- `app/(portal)/shop/page.tsx` — Phase 5 catalogue card snapshot read-through
- `app/(portal)/shop/[productId]/page.tsx` — Phase 5 PDP gallery snapshot read-through
- `lib/shop/effective-image.ts` — NEW helper that prefers `design_snapshots.scene_png_url` (where `proof_catalogue_links.is_primary=true`) over `product_images.file_url`
- `lib/shop/effective-image.test.ts` — NEW vitest unit test (vitest IS configured per agent exploration)

### Modified files (design tool: `print-room-studio/apps/design-tool`) **CROSS-REPO**

- `src/app/(public-design)/layout.tsx` — NEW; layout-level redirect-to-staff-sign-in for unauthenticated requests (§9.5)
- `src/app/catalog/page.tsx` → moves under `(public-design)/catalog/page.tsx`
- `src/app/design/[productId]/[instanceId]/page.tsx` → moves under `(public-design)/design/...`
- `src/app/(quote-flow)/review/[id]/page.tsx` → re-evaluate; the public review route may already live here. If so, add the same guard inside its own layout. (Investigate in Task 5.4.)

### Optional package promotion (design tool: `print-room-studio/packages/pricing`) **CROSS-REPO, conditional on Task 1.2**

- `src/embroidery-rpc-client.ts` — promoted from `apps/design-tool/src/lib/pricing/`
- `src/heat-rpc-client.ts` — promoted from `apps/design-tool/src/lib/pricing/`
- `src/index.ts` — re-export the new files

---

## Phase 1 — Foundations (1.5 days)

**Demo gate (per spec §7):** `pnpm dev` (or `npm run dev`) in staff portal; visit `/(portal)/designer/catalog` → renders empty placeholder; visit `/(portal)/designer/_dev/pricing-test` → returns a valid `PricingSnapshot` shape from RPC; sidebar shows "Designer" entry behind the staff-auth guard.

### Task 1.1: Wire `@print-room-studio/pricing` via `file:` protocol

**Files:**
- Modify: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/package.json`
- Verify: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/node_modules/@print-room-studio/pricing/dist/index.js`

- [ ] **Step 1: Confirm package builds in sister monorepo.**
  Run: `cd c:/Users/MSI/Documents/Projects/print-room-studio && pnpm install && pnpm --filter @print-room-studio/pricing run build`
  Expected: `packages/pricing/dist/` populated with `index.js` + `index.d.ts`. Exit code 0.
- [ ] **Step 2: Confirm package.json `main`/`exports`/`types` point at built artifacts.**
  Read: `c:/Users/MSI/Documents/Projects/print-room-studio/packages/pricing/package.json`
  If `main` or `exports.import` points at `src/index.ts` (i.e. raw TS), the file: dep will fail at runtime in staff portal. If so, verify `tsconfig.build.json` outputs to `dist/` and that `package.json` declares those paths. Fix in the sister repo (separate commit) if needed before continuing.
- [ ] **Step 3: Add file: dep to staff portal `package.json` `dependencies` (alphabetical with other `@`-scoped pkgs).**

  ```json
  "@print-room-studio/pricing": "file:../print-room-studio/packages/pricing",
  ```

- [ ] **Step 4: Install + smoke import.**
  Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npm install`
  Expected: lockfile updated, package symlinked into `node_modules`.
  Then: `ls node_modules/@print-room-studio/pricing/dist/index.js` should resolve.
- [ ] **Step 5: Type-check probe.**
  Create temporary file `src/lib/designer/pricing/_smoke.ts`:

  ```ts
  import type { GarmentFamily, EmbroideryPriceResult } from '@print-room-studio/pricing'
  export const _smoke: { fam: GarmentFamily; res: EmbroideryPriceResult | null } = {
    fam: 'tee',
    res: null,
  }
  ```

  (If `'tee'` is not a literal of `GarmentFamily` — open `node_modules/@print-room-studio/pricing/dist/embroidery-v2.d.ts` and pick a real one.)
  Run: `npx tsc --noEmit`
  Expected: zero errors.
- [ ] **Step 6: Commit.**

  ```bash
  git add package.json package-lock.json src/lib/designer/pricing/_smoke.ts
  git commit -m "chore(designer): wire @print-room-studio/pricing via file: protocol"
  ```

**Success criteria:** `import { ... } from '@print-room-studio/pricing'` type-checks and resolves at runtime. The smoke file stays committed for now; Task 1.6 replaces it with real usage.

### Task 1.2: Decide RPC client wrapper strategy (promote vs re-port)

**Files (read-only audit):**
- Read: `c:/Users/MSI/Documents/Projects/print-room-studio/apps/design-tool/src/lib/pricing/embroidery-rpc-client.ts`
- Read: `c:/Users/MSI/Documents/Projects/print-room-studio/apps/design-tool/src/lib/pricing/heat-rpc-client.ts`
- Read: `c:/Users/MSI/Documents/Projects/print-room-studio/packages/pricing/src/decoration-pricing.ts` (lines 162–328 — already calls `calculate_screenprint_pricing_v2` and `calculate_heatpress_pricing_api`)

- [ ] **Step 1: Audit deps of the two app-internal RPC clients.**
  Look for imports going outside `apps/design-tool/src/lib/pricing/`. If they only import `@supabase/supabase-js` types and nothing else, they're trivially portable.
- [ ] **Step 2: Audit the package's existing decoration-pricing exports.**
  `packages/pricing/src/decoration-pricing.ts` already exports `getHeatpressQuote` (calls `calculate_heatpress_pricing_api`) and uses the same RPC names. Determine whether the package's existing exports are sufficient for the design canvas's `useQuoteEstimator` hook, OR whether the design-tool's app-internal wrappers add staff-portal-relevant behaviour (request shape, fallback wrapped/direct payload modes per agent exploration).
- [ ] **Step 3: Decide.**
  - **Option A (re-port — default lean):** copy both rpc-client files into `src/lib/designer/pricing/` in staff portal. Cheaper; no sister-repo PR. Risk: drift if design tool evolves the request shape.
  - **Option B (promote):** move both files into `packages/pricing/src/`, re-export from `index.ts`, bump pricing package version. Heavier; requires sister-repo PR.
  Document the decision inline in this task's checkbox before proceeding. Default: **A**, because the package isn't published and a `file:` symlink already gives us version-pinning by commit.
- [ ] **Step 4: Commit the decision (no code yet).**
  Add a comment line to this plan after this task identifying the chosen option. No code change — that happens in Task 3.7 if Option A, or as a separate sister-repo commit cycle if Option B.

**Success criteria:** Decision recorded; no code lands here. Option A is the default unless the audit surfaces a strong signal otherwise.

### Task 1.3: Confirm pricing RPCs are callable from staff-portal context

**Files (smoke probes only):**
- Read: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/lib/supabase-server.ts`

- [ ] **Step 1: Pick an existing PRT product to probe.**
  Run via `mcp__claude_ai_Supabase__execute_sql`:

  ```sql
  -- Confirm at least one product with embroidery + heat data exists somewhere (org-agnostic)
  SELECT id, name FROM products WHERE decoration_eligible = true LIMIT 3;
  ```

  Expected: ≥1 row.
- [ ] **Step 2: Probe `calculate_embroidery_pricing_api`.**
  Use the existing design-tool wrapper's call shape (read `apps/design-tool/src/lib/pricing/embroidery-rpc-client.ts` for the exact RPC arg keys). Run via `execute_sql`:

  ```sql
  SELECT calculate_embroidery_pricing_api( /* args from wrapper */ );
  ```

  Expected: returns a numeric JSON-shaped result (or NULL if no match). Either way: confirms the RPC is callable from the same Supabase project the staff portal uses.
- [ ] **Step 3: Same for `calculate_heatpress_pricing_api`.**
- [ ] **Step 4: Document the canonical call signatures inline as a comment on Task 3.7's checkbox.**

**Success criteria:** Both RPCs respond from the shared Supabase project. No code change.

### Task 1.4: Add `requireDesignerStaffAccess` permission helper + types

**Files:**
- Read: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/types/staff.ts`
- Read: existing `requireInventoryStaffAccess` / `requireCataloguesStaffAccess` (locate via Grep)
- Modify: `src/types/staff.ts` — add `'designer'` to `StaffPermission` (and `'designer:write'` if the existing helpers split read/write)
- Create: `src/lib/designer/server.ts` (or wherever the existing helpers live — match the location of the catalogues helper)

- [ ] **Step 1: Locate the existing pattern.**
  Run: `grep -rn 'requireCataloguesStaffAccess' src/lib/`
- [ ] **Step 2: Mirror the helper's exact return shape.**
  Per `memory/project_b2b_catalogues_spec_plan.md` it returns `{ error: NextResponse } | { admin, context }`. Match it.
- [ ] **Step 3: Add the literal(s) to `StaffPermission`.**
- [ ] **Step 4: Type-check.**
  Run: `npx tsc --noEmit`
  Expected: zero errors.
- [ ] **Step 5: Commit.**

  ```bash
  git add src/types/staff.ts src/lib/designer/server.ts
  git commit -m "feat(designer): add requireDesignerStaffAccess + StaffPermission literal"
  ```

**Success criteria:** New helper compiles; the staff-side seed user `hello@theprint-room.co.nz` gets the permission via existing seed mechanisms (verify by reading how catalogues permission is granted — usually a row in `staff_permissions` keyed on user_id). If a manual seed is needed, surface to Jamie before adding the row.

### Task 1.5: Stand up `(portal)/designer/` route group + auth-gated layout

**Files:**
- Create: `src/app/(portal)/designer/layout.tsx`
- Create: `src/app/(portal)/designer/catalog/page.tsx` (placeholder — populated in Phase 2)
- Read: `src/app/(portal)/layout.tsx` (mirror the `PortalShell` wrap, add the designer permission check on top)

- [ ] **Step 1: Re-read Next.js 16 layout docs.**
  Read: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
- [ ] **Step 2: Create the layout.**

  ```tsx
  // src/app/(portal)/designer/layout.tsx
  import { redirect } from 'next/navigation'
  import { requireDesignerStaffAccess } from '@/lib/designer/server'

  export default async function DesignerLayout({ children }: { children: React.ReactNode }) {
    const access = await requireDesignerStaffAccess()
    if ('error' in access) redirect('/sign-in?next=/designer/catalog')
    return <>{children}</>
  }
  ```

- [ ] **Step 3: Create catalog page placeholder.**

  ```tsx
  // src/app/(portal)/designer/catalog/page.tsx
  export default function DesignerCatalogPage() {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Designer · Catalog</h1>
        <p className="mt-2 text-sm text-gray-500">Phase 1 placeholder. Catalog UI lands in Phase 2.</p>
      </div>
    )
  }
  ```

- [ ] **Step 4: Smoke.**
  Run: `npm run dev` and visit `http://localhost:3000/designer/catalog` after signing in as `hello@theprint-room.co.nz`. Expected: the placeholder renders. Sign out and revisit: expected to redirect to sign-in.
- [ ] **Step 5: Commit.**

  ```bash
  git add src/app/\(portal\)/designer/
  git commit -m "feat(designer): stand up (portal)/designer/ route group with staff-auth guard"
  ```

**Success criteria:** `/designer/catalog` renders gated placeholder. Unauthenticated requests redirect to sign-in.

### Task 1.6: Add "Designer" sidebar entry + Phase 1 demo route

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` — append a `NAV_SECTIONS` entry for Designer
- Create: `src/app/(portal)/designer/_dev/pricing-test/page.tsx`

- [ ] **Step 1: Add sidebar entry.**
  In `Sidebar.tsx` `NAV_SECTIONS` (lines 52–173), append (or insert near the Quote Tool section):

  ```ts
  {
    id: 'designer',
    label: 'Designer',
    icon: Palette,            // import from lucide-react
    permission: 'designer',
    items: [
      { label: 'Catalog', href: '/designer/catalog', icon: LayoutGrid },
      { label: 'Pricing test', href: '/designer/_dev/pricing-test', icon: Calculator },
    ],
  },
  ```

  Ensure new lucide-react icons are imported.
- [ ] **Step 2: Build pricing-test page.**

  ```tsx
  // src/app/(portal)/designer/_dev/pricing-test/page.tsx
  import { calculateEmbroideryPriceV2 } from '@print-room-studio/pricing'

  export default async function PricingTestPage() {
    // Use a hardcoded plausible input to confirm the pricing module loads.
    const sample = await calculateEmbroideryPriceV2({
      // Fill from packages/pricing/src/embroidery-v2.ts type — pick a known-good shape.
      // The exact fields will reveal themselves from the imported type signature.
    } as Parameters<typeof calculateEmbroideryPriceV2>[0])

    return (
      <pre className="p-8 text-xs">{JSON.stringify(sample, null, 2)}</pre>
    )
  }
  ```

  If `calculateEmbroideryPriceV2` requires a Supabase client argument, instantiate via `getSupabaseAdmin()` from `@/lib/supabase-server`.
- [ ] **Step 3: Type-check + build.**
  Run: `npx tsc --noEmit && npm run build`
  Expected: both succeed.
- [ ] **Step 4: Smoke.**
  `npm run dev` → sign in → visit `/designer/_dev/pricing-test` → see a `PricingSnapshot`-shaped JSON dump.
- [ ] **Step 5: Commit.**

  ```bash
  git add src/components/layout/Sidebar.tsx src/app/\(portal\)/designer/_dev/
  git commit -m "feat(designer): sidebar entry + Phase 1 pricing-test demo gate"
  ```

**Success criteria:** Phase 1 demo gate passes — sidebar renders, placeholder catalog loads, pricing-test page returns a valid pricing payload from `@print-room-studio/pricing`. **Stop here for Jamie's go-ahead before Phase 2.**

---

## Phase 2 — Catalog + Add Product (2 days)

**Demo gate (per spec §7):** Staff uploads a hoodie image, fills the Add Product modal, lands on the design canvas with the new product loaded. Swatches populated automatically (Sharp k=5 quantisation). Variants generated (color × size). The new product appears in `/designer/catalog`.

### Task 2.1: Port `CatalogView` and `FilterBar` into staff portal

**Files:**
- Source: `c:/Users/MSI/Documents/Projects/print-room-studio/apps/design-tool/src/components/catalog/{CatalogView,FilterBar}.tsx`
- Create: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/components/designer/catalog/{CatalogView,FilterBar}.tsx`

- [ ] **Step 1: Copy both files verbatim.**
- [ ] **Step 2: Apply the import-swap diff.**
  - Supabase: `from '@/lib/supabase'` (design tool) → `from '@/lib/supabase-browser'` for client components, `from '@/lib/supabase-server'` for server components. Use `getSupabaseBrowser()` in client; `getSupabaseAdmin()` or `getSupabaseServer()` in server.
  - Router push targets: any `router.push('/design/...')` becomes `/designer/design/...`.
  - Anonymous-user assumptions: search for any reference to `useUser`, `currentUser`, anonymous cart cookies — replace with the staff-portal auth context (`useAuth` / staff session).
- [ ] **Step 3: Apply §9.2 visibility filter.**
  In `CatalogView`'s product fetch query, add the canvas-readiness filter:

  ```ts
  const { data: products } = await supabase
    .from('products')
    .select('id, name, image_url, brand_id, category_id, decoration_eligible, ...')
    .eq('decoration_eligible', true)
    .eq('is_active', true)
    // Canvas-readiness: must have a 'front' view image
    .filter(
      'id',
      'in',
      `(${(await supabase.from('product_images').select('product_id').eq('view_lower', 'front')).data?.map((r) => r.product_id).join(',') ?? ''})`,
    )
  ```

  (Note: the inline subselect via `filter('in', ...)` is awkward in PostgREST. Cleaner: do a two-step or use an SQL view. Confirm the simplest pattern matches the catalogues sub-app's existing two-step branch in `print-room-portal/app/(portal)/shop/page.tsx`.)
- [ ] **Step 4: Hook into `(portal)/designer/catalog/page.tsx`.**
  Replace the placeholder body with `<CatalogView />`.
- [ ] **Step 5: Type-check + build + smoke.**
  After cleanup is done (PRT has zero products), the catalog will render empty. That's expected. Add Product (Task 2.4) seeds the first product.
- [ ] **Step 6: Commit.**

  ```bash
  git add src/components/designer/catalog/ src/app/\(portal\)/designer/catalog/page.tsx
  git commit -m "feat(designer): port CatalogView + FilterBar with §9.2 visibility filter"
  ```

**Success criteria:** `/designer/catalog` renders the empty state cleanly (no errors). When PRT later has decoration-eligible products with front-view images, they appear.

### Task 2.2: Add the "+ Add product" tile component

**Files:**
- Create: `src/components/designer/catalog/AddProductTile.tsx`

- [ ] **Step 1: Build the tile.**

  ```tsx
  'use client'
  import { useState } from 'react'
  import { Plus } from 'lucide-react'
  import { AddProductModal } from '@/components/designer/AddProductModal'

  export function AddProductTile() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-600 transition hover:border-pr-blue hover:bg-pr-blue/5"
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">Add product</span>
        </button>
        {open && <AddProductModal onClose={() => setOpen(false)} />}
      </>
    )
  }
  ```

- [ ] **Step 2: Wire into `CatalogView` as the first grid cell.**
- [ ] **Step 3: Smoke.**
  Tile renders; clicking it currently does nothing (modal isn't built yet — Task 2.4).
- [ ] **Step 4: Commit.**

**Success criteria:** Tile shows in catalog; modal stub triggers a placeholder when wired in Task 2.4.

### Task 2.3: Build the auto-swatch endpoint (Sharp k=5)

**Files:**
- Create: `src/app/api/designer/products/auto-swatch/route.ts`
- Modify: `package.json` to add `"sharp": "^0.34.0"` (verify version against design tool's pin)

- [ ] **Step 1: Install Sharp.**
  Run: `npm install sharp@^0.34.0`
- [ ] **Step 2: Build the route handler.**

  ```ts
  // src/app/api/designer/products/auto-swatch/route.ts
  import { NextRequest, NextResponse } from 'next/server'
  import sharp from 'sharp'
  import { requireDesignerStaffAccess } from '@/lib/designer/server'

  const PALETTE: Array<{ label: string; hex: string }> = [
    { label: 'black',         hex: '#000000' },
    { label: 'white',         hex: '#ffffff' },
    { label: 'navy',          hex: '#0a1f3d' },
    { label: 'red',           hex: '#c1272d' },
    { label: 'royal',         hex: '#1f4ea1' },
    { label: 'royal_blue',    hex: '#1f4ea1' },
    { label: 'forest',        hex: '#1d4429' },
    { label: 'forest_green',  hex: '#1d4429' },
    { label: 'heather',       hex: '#9aa0a6' },
    { label: 'heather_grey',  hex: '#9aa0a6' },
    { label: 'charcoal',      hex: '#36454f' },
    { label: 'bottle_green',  hex: '#0e6b3a' },
    { label: 'burgundy',      hex: '#7b1f30' },
    { label: 'cream',         hex: '#f3e8d2' },
    { label: 'khaki',         hex: '#a09060' },
    { label: 'tan',           hex: '#c8a877' },
    { label: 'pink',          hex: '#f4a8b8' },
    { label: 'purple',        hex: '#5e3a87' },
    { label: 'orange',        hex: '#e26b1f' },
    { label: 'yellow',        hex: '#f2c233' },
  ]

  function hexDistance(a: string, b: string): number {
    const ax = parseInt(a.slice(1), 16); const bx = parseInt(b.slice(1), 16)
    const ar = (ax >> 16) & 255, ag = (ax >> 8) & 255, ab = ax & 255
    const br = (bx >> 16) & 255, bg = (bx >> 8) & 255, bb = bx & 255
    return Math.hypot(ar - br, ag - bg, ab - bb)
  }
  function nearestPaletteEntry(hex: string) {
    return PALETTE.reduce((best, e) => (hexDistance(hex, e.hex) < hexDistance(hex, best.hex) ? e : best))
  }
  function isNearWhiteOrBlack(hex: string): boolean {
    const x = parseInt(hex.slice(1), 16); const r = (x >> 16) & 255, g = (x >> 8) & 255, b = x & 255
    const v = (r + g + b) / 3
    return v < 18 || v > 240
  }

  export async function POST(req: NextRequest) {
    const access = await requireDesignerStaffAccess()
    if ('error' in access) return access.error

    const body = await req.json() as { image_url: string }
    if (!body.image_url) return NextResponse.json({ error: 'image_url required' }, { status: 400 })

    const buf = Buffer.from(await (await fetch(body.image_url)).arrayBuffer())

    // Resize for speed; quantise to k=5 via posterize-style stat call.
    const { dominant } = await sharp(buf).resize(64).stats()
    // Sharp's `dominant` is 1 colour. For k=5 we need a histogram approach:
    const { data } = await sharp(buf).resize(64).raw().toBuffer({ resolveWithObject: true })
    const counts = new Map<string, number>()
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i] >> 5 << 5, g = data[i+1] >> 5 << 5, b = data[i+2] >> 5 << 5
      const hex = `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
    const top = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 12)
    const candidates = top.map(([hex]) => hex).filter((h) => !isNearWhiteOrBlack(h))
    const mapped = candidates.slice(0, 5).map(nearestPaletteEntry)

    const dedup: typeof PALETTE = []
    for (const m of mapped) if (!dedup.find((d) => d.label === m.label)) dedup.push(m)

    return NextResponse.json({ swatches: dedup })
  }
  ```

  *(Note: This is a pragmatic k≈5 via 3-bit-per-channel binning rather than true k-means. If the modal feedback shows poor mapping in practice, swap for `image-q` library — but only after Phase 2 demo gate. YAGNI.)*
- [ ] **Step 3: Type-check + build.**
- [ ] **Step 4: Smoke with cURL.**

  ```bash
  curl -X POST http://localhost:3000/api/designer/products/auto-swatch \
    -H "Content-Type: application/json" \
    -d '{"image_url":"https://example.com/test-tee.jpg"}'
  ```

  Expected: `{"swatches":[{"label":"navy","hex":"#0a1f3d"},...]}`. Auth-gated: returns 401/redirect if not signed in.
- [ ] **Step 5: Commit.**

**Success criteria:** Endpoint returns 1–5 palette-mapped swatches for a given image URL. Near-white/near-black clusters are dropped.

### Task 2.4: Build `AddProductModal` — fields + state

**Files:**
- Create: `src/components/designer/AddProductModal.tsx`

- [ ] **Step 1: Scaffold the modal with all spec §6.1 fields.**
  Build: name, brand combobox (sourced from `/api/brands`), category combobox (`/api/categories`), garment family select, image upload (drag-drop + `<input type="file">`), sizes multi-select, decoration eligible toggle, decoration positions multi-select, notes textarea.
- [ ] **Step 2: Wire image upload to existing `/api/products/[id]/images` flow.**
  But chicken-and-egg: image upload requires a product id. Workaround: upload to the `product-images` Supabase Storage bucket directly via `getSupabaseBrowser().storage.from('product-images').upload(...)`, get back the public URL, hold in component state, then attach to the product after step 7's product create returns the id.
- [ ] **Step 3: Type-check + smoke render.**
- [ ] **Step 4: Commit (incomplete — submit handler in Task 2.5).**

  ```bash
  git commit -m "feat(designer): AddProductModal scaffold (no submit handler yet)"
  ```

### Task 2.5: `AddProductModal` submit — orchestrate the 7-call sequence (per spec §4.3 Path B)

**Files:**
- Modify: `src/components/designer/AddProductModal.tsx`

- [ ] **Step 1: Implement `onSubmit`.**

  ```ts
  // 1. Create products row
  const { data: created } = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, brand_id, category_id,
      decoration_eligible,
      moq: 1,
      is_active: true,
    }),
  }).then((r) => r.json())
  const productId = created.id

  // 2. Auto-swatch
  const { swatches } = await fetch('/api/designer/products/auto-swatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: uploadedImageUrl }),
  }).then((r) => r.json())

  // 3. Insert each swatch
  for (const s of swatches) {
    await fetch(`/api/products/${productId}/swatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: s.label, hex: s.hex, image_url: null }),
    })
  }

  // 4. Sizes quick-add
  await fetch(`/api/products/${productId}/sizes/quick-add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sizes }),
  })

  // 5. Variants bulk
  await fetch(`/api/products/${productId}/variants/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  // 6. Image attach
  await fetch(`/api/products/${productId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: uploadedImageUrl, view: 'front', view_lower: 'front', position: 0 }),
  })

  // 7. Channels b2b activate
  await fetch(`/api/products/${productId}/channels/b2b`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: true }),
  })

  // Redirect into the design canvas with a fresh instance id.
  const instanceId = crypto.randomUUID()
  router.push(`/designer/design/${productId}/${instanceId}`)
  ```

- [ ] **Step 2: Add error handling — any of steps 1–7 failing should surface a toast and STOP.**
  Don't try to roll back partial state via a transaction (the existing API endpoints aren't designed for that). Surface, log, ask the user to delete the partial product manually via `/products/[id]`.
- [ ] **Step 3: Smoke end-to-end.**
  Sign in as `hello@`, click "+ Add product", upload a hoodie image, fill name/brand/category/sizes, submit. Expected: lands on `/designer/design/<new-id>/<instance-id>` (placeholder route until Phase 3 — that's fine; the URL itself proves the orchestration worked). Verify in DB:

  ```sql
  SELECT id, name FROM products WHERE id = '<new-id>';
  SELECT COUNT(*) FROM product_color_swatches WHERE product_id = '<new-id>';
  SELECT COUNT(*) FROM product_variants WHERE product_id = '<new-id>';
  SELECT COUNT(*) FROM product_images WHERE product_id = '<new-id>';
  SELECT * FROM product_type_activations WHERE product_id = '<new-id>' AND product_type='b2b';
  ```

  Expected counts: product 1, swatches 1–5, variants ≥ swatches × sizes, images 1, activations 1.
- [ ] **Step 4: Commit.**

  ```bash
  git commit -m "feat(designer): AddProductModal orchestrates 7-call create + redirect"
  ```

**Success criteria:** Phase 2 demo gate passes — staff goes from "click + Add product" to "design canvas URL" with a fully wired product.

### Task 2.6: Verify the §9.2 visibility filter against the new product

**Files:** none (verification only).

- [ ] **Step 1: After Task 2.5 succeeds, navigate back to `/designer/catalog`.**
- [ ] **Step 2: Confirm the new product is visible.**
  It should be — the modal uploaded a `view_lower='front'` image. If it isn't, the canvas-readiness filter is bugged. Probe the DB:

  ```sql
  SELECT id, name FROM products
  WHERE decoration_eligible = true
    AND is_active = true
    AND EXISTS (SELECT 1 FROM product_images WHERE product_id = products.id AND view_lower = 'front');
  ```

  Expected: includes the new product.
- [ ] **Step 3: If filter excludes the product, fix the query in `CatalogView` from Task 2.1 and re-deploy.**

**Success criteria:** Newly created products appear in catalog immediately.

### Task 2.7: Phase 2 demo gate

- [ ] **Manual demo with Jamie:** upload hoodie → fill modal → land on canvas placeholder → confirm DB rows. **Stop for go-ahead before Phase 3.**

---

## Phase 3 — Design canvas (4 days)

**Demo gate (per spec §7):** Staff applies a logo to the new product, picks Embroidery + front placement, sees live pricing total update. Reload page → state restored from `design_drafts`.

### Task 3.1: Port `cart-storage.ts` and audit anonymous-user assumptions

**Files:**
- Source: `c:/Users/MSI/Documents/Projects/print-room-studio/apps/design-tool/src/lib/cart-storage.ts`
- Create: `c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/lib/designer/cart-storage.ts`

- [ ] **Step 1: Copy file.**
- [ ] **Step 2: Audit for anonymous-user assumptions.**
  Per agent exploration: cart-storage uses `window.crypto.randomUUID()` for cart id, no `auth.uid()` calls. Decision: KEEP localStorage cart id for in-progress design state — staff users have one localStorage scope per browser, and an in-progress design is per-tab anyway. Don't tie cart id to user id; it would lose work across tab closes during sign-out/in.
- [ ] **Step 3: Document the decision inline in this task's checkbox.**
- [ ] **Step 4: Type-check.**
- [ ] **Step 5: Commit.**

**Success criteria:** `cart-storage` module compiles in staff portal. localStorage scope is per-tab, not per-user. No regressions from the design tool's behaviour.

### Task 3.2: Port `DesignContext`, `NeckLabelProvider`, `ProductViewsProvider`

**Files:**
- Sources: `apps/design-tool/src/contexts/{DesignContext,NeckLabelProvider,ProductViewsProvider}.tsx`
- Create: `src/contexts/designer/{DesignContext,NeckLabelProvider,ProductViewsProvider}.tsx`

- [ ] **Step 1: Copy all three files.**
- [ ] **Step 2: Swap supabase imports.**
  Same pattern as Task 2.1 — browser client for client-side hooks, server client for server-side queries.
- [ ] **Step 3: Audit cross-context imports.**
  These three contexts may import from each other or from `@/lib/...`. Resolve all paths to the staff portal's lib paths.
- [ ] **Step 4: Type-check.**
- [ ] **Step 5: Commit.**

**Success criteria:** Contexts compile; no path errors.

### Task 3.3: Port `design-persistence.ts` (writes `design_drafts`)

**Files:**
- Source: `apps/design-tool/src/lib/design-persistence.ts`
- Create: `src/lib/designer/design-persistence.ts`

- [ ] **Step 1: Copy + swap supabase client.**
- [ ] **Step 2: Verify the `design_drafts` schema is unchanged.**
  Run via `mcp__claude_ai_Supabase__execute_sql`:

  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='design_drafts' ORDER BY ordinal_position;
  ```

  Match against what `design-persistence.ts` writes.
- [ ] **Step 3: Type-check.**
- [ ] **Step 4: Commit.**

**Success criteria:** `design_drafts` write path compiles and matches DB schema.

### Task 3.4: Port `snapshot-storage.ts` (writes `design_snapshots`) — with logger hook

**Files:**
- Source: `apps/design-tool/src/lib/snapshot-storage.ts`
- Create: `src/lib/designer/snapshot-storage.ts`
- Create: `src/lib/designer/snapshot-logger.ts`

- [ ] **Step 1: Copy snapshot-storage and swap supabase client.**
- [ ] **Step 2: Add logger hook.**
  After every successful or failed snapshot upload, call:

  ```ts
  await logSnapshotOutcome({
    instanceId, view,
    status: 'success' | 'fail',
    bytes: blob.size,
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    error: err?.message ?? null,
  })
  ```

  Where `logSnapshotOutcome` is in the new `snapshot-logger.ts`:

  ```ts
  export async function logSnapshotOutcome(payload: SnapshotOutcomePayload) {
    try {
      await fetch('/api/designer/snapshot-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch { /* swallow — logging never breaks UX */ }
  }
  ```

- [ ] **Step 3: Type-check.**
- [ ] **Step 4: Commit.**

**Success criteria:** Snapshot writes have logging on both paths. The `/api/designer/snapshot-log` endpoint is built in Task 4.6 — for now the fetch will 404, which is harmless because the catch swallows it.

### Task 3.5: Re-port `/api/upload-asset` as `/api/designer/upload-asset`

**Files:**
- Source: `apps/design-tool/src/app/api/upload-asset/route.ts`
- Create: `src/app/api/designer/upload-asset/route.ts`

- [ ] **Step 1: Copy route handler.**
- [ ] **Step 2: Swap auth — gate with `requireDesignerStaffAccess` instead of the design tool's open access.**
  This is a tightening: the design tool accepted any caller. Staff portal requires staff auth.
- [ ] **Step 3: Swap supabase service-role client to staff portal's `getSupabaseAdmin()`.**
- [ ] **Step 4: Verify the buckets exist.**

  ```sql
  SELECT name FROM storage.buckets WHERE name IN ('design-artwork','design-snapshots','design-assets');
  ```

  If any are missing, surface to Jamie before creating them — bucket creation is a soft-DDL operation.
- [ ] **Step 5: Smoke with cURL.**
- [ ] **Step 6: Commit.**

**Success criteria:** Authenticated staff can upload to any of the three buckets via this endpoint.

### Task 3.6: Build `artwork-storage.ts` — wraps upload-asset + writes `design_artwork`

**Files:**
- Create: `src/lib/designer/artwork-storage.ts`

- [ ] **Step 1: Implement the wrapper.**

  ```ts
  // src/lib/designer/artwork-storage.ts
  import { getSupabaseBrowser } from '@/lib/supabase-browser'

  export async function uploadArtwork(opts: {
    file: File
    designId: string  // design_submissions.id (set after submit) OR null while drafting
    placement: 'front' | 'back' | 'sleeve_left' | 'sleeve_right' | 'neck'
  }) {
    // 1. Upload via existing endpoint
    const fd = new FormData()
    fd.append('file', opts.file)
    fd.append('bucket', 'design-artwork')
    fd.append('type', 'artwork')
    fd.append('placement', opts.placement)
    const uploadRes = await fetch('/api/designer/upload-asset', { method: 'POST', body: fd }).then((r) => r.json())

    // 2. Compute sha256 client-side
    const buf = await opts.file.arrayBuffer()
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)))
      .map((b) => b.toString(16).padStart(2, '0')).join('')

    // 3. Insert design_artwork row (skip if designId is null — wire later in submit handler)
    if (opts.designId) {
      const sb = getSupabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      await sb.from('design_artwork').insert({
        design_id: opts.designId,
        user_id: user?.id ?? null,
        placement: opts.placement,
        storage_path: uploadRes.path,
        public_url: uploadRes.public_url,
        sha256: hash,
      })
    }

    return { path: uploadRes.path, publicUrl: uploadRes.public_url, sha256: hash }
  }
  ```

  *Note: while drafting (no `design_submissions` row yet), the table insert is deferred. The submission endpoint (Task 4.7) backfills `design_artwork` rows before COMMIT.*
- [ ] **Step 2: Type-check.**
- [ ] **Step 3: Commit.**

**Success criteria:** `uploadArtwork()` is callable from the design canvas. With a real `designId` it writes a row; without one it just stores the file and returns metadata for later backfill.

### Task 3.7: Re-port pricing RPC clients (per Task 1.2 Option A)

**Files:**
- Source: `apps/design-tool/src/lib/pricing/{embroidery-rpc-client,heat-rpc-client}.ts`
- Create: `src/lib/designer/pricing/{embroidery-rpc-client,heat-rpc-client}.ts`
- Modify: `src/lib/designer/pricing/index.ts` — barrel re-exporting from `@print-room-studio/pricing` plus the two RPC client functions.

- [ ] **Step 1: Copy both files.**
- [ ] **Step 2: Swap supabase imports.**
- [ ] **Step 3: Build the barrel.**

  ```ts
  // src/lib/designer/pricing/index.ts
  export * from '@print-room-studio/pricing'
  export { callEmbroideryPricingRpc } from './embroidery-rpc-client'
  export { callHeatpressPricingRpc } from './heat-rpc-client'
  ```

  *Skipping the temporary `_smoke.ts` from Task 1.1 — delete it.*
- [ ] **Step 4: Type-check + commit.**

**Success criteria:** All pricing imports throughout the new designer code can come from `@/lib/designer/pricing`.

### Task 3.8: Port the design page + ProductHeaderControls + ConfirmDetailsModal + MethodCard + ValidationPanel

**Files:**
- Sources (5 files): `apps/design-tool/src/components/design/{DesignPage,ProductHeaderControls,ConfirmDetailsModal,MethodCard,ValidationPanel}.tsx`
- Create equivalents under `src/components/designer/design/`

- [ ] **Step 1: Copy all 5 files.**
- [ ] **Step 2: Swap imports in bulk.**
  - `@/contexts/DesignContext` → `@/contexts/designer/DesignContext`
  - `@/lib/cart-storage` → `@/lib/designer/cart-storage`
  - `@/lib/design-persistence` → `@/lib/designer/design-persistence`
  - `@/lib/pricing/...` → `@/lib/designer/pricing`
  - `@/components/design/...` → `@/components/designer/design/...`
  - `@/lib/supabase` → `@/lib/supabase-browser` (client) or `@/lib/supabase-server` (server)
  - Router paths: `/design/...` → `/designer/design/...`, `/review/...` → `/designer/review/...`
- [ ] **Step 3: Type-check.**
- [ ] **Step 4: Commit.**

**Success criteria:** All 5 components compile in staff portal context.

### Task 3.9: Port the heavy customization + viewer subtrees

**Files:**
- Sources: `apps/design-tool/src/components/design/{customization/*,viewers/*,labels/*,controls/*}`
- Create equivalents under `src/components/designer/design/`

- [ ] **Step 1: Copy all subtrees.**
  Largest files: `customization/ProductCustomizer.tsx` (2948 lines), `viewers/ProductViewerCanvas.tsx` (1971 lines).
- [ ] **Step 2: Apply the same import swap from Task 3.8.**
  Suggest using a sed/find-replace pass:

  ```bash
  cd c:/Users/MSI/Documents/Projects/print-room-staff-portal/src/components/designer/design
  # Use a tool/IDE find-replace, NOT a one-liner — paths in this scale need eyes-on review.
  ```

- [ ] **Step 3: Type-check incrementally.**
  Expect some imports to fail because hooks live in different places — fix iteratively. Common offenders: `useDesignSnapshots` (lives in `apps/design-tool/src/hooks/`), `useProductViews`, `useDesignContext` — these need to be ported too.
- [ ] **Step 4: Port any required hooks.**
  Locate and bring across `useDesignSnapshots`, `useProductViews`, `useDesignContext`, `useQuotePricing`, `useBusinessRules` — into `src/hooks/designer/`.
- [ ] **Step 5: Type-check + build.**
- [ ] **Step 6: Commit.**

  ```bash
  git commit -m "feat(designer): port large customization + viewer + label + controls subtrees"
  ```

**Success criteria:** Build succeeds. Designer canvas compiles. Runtime smoke deferred to Task 3.11.

### Task 3.10: Wire the design canvas page route

**Files:**
- Create: `src/app/(portal)/designer/design/[productId]/[instanceId]/page.tsx`

- [ ] **Step 1: Re-read Next.js 16 dynamic route docs.**
  Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`. Confirm `params` is `Promise<{ productId, instanceId }>`.
- [ ] **Step 2: Build the page.**

  ```tsx
  import dynamic from 'next/dynamic'
  import { DesignProvider } from '@/contexts/designer/DesignContext'
  import { NeckLabelProvider } from '@/contexts/designer/NeckLabelProvider'
  import { ProductViewsProvider } from '@/contexts/designer/ProductViewsProvider'

  const DesignPage = dynamic(() => import('@/components/designer/design/DesignPage'), { ssr: false })

  export default async function Page({
    params,
  }: { params: Promise<{ productId: string; instanceId: string }> }) {
    const { productId, instanceId } = await params
    return (
      <ProductViewsProvider productId={productId}>
        <DesignProvider productId={productId} instanceId={instanceId}>
          <NeckLabelProvider>
            <DesignPage />
          </NeckLabelProvider>
        </DesignProvider>
      </ProductViewsProvider>
    )
  }
  ```

- [ ] **Step 3: Type-check + build.**
- [ ] **Step 4: Commit.**

### Task 3.11: Phase 3 demo gate

- [ ] **Step 1: Smoke end-to-end.**
  Sign in → click Add Product → upload + submit → land on canvas → upload a logo → choose Embroidery → place on front → confirm pricing total updates → reload page → state restored from `design_drafts`.
- [ ] **Step 2: Verify `design_drafts` row.**

  ```sql
  SELECT * FROM design_drafts WHERE design_id = '<instance-id>';
  ```

- [ ] **Stop for Jamie's go-ahead before Phase 4.**

---

## Phase 4 — Review + B2B catalogue submit (4 days)

**Demo gate (per spec §7):** End-to-end. New product → designed → review → "Add to <some catalogue>" → `b2b_catalogue_items` row appears in `/(portal)/catalogues/[id]` editor with the rendered snapshot. The `proof_catalogue_links` table has its first non-zero rows.

### Task 4.1: Port `ReviewPage` + `ProductList` + `ReviewRow` + `ReviewItem`

**Files:**
- Sources: `apps/design-tool/src/components/review/{ReviewPage if present, ReviewRow, ReviewItem, ProductList alias}.tsx` (per agent exploration: `ProductList` is exported from `ReviewRow.tsx`)
- Create: `src/components/designer/review/{ReviewPage,ReviewRow,ReviewItem}.tsx`

- [ ] **Step 1: Copy + swap imports (same pattern as Task 3.8).**
- [ ] **Step 2: Type-check + commit.**

### Task 4.2: Port the heavy review subtree

**Files:**
- Sources: `apps/design-tool/src/components/review/{ProductViewerWithSnapshots,IsolatedSizeGrid,IsolatedPricingDisplay,SizeInfoModal,DesignSnapshots,useSnapshotUrls.ts}`
- Create equivalents under `src/components/designer/review/`

- [ ] **Step 1: Copy + swap imports.**
- [ ] **Step 2: Type-check + commit.**

### Task 4.3: Port `SnapshotCaptureWorker` with §9.4 logging hook

**Files:**
- Source: `apps/design-tool/src/components/review/SnapshotCaptureWorker.tsx`
- Create: `src/components/designer/review/SnapshotCaptureWorker.tsx`

- [ ] **Step 1: Copy + swap imports.**
- [ ] **Step 2: Add `logSnapshotOutcome` calls on the success and failure code paths.**
  Use the `snapshot-logger.ts` import from Task 3.4.
- [ ] **Step 3: Type-check + commit.**

### Task 4.4: Wire the review page route

**Files:**
- Create: `src/app/(portal)/designer/review/[instanceId]/page.tsx`

- [ ] **Step 1: Mirror Task 3.10's page-with-context-providers pattern.**
- [ ] **Step 2: Smoke render.**
  Visit the URL after Task 3 — confirm review UI appears (still missing the AddToCatalogueDialog — that's Task 4.5).
- [ ] **Step 3: Commit.**

### Task 4.5: Build `AddToCatalogueDialog` per spec §6.3

**Files:**
- Create: `src/components/designer/review/AddToCatalogueDialog.tsx`

- [ ] **Step 1: Build the dialog with all spec §6.3 fields.**
  Org combobox (`/api/organizations`), catalogue combobox (`/api/catalogues/by-org/[orgId]` or "+ Create new" with name input), primary view select (populated from captured snapshots), notes textarea.
- [ ] **Step 2: Hook into `ReviewPage` action bar.**
- [ ] **Step 3: Submit handler — POST to `/api/designer/submissions` (Task 4.7) with the design submission payload + target catalogue + primary view.**
  Don't build the API route yet — POST to a dummy endpoint, expect 404, fix in Task 4.7.
- [ ] **Step 4: Type-check + commit.**

### Task 4.6: Build the snapshot-log endpoint

**Files:**
- Create: `src/app/api/designer/snapshot-log/route.ts`

- [ ] **Step 1: Decide log destination.**
  - **Option A:** Insert into a new `application_logs` table — requires a migration. Skip per spec §5 net-zero schema constraint unless Jamie explicitly wants it.
  - **Option B:** Write to `console.log` (Vercel/Next runtime captures these). Cheap, no schema. Default.
  Default to B. Surface to Jamie if A becomes desirable later.
- [ ] **Step 2: Implement.**

  ```ts
  // src/app/api/designer/snapshot-log/route.ts
  import { NextRequest, NextResponse } from 'next/server'
  export async function POST(req: NextRequest) {
    const payload = await req.json()
    console.log('[snapshot]', JSON.stringify(payload))
    return NextResponse.json({ ok: true })
  }
  ```

- [ ] **Step 3: Smoke — capture a snapshot, check server logs.**
- [ ] **Step 4: Commit.**

### Task 4.7: Build the transactional submissions endpoint per spec §6.4

**Files:**
- Create: `src/app/api/designer/submissions/route.ts`

- [ ] **Step 1: Re-read Next.js 16 route handler docs (Promise params, async cookies).**
  Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- [ ] **Step 2: Implement the 6-step BEGIN…COMMIT sequence.**
  Wrap the entire body in a single transaction. PostgREST/Supabase client doesn't support multi-statement TX directly — use `rpc('designer_submit_to_catalogue', { ... })` with a single Postgres function that does the whole thing atomically.

  *Decision:* Build the RPC. This is a soft-DDL change — surface to Jamie for explicit approval before applying. The RPC body is the §6.4 sequence verbatim. **STOP and present the SQL to Jamie before applying.**

  Skeleton (do not apply yet):

  ```sql
  CREATE OR REPLACE FUNCTION designer_submit_to_catalogue(
    p_instance_id text,
    p_product_id uuid,
    p_design_data jsonb,
    p_pricing_data jsonb,
    p_images text[],
    p_target_organization_id uuid,
    p_target_catalogue_id uuid,
    p_target_catalogue_name text,
    p_primary_view text,
    p_notes text
  ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_submission_id uuid;
    v_catalogue_id uuid;
    v_catalogue_item_id uuid;
    v_caller_id uuid := auth.uid();
    v_caller_email text := (SELECT email FROM auth.users WHERE id = v_caller_id);
  BEGIN
    -- Step 1
    INSERT INTO design_submissions (...)
    VALUES (...) RETURNING id INTO v_submission_id;

    -- Step 2
    IF p_target_catalogue_id IS NULL THEN
      INSERT INTO b2b_catalogues (organization_id, name)
      VALUES (p_target_organization_id, p_target_catalogue_name)
      RETURNING id INTO v_catalogue_id;
    ELSE
      v_catalogue_id := p_target_catalogue_id;
    END IF;

    -- Step 3
    INSERT INTO b2b_catalogue_items (...)
    VALUES (...) RETURNING id INTO v_catalogue_item_id;

    -- Step 4: link snapshots
    INSERT INTO proof_catalogue_links (proof_id, catalogue_item_id, design_index, view_type, is_primary, sort_order)
    SELECT v_submission_id, v_catalogue_item_id, 0, view, view = p_primary_view, ROW_NUMBER() OVER (ORDER BY created_at)
    FROM design_snapshots WHERE instance_id = p_instance_id;

    -- Return
    RETURN jsonb_build_object(
      'design_submission_id', v_submission_id,
      'catalogue_id', v_catalogue_id,
      'catalogue_item_id', v_catalogue_item_id
    );
  END $$;
  ```

  *Discrepancy to verify in DB:* the `design_snapshots` table may use a different column name than `instance_id` for the link. Run an introspection query first:

  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='design_snapshots' ORDER BY ordinal_position;
  ```

- [ ] **Step 3: Surface SQL to Jamie. Wait for 🟢 before applying.**
  This is the only soft-DDL in the entire plan; spec §5 says net-zero schema, but a SECURITY DEFINER RPC is a function not a schema migration. Still: present-and-await per the destructive-write policy.
- [ ] **Step 4: After 🟢, apply via `mcp__claude_ai_Supabase__execute_sql` (CREATE OR REPLACE FUNCTION is technically reversible).**
  GRANT EXECUTE on the function to `authenticated`.
- [ ] **Step 5: Implement the route handler that calls the RPC.**

  ```ts
  // src/app/api/designer/submissions/route.ts
  import { NextRequest, NextResponse } from 'next/server'
  import { requireDesignerStaffAccess } from '@/lib/designer/server'

  export async function POST(req: NextRequest) {
    const access = await requireDesignerStaffAccess()
    if ('error' in access) return access.error
    const { admin } = access

    const body = await req.json()
    const { data, error } = await admin.rpc('designer_submit_to_catalogue', {
      p_instance_id: body.instance_id,
      p_product_id: body.product_id,
      p_design_data: body.design_data,
      p_pricing_data: body.pricing_data,
      p_images: body.images,
      p_target_organization_id: body.target_organization_id,
      p_target_catalogue_id: body.target_catalogue_id ?? null,
      p_target_catalogue_name: body.target_catalogue_name ?? null,
      p_primary_view: body.primary_view,
      p_notes: body.notes ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  ```

- [ ] **Step 6: Smoke end-to-end.**
  Click "Add to B2B catalogue" in the review UI → confirm `design_submissions`, `b2b_catalogue_items`, and `proof_catalogue_links` rows appear in DB.
- [ ] **Step 7: Commit.**

  ```bash
  git commit -m "feat(designer): submissions endpoint + transactional RPC for catalogue insert"
  ```

**Success criteria:** Phase 4 demo gate passes — new catalogue item with rendered snapshot visible in `/catalogues/[id]`. `proof_catalogue_links` non-empty for the first time.

### Task 4.8: Strip the design tool's "submit for quote" terminal from the ported review

**Files:**
- Modify: `src/components/designer/review/ReviewPage.tsx` — remove any "submit for quote" / "/details" CTA; the only terminal is now `AddToCatalogueDialog`.

- [ ] **Step 1: Remove dead UI + handler code.**
- [ ] **Step 2: Type-check + commit.**

### Task 4.9: Surface §9.3 price-diff chip on the catalogue editor

**Files:**
- Create: `src/components/catalogues/CatalogueItemPriceDiffChip.tsx`
- Modify: `src/components/catalogues/CatalogueItemsTable.tsx` — slot the chip into the row render.

- [ ] **Step 1: Build the chip.**

  ```tsx
  // src/components/catalogues/CatalogueItemPriceDiffChip.tsx
  export function CatalogueItemPriceDiffChip({
    snapshot, live,
  }: { snapshot: number | null; live: number | null }) {
    if (snapshot == null || live == null || snapshot === live) return null
    const diff = live - snapshot
    const sign = diff > 0 ? '+' : ''
    const tone = Math.abs(diff) > 1 ? 'amber' : 'slate'
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs ${tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
        Snapshot ${snapshot.toFixed(2)} · Live ${live.toFixed(2)} · diff {sign}${diff.toFixed(2)}
      </span>
    )
  }
  ```

- [ ] **Step 2: In `CatalogueItemsTable`, compute live and snapshot per row.**
  Snapshot: `item.metafields?.pricing_snapshot?.perUnitSubtotal ?? null`. Live: call `effective_unit_price` for the row's `(source_product_id, organization_id, qty)` — use `qty=1` or the catalogue item's MOQ.
- [ ] **Step 3: Smoke.**
  After Phase 4 demo, items with snapshots show the chip; older items without snapshots show nothing.
- [ ] **Step 4: Commit.**

**Success criteria:** Diff chip visible for designer-submitted catalogue items.

### Task 4.10: Run advisor scan post-Phase-4 (per spec §10 risk)

**Files:** none (read-only).

- [ ] **Step 1: Run security advisor.**

  ```
  mcp__claude_ai_Supabase__get_advisors(project_id, type='security')
  ```

  Expected: pay attention to any new findings on `design_artwork`, `proof_catalogue_links`, or the new RPC `designer_submit_to_catalogue` — both tables are now non-empty for the first time, so RLS may be flagged.
- [ ] **Step 2: If RLS findings appear, surface to Jamie before fixing — RLS edits are sensitive.**

**Success criteria:** Advisor sweep produces no critical findings, OR findings are surfaced and remediated with explicit Jamie sign-off.

### Task 4.11: Phase 4 demo gate

- [ ] **Stop for Jamie's go-ahead before Phase 5.**

---

## Phase 5 — Customer PDP read-through (1 day)

**CROSS-REPO** — all files in `c:/Users/MSI/Documents/Projects/print-room-portal`.

**Demo gate (per spec §7):** Customer logs into customer portal as PRT user, sees the staff-designed mockup as the catalogue card image. PDP gallery shows all snapshot views.

### Task 5.1: **CROSS-REPO** Build `effective-image.ts` helper + vitest test

**Files:**
- Create: `c:/Users/MSI/Documents/Projects/print-room-portal/lib/shop/effective-image.ts`
- Create: `c:/Users/MSI/Documents/Projects/print-room-portal/lib/shop/effective-image.test.ts`

- [ ] **Step 1: Build the helper.**

  ```ts
  // lib/shop/effective-image.ts
  import type { SupabaseClient } from '@supabase/supabase-js'

  export async function effectiveCardImage(
    admin: SupabaseClient, catalogueItemId: string,
  ): Promise<string | null> {
    const { data } = await admin
      .from('proof_catalogue_links')
      .select('design_snapshots!inner(scene_png_url)')
      .eq('catalogue_item_id', catalogueItemId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle()
    return (data as any)?.design_snapshots?.scene_png_url ?? null
  }

  export async function effectiveGallery(
    admin: SupabaseClient, catalogueItemId: string,
  ): Promise<string[]> {
    const { data } = await admin
      .from('proof_catalogue_links')
      .select('sort_order, design_snapshots!inner(scene_png_url)')
      .eq('catalogue_item_id', catalogueItemId)
      .order('sort_order')
    return (data ?? []).map((r: any) => r.design_snapshots.scene_png_url).filter(Boolean)
  }
  ```

  **Verify column name:** the join key on `design_snapshots` may be by `instance_id`, not `id`. Run:

  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='design_snapshots';
  ```

  And:

  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='proof_catalogue_links';
  ```

  Update the helper to use whatever join key actually exists (it's likely a direct FK from `proof_catalogue_links` to `design_snapshots`, OR via `instance_id`).
- [ ] **Step 2: Write a vitest test.**

  ```ts
  // lib/shop/effective-image.test.ts
  import { describe, it, expect, vi } from 'vitest'
  import { effectiveCardImage, effectiveGallery } from './effective-image'

  describe('effectiveCardImage', () => {
    it('returns null when no proof_catalogue_links row exists', async () => {
      const fakeAdmin: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
          }),
        }),
      }
      expect(await effectiveCardImage(fakeAdmin, 'x')).toBeNull()
    })

    it('returns the snapshot URL when present', async () => {
      const fakeAdmin: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { design_snapshots: { scene_png_url: 'https://x/y.png' } } }) }) }),
            }),
          }),
        }),
      }
      expect(await effectiveCardImage(fakeAdmin, 'x')).toBe('https://x/y.png')
    })
  })
  ```

- [ ] **Step 3: Run the test.**

  ```bash
  cd c:/Users/MSI/Documents/Projects/print-room-portal
  npm test -- effective-image
  ```

  Expected: 2/2 pass.
- [ ] **Step 4: Commit.**

### Task 5.2: **CROSS-REPO** Patch `app/(portal)/shop/page.tsx` to use `effectiveCardImage`

**Files:**
- Modify: `c:/Users/MSI/Documents/Projects/print-room-portal/app/(portal)/shop/page.tsx`

- [ ] **Step 1: Add a per-product image resolution step after the existing `products` query.**
  In the catalogue-scoped branch (see lines 37–80 from agent exploration), iterate the `scopedProductIds` and for each, look up the catalogue_item id and call `effectiveCardImage()`. Coalesce with `product.image_url`.
- [ ] **Step 2: Add the same coalesce path in the global-fallback branch (no catalogue scope).**
  In that branch, products by definition have no `b2b_catalogue_items` row, so `effectiveCardImage()` is skipped — image stays as `product.image_url`. Confirm fallback works.
- [ ] **Step 3: Build + smoke.**

  ```bash
  npx tsc --noEmit && npm run build
  ```

- [ ] **Step 4: Commit.**

### Task 5.3: **CROSS-REPO** Patch `app/(portal)/shop/[productId]/page.tsx` to use `effectiveGallery`

**Files:**
- Modify: `c:/Users/MSI/Documents/Projects/print-room-portal/app/(portal)/shop/[productId]/page.tsx`
- Modify: `c:/Users/MSI/Documents/Projects/print-room-portal/components/shop/ProductDetailClient.tsx` — accept `gallery?: string[]` prop and render multiple images instead of just `image_url`.

- [ ] **Step 1: In the page, after the existing `catItem` lookup, call `effectiveGallery(admin, catItem.id)` if `catItem` exists.**
  Pass the gallery URL list down to `ProductDetailClient`.
- [ ] **Step 2: Update `ProductDetailClient` to render the gallery.**
  Pick the first URL as the hero, render the rest as a thumbnail strip. Falls back to `product.image_url` if `gallery` is empty.
- [ ] **Step 3: Build + manual smoke as `hello@`.**
- [ ] **Step 4: Commit.**

### Task 5.4: **CROSS-REPO** Apply §9.5 layout-level auth guard on design tool's public routes

**Files (in `print-room-studio/apps/design-tool`):**
- Audit: `src/app/{catalog,design,review}/...` and `src/app/(quote-flow)/review/[id]/...`
- Create: `src/app/(public-design)/layout.tsx`
- Move (or wrap-with-symlink, OR mirror import): `catalog/`, `design/`, `review/` under `(public-design)/`

- [ ] **Step 1: Re-read agent exploration's findings.**
  Per agent: design tool has `src/app/catalog/page.tsx` (root, no group), `src/app/design/[productId]/[instanceId]/page.tsx` (root, no group), and `src/app/(quote-flow)/review/[id]/page.tsx` (already in a group).
- [ ] **Step 2: Decide guard location.**
  - Option A: introduce `(public-design)` route group, move `catalog/` and `design/` segments inside. Requires Next.js's route group syntax — paths stay the same.
  - Option B: enforce auth via `middleware.ts` matcher. Cheaper; no file moves. The existing `middleware.ts` already has redirect logic for `/design/*`, `/review/*`, `/details/*` based on cookies — extend it with the staff-auth check.
  Default: **Option B**, because the existing middleware already targets these paths.
- [ ] **Step 3: Add the auth check to `src/middleware.ts`.**

  ```ts
  // (sketch — adapt to existing middleware structure)
  if (pathname.startsWith('/design') || pathname.startsWith('/review') || pathname.startsWith('/catalog')) {
    const session = await getStaffSession(req)  // implementation: read cookies, hit a staff-portal verify endpoint, OR check shared Supabase auth
    if (!session) {
      const url = new URL('https://staff.print-room/sign-in', req.url) // confirm the staff portal URL
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  ```

  *The "shared Supabase auth" path is preferable — both apps point at the same Supabase project. Read the supabase-auth cookie via `@supabase/ssr` and verify it.*
- [ ] **Step 4: Smoke.**
  Hit `https://localhost:<design-tool-port>/catalog` while signed out → expect redirect to staff sign-in. Sign in → expect `/catalog` to render.
- [ ] **Step 5: Commit in the sister repo.**
  This commit lands in `print-room-studio`, not `print-room-staff-portal`. Surface to Jamie before pushing — cross-repo commits should be visible.

**Success criteria:** Design tool's three public routes are no longer reachable without staff auth. Existing flows (catalog browse, design canvas) remain fully functional behind the gate.

### Task 5.5: Phase 5 demo gate + sprint close

- [ ] **Step 1: End-to-end demo with Jamie.**
  Sign in as staff → Add Product → design → review → Add to B2B catalogue (new "PRT Demo" or similar) → log out of staff portal → log into customer portal as `hello@theprint-room.co.nz` → visit `/shop` → see the staff-designed mockup as the card image → click into PDP → see the gallery of all snapshot views.
- [ ] **Step 2: Confirm fallback path.**
  If a product without a designer submission exists, its card and PDP still render `product_images` correctly.
- [ ] **Step 3: Run the security advisor scan one final time (Task 4.10 was Phase 4; do it again now that all writes have flowed).**

  ```
  mcp__claude_ai_Supabase__get_advisors(project_id, type='security')
  mcp__claude_ai_Supabase__get_advisors(project_id, type='performance')
  ```

- [ ] **Step 4: Surface anything in advisor output to Jamie before declaring done.**

**Success criteria:** Phase 5 demo gate passes. Customer-facing surface shows designed mockups. Fallback paths still work for non-designer products.

---

## Cross-repo task summary

For agentic workers and reviewers — these are the tasks that touch repos OTHER than `print-room-staff-portal`:

| Task | Repo | What |
|---|---|---|
| 1.1 | `print-room-studio/packages/pricing` | Verify package builds cleanly (read-only) |
| 1.2 | `print-room-studio/apps/design-tool/src/lib/pricing/` | Audit RPC client wrappers (read-only); decision recorded inline |
| 5.1–5.3 | `print-room-portal` | Customer portal `/shop` and PDP read-through patches; new vitest test |
| 5.4 | `print-room-studio/apps/design-tool` | §9.5 layout-level / middleware auth guard on public routes |

Any commit in a non-staff-portal repo: surface to Jamie before pushing.

---

## Self-review checklist (run before declaring plan ready)

- [ ] **Spec coverage** — every section of `2026-04-30-designer-port-into-staff-portal-design.md` has at least one mapped task.
  - §2 Goals — Tasks 1.1–4.9
  - §3 Non-goals — respected (no Shopify push, no Monday subitem, no /products editor replacement)
  - §4.1 Route structure (staff portal) — Tasks 1.5, 2.1, 3.10, 4.4
  - §4.2 Route structure (customer portal) — Tasks 5.1–5.3
  - §4.3 End-to-end flow — Tasks 2.5, 3.10, 4.4, 4.7
  - §5 Data model (zero schema change) — respected; Task 4.7's RPC creation is surfaced for explicit approval
  - §6.1 Add Product modal — Tasks 2.4, 2.5
  - §6.2 Auto-swatch endpoint — Task 2.3
  - §6.3 AddToCatalogueDialog — Task 4.5
  - §6.4 Submissions endpoint — Task 4.7
  - §6.5 Snapshot worker port — Task 4.3 (with §9.4 logging)
  - §6.6 Customer portal patch — Tasks 5.1–5.3
  - §7 Build order — phases match exactly
  - §9.1 — Tasks 1.1, 1.2
  - §9.2 — Task 2.1, verified Task 2.6
  - §9.3 — Task 4.9
  - §9.4 — Tasks 3.4, 4.3, 4.6
  - §9.5 — Task 5.4
  - §10 Risks (cart-storage entanglement, html2canvas reliability, pricing divergence, workspace extraction, design_artwork RLS, customer PDP fallback) — addressed in Tasks 3.1, 4.3, 4.9, 1.2, 4.10, 5.5
- [ ] **Placeholder scan** — no "TBD", no "implement later", no naked "add error handling".
- [ ] **Type consistency** — `instanceId` vs `instance_id`, `productId` vs `product_id` — used consistently in the form expected by the spec (`design_id` is the legacy column name; `instance_id` is what `proof_catalogue_links` uses; `product_id` is the URL param).
- [ ] **Cross-repo commits** — every CROSS-REPO task surfaces to Jamie before push.
- [ ] **Stop conditions honoured** — phase boundaries are explicit go-ahead checkpoints.
