# Proofs Phase 1.5 — Production Fix + Real Builder — Design Spec

**Date:** 2026-04-29
**Status:** Draft (locked decisions per Jamie's "we're going Standard with proofs working" — Axis 2 of MVP one-pager)
**Owner:** Jon
**Repo:** `print-room-studio/apps/design-tool`
**Source:** Phase 1 of D3 spec shipped via PR #44 + hotfix `d5351c75`. Triage findings: vanilla `puppeteer` in serverless build won't work; builder is a stub that doesn't capture real proof content; HTML template lacks Allpress fidelity.

**Supersedes none.** This is the second pass at completing Phase 1 of the original D3 spec — turning "foundation" into "actually usable".

## 1. Context

Phase 1 (D3-α) shipped the schema, storage bucket, CRUD APIs, basic builder shell, internal HTML template, and puppeteer pipeline. End-to-end smoke against PRT works on local dev (designs[] add/remove/rename → save snapshot → render PDF → empty-ish proof in iframe).

Three problems block production use:

1. **Vercel can't build vanilla `puppeteer`.** The design-tool's `vercel.json` has `PUPPETEER_SKIP_DOWNLOAD=1` (correctly — vendoring chromium would explode bundle size). But `lib/proofs/pdf.ts` imports the full `puppeteer` package, which can't run without the bundled browser. Production deploy will succeed in build but the render-pdf route will 500 at runtime.
2. **Builder is a designs[] add/remove/rename only.** No artwork upload. No print-area placement. No method picker. No dimensions input. No Pantones input. No garment applications. No line-items table. The PDF that gets generated has nothing in it.
3. **HTML proof template is a 2-section skeleton.** Even with builder data, the template lacks: per-design proof pages with mockup images, per-design artwork pages, the cover-page formatting, the line-items table styling that matches the Allpress reference proof.

This spec covers fixing all three.

## 2. Goals

- Render-pdf route works on Vercel production (swap to `puppeteer-core` + `@sparticuz/chromium-min`, plus `runtime = 'nodejs'` and `maxDuration = 60`).
- Builder captures every field the Allpress reference proof contains: customer + job metadata, designs with artwork upload + print specs, garment applications with mockups, line-items table.
- Proof PDF renders with visual fidelity comparable to the Allpress reference — cover page + per-design proof page + per-design artwork page.
- Mockup pre-rendering pipeline exists (puppeteer screenshots of the design-tool canvas at builder save-time, uploaded to storage).

## 3. Non-goals

- **Customer approval flow** — that's Phase 2 of original D3 spec, separate work
- **Catalogue link UI in staff-portal** — Phase 3
- **Customer archive in customer-portal** — Phase 3
- **Version revisions / change-order fee surfacing** — Phase 4
- **Real-time collaboration on the builder** — single-staff edit only
- **Auto-extract decoration data from artwork files** — staff types Pantones manually
- **Mobile-responsive builder** — staff use desktops; builder is desktop-only

## 4. Architecture

### 4.1 Vercel-compatible puppeteer

```
Replace in apps/design-tool:
  package.json:                     remove `puppeteer`, add `puppeteer-core` and `@sparticuz/chromium-min`
  src/lib/proofs/pdf.ts:            swap import + launch shape (chromium.executablePath() + args)
  src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.ts:
                                     ensure `runtime = 'nodejs'`, `maxDuration = 60`, `preferredRegion = 'syd1'`
  vercel.json:                       keep PUPPETEER_SKIP_DOWNLOAD=1; add NODE_OPTIONS if needed
```

The `@sparticuz/chromium-min` package ships only the chromium binary download URL — actual browser is fetched at runtime from S3 the first time, cached for subsequent invocations. ~50MB cold start latency. Acceptable for proof render (already 5-15s).

### 4.2 Real builder integration

The existing `ProductCustomizer` (from `src/components/design/customization/ProductCustomizer.tsx`) is the customer flow's canvas + controls. For the proof builder we want the same canvas with proof-context overlays.

**Option A (locked):** Extend `ProductCustomizer` with an optional `proofContext` prop. When set, the customizer renders into the proof builder's design state instead of the customer's quote state. Pro: reuses ALL the canvas + controls work. Con: couples proof flow to customer-tool component lifecycle changes.

**Option B (rejected):** Fork into `ProofProductCustomizer`. Cleaner separation but ~3 days of duplicate work + ongoing maintenance burden.

Going with A. New file `src/components/proofs/ProofProductCustomizerHost.tsx` wraps the existing customizer + handles the proof-state side of the data flow. The customizer itself accepts a small `onProofChange` callback prop.

### 4.3 Builder UI (replaces ProofBuilderShell.tsx)

```
ProofBuilderShell (top-level)
├── Header: customer + job metadata form (name, reference, delivery date, additional notes, prepared-by)
├── Designs panel (sidebar)
│   └── For each design:
│       ├── Design name input
│       ├── Artwork uploader (drag/drop → Supabase storage)
│       ├── Method picker (Screenprint / Embroidery / Heat press / Super colour / Other)
│       ├── Pantone codes (multi-input + autocomplete from common Pantones)
│       └── Garment applications panel
│           └── For each application:
│               ├── Product picker (typeahead from catalogue or master)
│               ├── Variant picker (color × size)
│               ├── Print areas (label / dimensions w_mm × h_mm / production note)
│               ├── ProductCustomizerHost (the canvas — for placement)
│               └── Line items (sizes table with qty per size)
└── Footer: "Save snapshot & generate PDF" button
```

Save flow:
1. Build snapshot from current state (customer + job + designs[] with full content + line_items computed from garment applications)
2. POST `/api/proofs/[id]/versions` with the snapshot
3. POST `/api/proofs/[id]/versions/[versionId]/render-pdf` to trigger PDF + mockup generation
4. Redirect to `/staff-quote/proof/[id]/preview`

### 4.4 HTML proof template upgrade

Replace `src/app/internal/proof-html/[versionId]/page.tsx` with a multi-section template:

- **Cover page** (1 page): Print Room header, customer + job block, line-items table, T&Cs
- **Per-design proof pages** (N pages, one per design): "FINAL PROOF — DESIGN N" header with brand colors, design name, front + back garment mockups (rendered images), print-area details (label, method badge, dimensions, Pantones, production notes)
- **Per-design artwork pages** (N pages): "ARTWORK — DESIGN N" header, the raw artwork file at scale, T&Cs + Print Room footer

CSS uses A4 landscape, print-friendly fonts (Inter for headers, system-ui body), brand colours via tokens.

### 4.5 Mockup pre-rendering

When user clicks "Save snapshot & generate PDF", before triggering render-pdf:
1. For each design × garment application, render the canvas server-side via puppeteer to a PNG at 600×600
2. Upload to `design-proofs/<proof_id>/<version_id>/mockups/<design_index>-<view>.png`
3. Store paths in `snapshot_data.designs[i].garment_applications[j].mockup_paths`
4. The HTML proof template references these mockup URLs in `<img>` tags

Renders happen in parallel (Promise.all). 30s budget for largest proofs.

## 5. Data model

**No new tables.** All schema landed in Phase 1.

The `snapshot_data` JSONB on `design_proof_versions` already supports the full Allpress shape per Phase 1 spec §5.2 — builder just needs to populate it for real.

## 6. UI components added/modified

| File | Change |
|---|---|
| `src/components/proofs/ProofBuilderShell.tsx` | **Rewrite.** Replace designs[] add/remove/rename with full builder above. |
| `src/components/proofs/ProofProductCustomizerHost.tsx` | **New.** Wraps existing ProductCustomizer with proof-state binding. |
| `src/components/proofs/CustomerJobMetadata.tsx` | **New.** Top form for customer + job fields. |
| `src/components/proofs/DesignsPanel.tsx` | **New.** Sidebar listing designs + add/remove. |
| `src/components/proofs/DesignEditor.tsx` | **New.** Single-design editor (artwork upload, method, Pantones, garment applications). |
| `src/components/proofs/GarmentApplicationEditor.tsx` | **New.** Per-application: product/variant pickers, print-area form, sizes/qty. |
| `src/components/proofs/ArtworkUploader.tsx` | **New.** Drag-drop to Supabase storage `design-proofs` bucket. |
| `src/components/proofs/PantoneInput.tsx` | **New.** Multi-input with autocomplete. |
| `src/components/design/customization/ProductCustomizer.tsx` | **Modify.** Accept optional `proofContext` + `onProofChange` props. |
| `src/lib/proofs/pdf.ts` | **Rewrite import + launch.** puppeteer-core + chromium-min. |
| `src/lib/proofs/mockups.ts` | **New.** Pre-render pipeline (puppeteer screenshots of canvas → PNG → storage). |
| `src/app/internal/proof-html/[versionId]/page.tsx` | **Rewrite template.** Cover + per-design proof + per-design artwork pages with full Allpress fidelity. |

## 7. API contracts

**No new routes.** Existing routes from Phase 1 still serve:
- `POST /api/proofs/[id]/versions` accepts the fuller snapshot shape (already typed for it in Phase 1)
- `POST /api/proofs/[id]/versions/[versionId]/render-pdf` extended to do mockup pre-render before PDF render

The render-pdf route flow becomes:
```
1. Load version snapshot
2. For each design × garment application, render mockup PNG (parallel)
3. Upload all mockups to storage
4. Update snapshot_data with mockup URLs (PATCH version)
5. Render PDF via puppeteer + HTML template
6. Upload PDF to storage
7. Return signed URL
```

Total budget: 30s for mockups + 15s for PDF = 45s. Vercel maxDuration set to 60s with 15s buffer.

## 8. Auth, permissions, RLS

Unchanged from Phase 1. Existing `verifyStaffToken` JWT auth + `requireProofsAccess` helper apply.

## 9. Env vars

- `PUPPETEER_SKIP_DOWNLOAD=1` (existing — keep)
- `INTERNAL_RENDER_TOKEN` (existing — keep)
- `NEXT_PUBLIC_APP_BASE_URL` (existing — keep, MUST be set for puppeteer to reach internal route)
- No new vars

## 10. 4-axis stack rationale

- **Rendering:** server-rendered internal HTML (puppeteer target). Builder is client-side React (existing). No SSR needed for builder — staff are authenticated.
- **Caching:** none. Builder is per-staff, per-proof. Render is per-version, on-demand.
- **Performance:** mockup pre-render is the expensive step (parallel puppeteer screenshots). 30s budget. PDF render adds 15s. Vercel maxDuration 60s. Cold-start chromium-min adds ~3s on first invocation post-deploy.
- **Ecommerce pattern:** n/a (internal proof builder).

## 11. Decisions locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | Puppeteer strategy | `puppeteer-core` + `@sparticuz/chromium-min` (Vercel-compatible) |
| 2 | ProductCustomizer integration | Extend existing component with optional proof-context prop (Option A) |
| 3 | Mockup pre-rendering | Server-side puppeteer screenshots of canvas at save time, parallel |
| 4 | HTML template fidelity bar | Allpress reference proof — cover + per-design proof + per-design artwork |
| 5 | Save flow | Save snapshot AND trigger PDF in one click (no separate "save then render" step) |
| 6 | Mobile builder | Out of scope; desktop-only |

## 12. Verification

- Vercel preview deploy succeeds; render-pdf route returns PDF URL on POST
- Builder against PRT: create proof, add 1 design with artwork upload, 1 garment application, set print areas + Pantones, set sizes/qty, save → PDF generates with cover page + design proof page (with mockup) + artwork page
- Generated PDF visually comparable to Allpress reference (3 sections, similar typography, full content per design)
- Existing PRT proof from Phase 1 (`design_proofs.id = ccc9a16e-...`) still loads in builder; can be edited and re-saved
- No regressions in existing customer design flow at `/design/...`

## 13. Dependencies & follow-ups

- Existing Phase 1 schema, storage bucket, auth, CRUD routes, hotfix `d5351c75` all consumed unchanged
- Pairs with WS3 (customer-portal polish) — proofs visibility on customer side starts in Phase 3 (post-MVP)
- v1.1 follow-ups still:
  - Customer approval flow + signed-token URL (Phase 2)
  - Catalogue-item linkage UI (Phase 3)
  - PDP gallery resolution from approved proofs (Phase 3)
  - Version revisions + $35 change-order fee surfacing (Phase 4)
  - Mobile builder responsive layout

## 14. Open questions

- Q1 — pantone autocomplete data source: hardcoded list of common Pantones, or external API? Default: hardcoded.
- Q2 — mockup rendering when artwork is missing: skip mockup or render placeholder? Default: skip (and the proof PDF will have a "no mockup" state per design).
- Q3 — concurrency limit on mockup pre-render: render all in parallel or batch? Default: 4 concurrent (matches typical Vercel function memory budget).
