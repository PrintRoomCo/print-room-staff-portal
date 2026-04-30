# Designer (Design Tool) — Ported Into Staff Portal — Design Spec

**Date:** 2026-04-30
**Status:** Locked 2026-04-30 (all §9 decisions resolved; ready for implementation plan)
**Owner:** Jamie (per session 2026-04-30 strategy lock)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)
**Sister repo:** `print-room-studio/apps/design-tool` (source of the ported pages)
**Supersedes:** the iframe-based proof builder integration deleted 2026-04-29 (`project_proof_iframe_consolidation.md`).

## 1. Context

The Print Room's design tool was originally built as a **customer-facing self-serve flow**: customer browses a catalogue → designs a garment in a Fabric.js canvas → reviews → submits a `design_submissions` row with `status='pending_review'` → staff approves → product is pushed to Shopify and Monday → customer can order it. Eight `design_submissions` rows + 51 `design_orders` rows + 49 `design_drafts` rows show the flow was active enough to leave a real footprint.

Customer-facing self-serve has been **paused indefinitely** — Chris and Jamie do not want customers self-driving the design experience yet. Meanwhile the staff portal lacks any in-app way to (a) compose a printed-product mockup, (b) attach raw artwork files for production reuse, or (c) populate a B2B catalogue with a designed product whose mockup image faithfully represents what the customer will receive.

The 2026-04-29 iframe decouple (`project_proof_iframe_consolidation.md`) explicitly held back any new wiring "until the design tool's surfaces have been mapped and a target architecture chosen". The mapping is done (see §3); the target is locked: **port the design tool's catalog / design / review pages into the staff portal as native staff-only routes**, repurposing the customer self-serve infrastructure for staff use with `status='approved'` from the start so the existing approval gate is bypassed.

The integration produces a single coherent staff flow that ends in a B2B catalogue item carrying both raw artwork (for staff repeat-orders / production) and a rendered design snapshot (for the customer-portal PDP image). The customer portal stays naive — it reads URLs from the catalogue item join graph and renders them; it has zero knowledge of the design tool.

## 2. Goals

- A new `/(portal)/designer/` route group in the staff portal containing **catalog**, **design canvas**, and **review** pages ported from the design tool. Staff-auth gated.
- A net-new **"+ Add product" tile** on the ported catalog page that opens an upload modal: image + product name + brand + category + sizes + decoration positions. On submit: creates `products` + `product_color_swatches` (auto-extracted) + `product_images` + `product_variants` (bulk-generated) + `product_type_activations` rows, then redirects to the design canvas with the new product loaded.
- **Auto-swatch extraction** server-side (Sharp colour quantisation, k=5) maps the uploaded image's dominant clusters to a curated colour-name palette. Staff edits inline in the existing SwatchesTab if auto-pick is wrong.
- **Reuse the existing `design_submissions` flow with `status='approved'`** from the start — single canonical design payload, free audit trail, future-proof toggle to customer self-serve via status flip rather than separate code branch.
- **Net-new "Add to B2B catalogue" panel** on the ported review page: org picker + catalogue picker (or new) + primary-design selector. On submit: writes `design_submissions(status='approved')` + `b2b_catalogue_items` + `proof_catalogue_links` (existing schema, currently empty) in a single transaction.
- **Two-layer artwork persistence**: raw artwork in `design-artwork` bucket + new `design_artwork` table rows (currently 0 rows; schema present); rendered snapshots in `design-snapshots` bucket + table rows (10 rows of existing usage).
- **Customer portal `/shop` and PDP read-through**: catalogue card image + PDP gallery read from `proof_catalogue_links` → `design_snapshots`. Fallback to `product_images` when no design exists. No design-tool dependency on customer side.
- **Pricing logic alignment**: the shared `@print-room-studio/pricing` package becomes a workspace dep of the staff portal; the design tool's RPC calls (`calculate_embroidery_price_v2`, `calculate_heat_price`) work unchanged because they're already in the shared Supabase project. The B2B catalogue item stores BOTH the design tool's calculated total at submission time AND recomputes live `effective_unit_price` for display, surfacing the diff to account managers (per §9.3 lock).

## 3. Non-goals (out of scope)

- **Customer self-serve cutover.** This spec assumes self-serve stays paused. Re-enabling it is a future flag flip — `status='pending_review'` on insert, plus surfacing the customer-side design-tool routes.
- **Server-side snapshot rendering.** The ported `<SnapshotCaptureWorker />` keeps its current client-side html2canvas implementation. Server-side Puppeteer/Playwright rendering for snapshot reliability is a follow-up if html2canvas proves flaky in the staff context.
- **Customer-portal /design and /review routes** on the design tool app. Per the architecture lock, those stay deleted/hidden. This spec does not delete the design-tool app, only stops linking to its self-serve routes.
- **Pricing-engine unification.** Two pricing engines coexist: design tool's pricing for design composition (lives in `@print-room-studio/pricing` + RPCs), staff portal's `effective_unit_price` for B2B catalogue display. They diverge by intent; merging is a separate spec.
- **Re-enabling Shopify push and Monday subitem creation** from approval. The B2B platform is off Shopify (`project_b2b_platform_direction.md`); Monday subitems are owned by the CSR / quote builder approval flow, not by catalogue creation.
- **Replacing the existing staff portal `/products` editor.** It stays. Add Product modal in the designer is an additional entry point that creates the same kind of `products` row; staff can still create products via `/products/new` if they don't need a designed mockup.
- **Redesigning the customer-portal PDP**, beyond patching the image read-through to prefer `design_snapshots` URLs. PDP layout, gallery, and bracket-pricing display all stay as-is.
- **Workspace tooling overhaul.** If `print-room-staff-portal` is not already in the pnpm workspace alongside the design tool, the integration option is to extract `@print-room-studio/pricing` to a private npm package (decision §9.1) — not to migrate the whole repo into a monorepo.
- **Design-tool feature additions** — multi-design-per-product, neck label printing, embroidery 3D preview, etc. Spec covers porting *as-is* with the flow refactored for staff use; existing features are kept; new features are not added in this spec.

## 4. Architecture

### 4.1 Route structure (staff portal additions)

```
src/app/(portal)/designer/
  catalog/
    page.tsx                       Ported CatalogView + new "+ Add product" tile
  design/
    [productId]/[instanceId]/page.tsx   Ported design canvas (Fabric.js)
  review/
    [instanceId]/page.tsx          Ported review + new "Add to B2B catalogue" panel
src/app/api/designer/
  upload-asset/route.ts            Re-port of design tool's /api/upload-asset
  products/auto-swatch/route.ts    NEW — Sharp colour-quantisation
  submissions/route.ts             POST { design_data, pricing_data, images, target_catalogue_id?, target_org_id? }
                                   → INSERT design_submissions (status='approved')
                                   → if target_catalogue_id: INSERT b2b_catalogue_items + proof_catalogue_links
src/components/designer/
  AddProductModal.tsx              NEW
  AddToCatalogueDialog.tsx         NEW
  (ported) catalog/CatalogView.tsx, FilterBar.tsx
  (ported) design/DesignPage.tsx, DesignSidebar.tsx, ProductViewerCanvas.tsx, NeckLabelRenderer.tsx
  (ported) review/ReviewPage.tsx, SnapshotCaptureWorker.tsx, ProductList.tsx, IsolatedSizeGrid.tsx, IsolatedPricingDisplay.tsx
src/lib/designer/
  pricing/                         (re-export from @print-room-studio/pricing once workspace dep is wired)
  cart-storage.ts                  Ported (localStorage state for in-progress designs)
  design-context.tsx               Ported (Immer-based reducer for canvas state)
  design-persistence.ts            Ported (writes to design_drafts)
  snapshot-storage.ts              Ported (writes to design_snapshots)
  artwork-storage.ts               NEW — wraps upload-asset + writes design_artwork rows (currently 0 rows; schema present)
```

### 4.2 Route structure (customer portal — consumed contract)

This spec modifies `print-room-portal/app/(portal)/shop/page.tsx` and `print-room-portal/app/(portal)/shop/[productId]/page.tsx` to **prefer design-snapshot URLs over `product_images.file_url`** when a `proof_catalogue_links` row exists for the catalogue item the customer is viewing. Falls back to `product_images` when the catalogue item has no linked snapshots, preserving the current behaviour for products that aren't designer-built.

No customer-portal API route changes. No customer-portal cart/checkout changes. No new customer-portal env vars.

### 4.3 End-to-end flow diagram

```
┌────────────  staff opens /(portal)/designer/catalog  ────────────┐
│  Sees products filtered by collection_id (current design tool   │
│  catalog logic; see §9.2 for visibility rule decision)          │
│                                                                  │
│  Path A: clicks existing product card → /designer/design/...    │
│  Path B: clicks "+ Add product" tile → AddProductModal          │
│           ↓                                                      │
│           on submit:                                             │
│             POST /api/products  (creates products row)          │
│             POST /api/designer/products/auto-swatch  (Sharp)    │
│             POST /api/products/[id]/swatches  (insert × N)      │
│             POST /api/products/[id]/sizes/quick-add             │
│             POST /api/products/[id]/variants/bulk               │
│             POST /api/products/[id]/images  (uploaded image)    │
│             PATCH /api/products/[id]/channels/b2b               │
│           → redirect to /designer/design/[new id]/[instance id] │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────  /(portal)/designer/design/[productId]/[instanceId]  ────────────┐
│  Fabric.js canvas renders product_images views (front/back/etc.)             │
│  Staff uploads logo → POST /api/designer/upload-asset (design-artwork bucket)│
│                    → INSERT design_artwork row (NEW — table empty today)     │
│  Staff picks print method (screen/heat/embroidery), placement, qty           │
│  Pricing recalculates via @print-room-studio/pricing + RPCs                  │
│  Heavy state in localStorage (design-state-{instanceId}) + design_drafts row │
│  Click "Next" → /designer/review/[instanceId]                                │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────  /(portal)/designer/review/[instanceId]  ────────────┐
│  <SnapshotCaptureWorker> fires: html2canvas captures every view  │
│       → uploads to design-snapshots bucket                       │
│       → INSERT design_snapshots rows (one per view)              │
│  Staff sets size grid + final qty + pricing display              │
│  NEW <AddToCatalogueDialog>:                                     │
│       org picker (organizations list)                            │
│       catalogue picker (org's b2b_catalogues, OR "+ new")        │
│       primary view selector (which snapshot is the card image)   │
│       optional notes                                             │
│  Click "Add to B2B catalogue" → POST /api/designer/submissions:  │
│       BEGIN                                                      │
│         INSERT design_submissions (status='approved',            │
│           reviewed_by=auth.uid(), reviewed_at=now(),             │
│           design_data, pricing_data, images[])                   │
│         INSERT b2b_catalogue_items (catalogue_id, source_prod,   │
│           overrides from design tool pricing,                    │
│           metafields = { design_submission_id, primary_view })   │
│         FOR EACH design_snapshot row of this instance_id:        │
│           INSERT proof_catalogue_links                           │
│             (proof_id = design_submission_id, catalogue_item_id, │
│              design_index, view_type=view, is_primary, sort)     │
│       COMMIT                                                     │
│  → redirect to /(portal)/catalogues/[id]                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────  customer-portal /(portal)/shop  ────────────────────┐
│  Existing catalogue-scope query joins                            │
│   b2b_catalogue_items → products → product_images                │
│  PATCH: also LEFT JOIN proof_catalogue_links + design_snapshots  │
│  card image source: design_snapshots.scene_png_url               │
│                     WHERE proof_catalogue_links.is_primary=true  │
│                     ELSE product_images (existing behaviour)     │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Data model

### 5.1 Reuse-first — net schema change is ZERO

Every table this spec needs already exists. Four are populated; two are empty but schema-ready.

| Table | Rows today | Use in this spec |
|---|---|---|
| `products` | many | Add Product modal creates rows; designer catalog reads them |
| `product_color_swatches` | many | Auto-swatch endpoint writes rows |
| `product_variants` | 15 (Basic Tee, will be deleted in PRT cleanup) | Bulk-generated on Add Product submit |
| `product_images` | many | Uploaded image becomes primary image |
| `product_type_activations` | 7 | Channel toggle on Add Product submit |
| `design_drafts` | 49 | Heavy-state backup of in-progress designs |
| `design_submissions` | 8 | Canonical design payload; new rows have `status='approved'` |
| `design_artwork` | **0** | NEW writes — raw artwork file metadata, hyperlink retained for staff |
| `design_snapshots` | 10 | Rendered mockup library; ported snapshot worker writes to it |
| `b2b_catalogue_items` | 7 | Catalogue rows; `metafields.design_submission_id` is the new pointer |
| `proof_catalogue_links` | **0** | NEW writes — catalogue ↔ snapshots join (1:N by view) |

### 5.2 Semantic note on `proof_catalogue_links.proof_id`

The column is named `proof_id` but in this spec's usage it points to `design_submissions.id` (uuid). The original "proof" concept (deleted 2026-04-29) is gone; the column is reused without rename. Production code uses the staff-set semantic (submission id), not the historical one. If the rename is wanted later, it's a one-line migration.

### 5.3 `design_submissions.images[]` array

Existing column, currently populated by the customer self-serve flow with the rendered snapshot URLs. Staff flow uses the same column the same way: array of `design-snapshots` bucket URLs, one per view captured. The snapshot worker populates it after upload. `proof_catalogue_links` provides the keyed-by-view structured access for the customer PDP query.

### 5.4 `design_submissions.pricing_data jsonb`

Existing column. Staff flow stores the design tool's `PricingSnapshot` payload here:

```ts
{
  qty: number,
  currency: 'NZD',
  baseUnit: number,
  perUnitSubtotal: number,
  setupFeeTotal: number,
  totalEstimate: number,
  lines: [{ id, label, perUnit, amount }],
  method: 'screen' | 'heat' | 'embroidery',
  source: 'review',
  capturedAt: timestamp
}
```

This is the price the design tool computed. The B2B catalogue item's display price comes from `effective_unit_price` (catalogue-aware, tier-discounted), which may differ — both are stored, the diff is surfaced in the catalogue editor as a chip on each item (§9.3 locked).

### 5.5 New write path for `design_artwork`

The schema is `(id, design_id, user_id, placement, storage_path, public_url, sha256, created_at)`. The design tool today uploads to the bucket but never writes the table. New `artwork-storage.ts` wraps the existing upload-asset endpoint to also write the table row. Staff can later query "all artworks for this org / this design / this catalogue item" via:

```sql
SELECT da.public_url, da.placement, da.created_at, ds.design_name
FROM design_submissions ds
JOIN design_artwork da ON da.design_id = ds.id
WHERE ds.id = (SELECT (metafields->>'design_submission_id')::uuid
               FROM b2b_catalogue_items WHERE id = $1)
```

That join is the "staff hyperlink for repeat orders / production".

## 6. New work — component-level

### 6.1 Add Product modal (`AddProductModal.tsx`)

Fields:

- Product name * (text, required)
- Brand * (combobox sourced from `/api/brands`)
- Category * (combobox sourced from `/api/categories`)
- Garment family (select: cap, tee, hoodie, other)
- Image upload * (drag-drop; uploads to `product-images` bucket)
- Sizes offered (multi-select XS / S / M / L / XL / 2XL / 3XL / OSFA)
- Decoration eligible (toggle)
- Decoration positions (multi-select: front / back / sleeve_left / sleeve_right / neck)
- Notes (textarea)

On submit: orchestrates the 7-call sequence in §4.3 Path B. Redirects to designer canvas with the new product loaded.

### 6.2 Auto-swatch endpoint (`/api/designer/products/auto-swatch`)

Server-side. Loads the uploaded image via Sharp, applies k=5 colour quantisation, drops near-white and near-black background clusters, maps each remaining cluster centroid to nearest entry in a curated colour-name palette (`black`, `white`, `navy`, `red`, `royal`, `royal_blue`, `forest`, `forest_green`, `heather`, `heather_grey`, `charcoal`, `bottle_green`, `burgundy`, `cream`, `khaki`, `tan`, `pink`, `purple`, `orange`, `yellow`). Returns `[{ label, hex }]`. The Add Product modal then POSTs each entry to `/api/products/[id]/swatches`.

### 6.3 Add to B2B Catalogue dialog (`AddToCatalogueDialog.tsx`)

Lives on the review page action bar. Fields:

- Organization * (combobox sourced from `/api/organizations`)
- Catalogue (combobox: "Select existing" populated by `/api/catalogues/by-org/[orgId]`, or "+ Create new")
- Catalogue name (only shown when "+ Create new" selected)
- Primary view (select: front / back / side / etc. — populated from captured snapshots)
- Notes (textarea, optional)

Submit handler: POST `/api/designer/submissions` with the design_submission payload + target catalogue + primary view. Server-side transaction handles the multi-row insert.

### 6.4 Submissions endpoint (`/api/designer/submissions/route.ts`)

```ts
POST body: {
  instance_id: string,
  product_id: uuid,
  design_data: jsonb,       // customizations.logos[], customizations.colors, etc.
  pricing_data: jsonb,      // PricingSnapshot
  images: string[],         // array of design_snapshots URLs
  target_organization_id: uuid,
  target_catalogue_id?: uuid,         // OR target_catalogue_name
  target_catalogue_name?: string,
  primary_view: text,
  notes?: text
}

Server transaction:
  1. INSERT design_submissions (
       customer_id = current staff user id,
       customer_email = current staff email,
       company_id = target_organization_id,
       design_id = instance_id,
       design_name = product name,
       design_data, pricing_data, images,
       status = 'approved',
       reviewed_by = auth.uid(),
       reviewed_at = now(),
       submitted_at = now(),
       collection_id = NULL
     ) RETURNING id

  2. IF target_catalogue_id is NULL:
       INSERT b2b_catalogues (organization_id, name = target_catalogue_name)
         RETURNING id → catalogue_id
     ELSE: catalogue_id = target_catalogue_id

  3. INSERT b2b_catalogue_items (
       catalogue_id,
       source_product_id = product_id,
       markup_multiplier_override = pricing_data.markup if any,
       decoration_type_override = pricing_data.method,
       decoration_price_override = pricing_data.setupFeeTotal / qty,
       metafields = {
         design_submission_id: <step 1 id>,
         primary_view: primary_view,
         pricing_snapshot: pricing_data
       }
     ) RETURNING id → catalogue_item_id

  4. FOR EACH design_snapshots row WHERE instance_id = body.instance_id:
       INSERT proof_catalogue_links (
         proof_id = <step 1 id>,
         catalogue_item_id,
         design_index = 0,                  -- single-design v1
         view_type = snapshot.view,
         is_primary = (snapshot.view == primary_view),
         sort_order = snapshot view order index
       )

  5. COMMIT
  6. Return { catalogue_id, catalogue_item_id, design_submission_id }
```

### 6.5 Snapshot worker port

Copy `<SnapshotCaptureWorker>` from the design tool unchanged. It already writes to `design_snapshots` correctly. The only adaptation is the staff-portal supabase client import (server vs anon).

### 6.6 Customer portal patch

Two queries to update:

- `print-room-portal/app/(portal)/shop/page.tsx` — catalogue card list. Add a LEFT JOIN to `proof_catalogue_links` + `design_snapshots` filtered to `is_primary=true`. Replace the image source coalesce: `COALESCE(design_snapshots.scene_png_url, product_images.file_url, NULL)`.
- `print-room-portal/app/(portal)/shop/[productId]/page.tsx` — PDP gallery. Same join; build the gallery URL list from all `proof_catalogue_links` rows for the catalogue item, ordered by `sort_order`, falling back to `product_images` if the join is empty.

## 7. Build order

Five phases, demo-able at each boundary. ~13–14 days focused engineering.

### Phase 1 — Foundations (1.5 days)

- Apply §9.1 lock: extract pricing logic from design tool's `lib/pricing/` into a new `packages/pricing/` workspace package within the design-tool monorepo. Consume from staff portal via `pnpm add file:../print-room-studio/...` for local dev. Defer npm publish until CI requires it.
- Confirm `calculate_embroidery_price_v2` and `calculate_heat_price` RPCs are callable from staff-portal context.
- Stand up `/(portal)/designer/` route group with staff auth guard (mirrors existing `(portal)` layout).

**Demo gate:** `pnpm dev` in staff portal; visit `/designer/catalog` → renders empty placeholder; `pricing-test` route returns a valid PricingSnapshot from RPC.

### Phase 2 — Catalog + Add Product (2 days)

- Port `CatalogView` + `FilterBar` from design tool into `src/components/designer/catalog/`.
- Replace anonymous nav helper with staff-portal-aware router push.
- Build `AddProductModal` + `auto-swatch` endpoint.
- Wire Add Product flow's 7-call orchestration.

**Demo gate:** Staff uploads a hoodie image, fills modal, lands on canvas with new product loaded. Swatches populated automatically. Variants generated.

### Phase 3 — Design canvas (4 days)

- Port `DesignPage`, `DesignSidebar`, `ProductViewerCanvas`, `NeckLabelRenderer`, `MethodCard`.
- Port `DesignContext` reducer + `cart-storage.ts` + `design-persistence.ts`.
- Re-port `/api/designer/upload-asset` (re-export of design tool's upload-asset).
- Add `artwork-storage.ts` wrapper that ALSO writes `design_artwork` rows (NEW — table is empty today).
- Wire `useQuoteEstimator` to the staff-portal pricing path.

**Demo gate:** Staff applies a logo to the new product, picks Embroidery + front placement, sees live pricing total update. Reload page → state restored from `design_drafts`.

### Phase 4 — Review + B2B catalogue submit (4 days)

- Port `ReviewPage`, `SnapshotCaptureWorker`, `ProductList`, `IsolatedSizeGrid`, `IsolatedPricingDisplay`.
- Build `AddToCatalogueDialog` + `/api/designer/submissions` transactional handler.
- Strip the design tool's "submit for quote" terminal (which routed to `/details/`); replace with the catalogue submit.

**Demo gate:** End-to-end. New product → designed → review → "Add to PRT Demo Catalogue" → `b2b_catalogue_items` row appears in `/catalogues/[id]` editor with the rendered snapshot.

### Phase 5 — Customer PDP read-through (1 day)

- Patch `print-room-portal/app/(portal)/shop/page.tsx` and `[productId]/page.tsx` queries.
- Verify fallback: products without designs still render their `product_images`.

**Demo gate:** Customer logs into customer portal as PRT user, sees the staff-designed mockup as the catalogue card image. PDP gallery shows all snapshot views.

## 8. Pre-flight: PRT cleanup

The existing 8 PRT-test products (1 b2b-only sticker + 6 half-built workwear products + Basic Tee) should be deleted before Phase 2 starts so the designer catalog isn't cluttered with dead test data. Audit completed 2026-04-30: all 8 are cascade-safe (zero FK NO ACTION blockers, zero cross-org references, zero quote items). Deletion is a single transactional `DELETE FROM products WHERE id IN (...)`. Pulled out as a separate pre-flight task in the plan; not part of the phased work above.

## 9. Decisions (locked 2026-04-30)

### 9.1 Workspace strategy — LOCKED: extract to package + file: protocol locally

How does `print-room-staff-portal` consume `@print-room-studio/pricing`?

- (a) Add `print-room-staff-portal` to the existing pnpm workspace.
- (b) Extract `@print-room-studio/pricing` to a private npm package.
- (c) Symlink or git-submodule the package source.

**Decision:** **(b), with a hybrid delivery — extract pricing logic into its own workspace package within the design-tool monorepo (`packages/pricing/`), consume from staff portal via `pnpm add file:../print-room-studio/apps/design-tool/packages/pricing` for local dev.** Convert to private npm publish only if CI requires it.

**Rationale:** (a) requires a major monorepo migration of the staff portal — too much upfront cost for a single integration point. (c) is fragile. (b) keeps the package source single-sourced and lets the staff portal consume it without leaving its own repo structure. The file: protocol works for the single-developer setup. If CI/CD needs a published artifact, that's a one-step `pnpm publish` follow-up.

### 9.2 Designer-catalog visibility rule — LOCKED: decoration_eligible + canvas-readiness join

Which products show in the designer catalog?

- (a) All `is_active=true` products.
- (b) Only products with `decoration_eligible=true`.
- (c) New flag `products.is_designable boolean`.

**Decision:** **(b) plus a canvas-readiness join — the catalog query filters `decoration_eligible=true AND EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id AND view_lower = 'front')`.**

**Rationale:** (a) clutters the catalog with non-printable goods. (c) duplicates a flag that already exists semantically. (b) is data-driven and uses what's there. The canvas-readiness join is a v1 guard — without a front-view image the Fabric.js canvas renders an empty grey square. The Add Product modal in §6.1 always uploads a front-view image, so all products created via the designer flow auto-pass the filter.

### 9.3 Catalogue-item price source — LOCKED: store both, surface diff

When staff "Add to B2B catalogue", what price does the catalogue item display?

- (a) Snapshot at submission time only.
- (b) Live `effective_unit_price` only.
- (c) Both — store snapshot for audit, recompute live for display, surface the diff.

**Decision:** **(c).**

**Rationale:** Snapshot is already going into `metafields.pricing_snapshot` per §6.4. Live recompute via `effective_unit_price` happens on every PDP / catalogue editor query anyway. The diff is computed in the catalogue editor (`/(portal)/catalogues/[id]`) and surfaced as a chip on each item: e.g. *"Snapshot: $42.50 · Live: $44.00 · diff +$1.50"*. Account managers can (i) update the live price upstream, (ii) re-snapshot via "Refresh from design", or (iii) ignore. Cost: ~5 lines of SQL plus a UI chip component.

### 9.4 Snapshot capture strategy — LOCKED: client-side v1, instrument and escalate

Keep the design tool's `<SnapshotCaptureWorker>` (client-side html2canvas) or move to server-side rendering?

- (a) Keep client-side.
- (b) Server-side via Puppeteer/Playwright headless.
- (c) Hybrid — client-side first, server-side retry on failure.

**Decision:** **(a) for v1.** Add structured logging on every snapshot upload outcome (success/failure + browser/version metadata) so we can measure failure rate post-launch. Escalate to (c) only if Phase 4 demo or post-launch monitoring shows >5% capture failures.

**Rationale:** (b) needs a Chromium binary in the staff portal's serverless runtime — adds bundle weight, cold-start cost, and a duplicated rendering pipeline. (c) is the right end-state if we have evidence of failures, but premature without that evidence. The design tool already has 10 successful design_snapshots rows in production, suggesting (a) works. Logging gives us the data to make a future decision; we don't need to over-engineer up front.

### 9.5 Customer self-serve cutoff — LOCKED: hide behind staff auth (don't delete)

The design tool's `/design`, `/review`, `/catalog` routes are public on the design tool app. After this port lands:

- (a) Delete those routes from the design tool app entirely.
- (b) Hide them behind staff auth on the design tool app too (defence in depth).
- (c) Leave them public.

**Decision:** **(b).**

**Rationale:** Per Jamie's lock 2026-04-30. Keeping the routes intact preserves the option to flip on customer self-serve later — a future `status='pending_review'` write path becomes a config flag rather than a re-port. Putting them behind staff auth prevents accidental URL-discovery while the routes are dormant. Implementation: add a layout-level auth guard at `print-room-studio/apps/design-tool/app/(public-design)/layout.tsx` (or equivalent) that redirects unauthenticated requests to the staff portal login.

## 10. Risks

- **DesignContext + cart-storage entanglement.** The design tool's state model assumes anonymous + localStorage. Staff portal has Supabase auth and server components. Phase 3 may force a partial rewrite of the state layer; if so, expect Phase 3 to slip from 4 to 6 days. Detection: first day of Phase 3 — if cart-storage.ts pulls in unexpected anonymous-flow assumptions, escalate.
- **html2canvas reliability.** Known flaky on some browsers. If snapshots fail in the staff context, customer PDPs render fallbacks instead of designed mockups — a silent quality regression. Mitigation: log every snapshot upload result and dashboard the failure rate; switch to server-side renderer (§9.4) if >5%.
- **Pricing divergence.** Two engines computing different totals for the same configuration is a bug magnet. Decision §9.3 closes this for catalogue items, but the design canvas itself still uses the design tool's pricing. Acceptable v1; revisit when unifying.
- **Workspace extraction (§9.1).** If extraction proves harder than expected (e.g., the package has internal deps on other `@print-room-studio/*` packages), Phase 1 slips. Detection: first hour of Phase 1; if the package has more than 2 internal deps, switch to (a) workspace expansion.
- **`design_artwork` table empty today.** The new write path is the first real production usage of this table. RLS / indexes / cascades have never been exercised. Run an advisor scan post-Phase 3 (`mcp get_advisors`) to surface any latent schema issues.
- **Customer PDP fallback.** A buggy `proof_catalogue_links` LEFT JOIN could render NULL images instead of falling back to `product_images`. Phase 5 demo is the gate; verify both paths explicitly.

## 11. Migration / cutover

There is no migration. The design tool app keeps running unchanged. The staff portal gains new routes that operate in parallel. No data is moved; new submissions and catalogue items use the existing tables. Rollback is "revert the staff portal commits and the customer portal /shop patch" — design-tool app is untouched.

## 12. Out of band — what this spec assumes

- The 2026-04-29 iframe decouple holds. No new iframe wiring.
- The 2026-04-30 PRT cleanup audit holds — 8 test products are cascade-safe to delete pre-Phase-2.
- The shared Supabase project `bthsxgmcnbvwwgvdveek` continues to serve both apps. No project split.
- `@print-room-studio/pricing` package internals are stable enough to extract without significant rewrite. (Not yet verified; first task of Phase 1.)
- Staff portal's existing `effective_unit_price` SQL function returns NZD and applies tier discounts in the same direction the design tool's pricing does. (Verified separately in `project_b2b_pricing_canonical.md`.)
