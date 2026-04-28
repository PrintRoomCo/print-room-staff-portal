# B2B Design Proofs — Multi-Repo Design Spec

**Date:** 2026-04-28
**Status:** Draft (D3 direction approved per Jamie 2026-04-28; awaiting spec review)
**Owner:** Jon (jon@theprint-room.co.nz)
**Scope:** Cross-repo (`print-room-studio/apps/design-tool`, `print-room-staff-portal`, `print-room-portal`)
**Source:** A3 brainstorm + scout report 2026-04-28 (D3 chosen over D1/D2). Reference proof: `_Allpress Espresso_proof_20 Apr 2026.pdf` (29 pages, 13 designs across tees / totes / beanies / caps).
**Supersedes:** A3's earlier `b2b_catalogue_item_images` table extension proposal — proofs become the canonical source of catalogue-item images.

## 1. Context

Account managers currently produce design proofs (Allpress-style 29-page PDFs) by hand in InDesign / similar, email them to customers, capture approval over email, then tell sales. Mockups never reach the customer's `/shop` PDP, so the same artwork has to be communicated by email each reorder.

Three things make this fixable now:

1. **Proof structure is regular.** Cover (customer + line-items table) + per-design proof page (mockup, print areas, method, Pantone codes, dimensions, artwork status) + per-design artwork page. Mechanical to template.
2. **The design-tool already has the primitives.** Garment mockup rendering (`ConsistentProductViewer`), print-area selection (`PrintAreaSelector`), method selection (`MethodCard`), staff auth (`verify-staff-token`), PDF generation pipeline (`invoice-generator.ts` + pdf-lib + puppeteer), email (resend/nodemailer), and a complete `(staff-quote)` route group that mirrors the customer flow. The platform-fragmentation memory is real but the design-tool is the one that's farthest along.
3. **Sub-app #3 just shipped catalogues.** Approved proofs need to feed catalogue-item images so the PDP gallery resolves account-specific mockups. The hook point exists.

## 2. Goals

- Account managers build proofs in a staff entry to the design-tool, not InDesign.
- Each proof is versioned; revisions track Chris's $35 change-order fee.
- Customer receives a signed-link approval page (no portal login required) with the PDF and a sign-and-date workflow.
- Approved proofs become the canonical image source for catalogue-item PDPs in `print-room-portal`.
- Customer-portal archive lets returning customers see prior proofs without contacting sales.
- The design-tool gets an explicit "Build a B2B proof" entry mode that's distinct from "I'm a customer designing a one-off".

## 3. Non-goals (out of scope)

- **Replacing `staff_quotes`** — proofs are the *design-spec* layer; quotes remain the *commercial* layer. They reference each other (a proof can become a staff_quote on approval), but their lifecycles diverge (a customer can approve a proof without committing to an order, or commit to an order with no formal proof step).
- **Replacing the existing customer design flow** — the existing `/design/...` routes for individual customer designs continue unchanged.
- **Replacing Monday CRM for the order itself** — once a proof is approved, the resulting order still flows to Monday via existing helpers.
- **Auto-generating mockups** — staff still position artwork manually in the design-tool. v1 is "tool to build the proof faster", not "AI does it for you".
- **Tracking print-shop production status on the proof** — that's `job_trackers`. Proof approval triggers production downstream; production state lives elsewhere.
- **Migrating historical InDesign proofs** — start fresh. Old proofs stay in email archives.
- **Customer-side proof editing** — customers approve or request changes (text comment); they do not edit the design themselves.
- **Public proof links indexable by search engines** — proof URLs are signed tokens with `noindex` headers and rate-limited views.

## 4. Architecture

### 4.1 Repos and division of labour

| Repo | Role |
|---|---|
| `print-room-studio/apps/design-tool` | Staff proof-builder UI (extends existing `(staff-quote)` flow); proof PDF generator; proof submission API (writes `design_proofs.*`); customer approval page at `/proof/[token]` |
| `print-room-staff-portal` | Catalogue editor reads approved proofs and links to catalogue items via `proof_catalogue_links`; staff dashboard for "all proofs" |
| `print-room-portal` | Customer archive at `/proofs`; PDP gallery resolves catalogue-linked proof images first, master images fallback |

Why split this way: the design canvas + PDF generation belong with the design-tool's existing infrastructure. The catalogue-item link belongs with the catalogues sub-app. The customer-facing archive lives where customers already log in for `/shop` and `/order-tracker`.

### 4.2 Route changes

**`design-tool` (staff side):**
```
src/app/(staff-quote)/staff-quote/proof/
  new/page.tsx                       Entry: pick org + name → creates draft design_proof, redirects to builder
  [proofId]/builder/page.tsx         Multi-design builder (extends ProductCustomizer with proof context)
  [proofId]/preview/page.tsx         Renders the would-be PDF in-app for staff sign-off before sending
  [proofId]/send/page.tsx            "Send for approval" — generates PDF, uploads to storage, emails customer, transitions status

src/app/api/proofs/
  route.ts                           POST create draft; GET list (staff)
  [id]/route.ts                      PATCH (rename, archive); GET (full proof + current version)
  [id]/versions/route.ts             POST create new version (change-order); GET list versions
  [id]/versions/[versionId]/render-pdf/route.ts   POST → returns PDF URL (puppeteer)
  [id]/versions/[versionId]/send/route.ts         POST → email customer with signed-token link
```

**`design-tool` (customer-facing approval — no login required):**
```
src/app/proof/[token]/page.tsx       SSR: token → signed JWT → render approval UI (PDF preview + sign-and-date OR request changes)
src/app/api/proof/[token]/approve/route.ts       POST: signature, name, IP; transitions version → 'approved'
src/app/api/proof/[token]/request-changes/route.ts  POST: notes; transitions version → 'changes_requested'
```

**`print-room-staff-portal`:**
```
src/app/(portal)/proofs/page.tsx     Cross-org list (filter by org/status/date)
src/app/api/proofs/*                 Read-only proxies that surface design-tool's proof tables to the staff portal (uses shared Supabase)
```

The catalogue editor (`/catalogues/[id]`) gains a new sub-tab **Linked proofs** that shows which approved proofs feed images into this catalogue's items + an "Add proof" picker.

**`print-room-portal`:**
```
app/(portal)/proofs/page.tsx                    Customer archive: list approved proofs for this org
app/(portal)/proofs/[id]/page.tsx               PDF preview + version history + "request reorder of this design" CTA
```

PDP gallery query at `/shop/[productId]` extends: when there's a `proof_catalogue_links` row for the (catalogue_item, b2b_org) pair, prefer those images over master `product_images`.

### 4.3 Storage

Supabase storage bucket `design-proofs` (private; signed URLs only):
```
proofs/<proof_id>/<version_id>/proof.pdf       Generated proof PDF
proofs/<proof_id>/<version_id>/artwork/<n>.<ext>   Raw artwork files for design n
proofs/<proof_id>/<version_id>/mockups/<design>-<view>.png   Rendered garment mockups
```

Mockups are pre-rendered at PDF generation time using puppeteer screenshots of the design-tool canvas — same approach as the existing `generate-views` admin route.

PDP gallery URLs come from public-bucket re-encoding (a small server function copies approved mockup PNGs into `b2b-catalogue-images` public bucket on link). Trade-off: signed URLs would force every PDP to mint a token; public re-encode means anyone with the catalogue-image URL can view, but they'd need the org-scoped catalogue assignment to find it. v1 chooses public-read (low confidentiality risk for already-approved B2B mockups; v1.1 can swap to signed if a customer raises confidentiality).

## 5. Data model

### 5.1 New tables

```sql
-- Migration: 20260428_design_proofs_core
create table if not exists design_proofs (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations(id) on delete restrict,
  name                     text not null,
  customer_email           text not null,
  customer_name            text,
  status                   text not null default 'draft'
    check (status in ('draft','sent','approved','changes_requested','superseded','archived')),
  current_version_id       uuid,
  created_by_user_id       uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  approved_at              timestamptz,
  approval_signature_text  text,
  approval_signed_by_email text,
  approval_signed_by_name  text,
  approval_ip              inet,
  archived_at              timestamptz
);

create index design_proofs_org_status_idx
  on design_proofs (organization_id, status) where archived_at is null;
create index design_proofs_status_idx
  on design_proofs (status);

create table if not exists design_proof_versions (
  id                       uuid primary key default gen_random_uuid(),
  proof_id                 uuid not null references design_proofs(id) on delete cascade,
  version_number           integer not null,
  status                   text not null default 'draft'
    check (status in ('draft','sent','approved','changes_requested','superseded')),
  -- Immutable point-in-time snapshot of designs, line items, print specs, customer/job metadata.
  -- Frozen on transition draft → sent. Subsequent edits create a new version.
  snapshot_data            jsonb not null,
  pdf_storage_path         text,
  pdf_generated_at         timestamptz,
  change_order_fee_amount  numeric(10,2) not null default 0,
  -- Token used for the customer approval URL. Rotates on supersede.
  approval_token_hash      text unique,
  approval_token_expires_at timestamptz,
  changes_requested_notes  text,
  created_by_user_id       uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  sent_at                  timestamptz,
  approved_at              timestamptz,
  constraint design_proof_versions_unique_number unique (proof_id, version_number)
);

create index design_proof_versions_proof_idx on design_proof_versions (proof_id);
create index design_proof_versions_token_idx on design_proof_versions (approval_token_hash) where approval_token_hash is not null;

-- Forward declaration FK on the parent (must come after versions table exists)
alter table design_proofs
  add constraint design_proofs_current_version_fk
  foreign key (current_version_id) references design_proof_versions(id) on delete set null;

create table if not exists design_proof_approvals (
  id                       uuid primary key default gen_random_uuid(),
  version_id               uuid not null references design_proof_versions(id) on delete cascade,
  action                   text not null check (action in ('approved','changes_requested')),
  signed_by_email          text not null,
  signed_by_name           text not null,
  signature_text           text,
  notes                    text,
  ip                       inet,
  user_agent               text,
  created_at               timestamptz not null default now()
);

create index design_proof_approvals_version_idx on design_proof_approvals (version_id);

create table if not exists proof_catalogue_links (
  id                       uuid primary key default gen_random_uuid(),
  proof_id                 uuid not null references design_proofs(id) on delete cascade,
  catalogue_item_id        uuid not null references b2b_catalogue_items(id) on delete cascade,
  -- Which design within the proof this link uses (index into snapshot_data.designs).
  design_index             integer not null,
  view_type                text check (view_type in ('front','back','side','sleeve','tag','lifestyle','other')),
  sort_order               integer not null default 0,
  is_primary               boolean not null default false,
  created_at               timestamptz not null default now(),
  constraint proof_catalogue_links_unique unique (catalogue_item_id, proof_id, design_index, view_type)
);

create index proof_catalogue_links_catalogue_item_idx
  on proof_catalogue_links (catalogue_item_id);
```

### 5.2 `snapshot_data` shape

```ts
interface ProofSnapshot {
  customer: {
    organization_id: string
    organization_name: string
    customer_code: string | null
    customer_email: string
    customer_name: string | null
  }
  job: {
    name: string
    reference: string
    delivery_date: string | null
    additional_notes: string | null
    prepared_by: { name: string; email: string; phone: string }
  }
  designs: Array<{
    index: number                      // 1-based, matches "DESIGN N" in the PDF
    name: string                       // e.g. "Tamaki Makaurau white"
    artwork: {
      original_filename: string
      storage_path: string
      preview_url: string              // signed URL at the time of snapshot
      colour_pantones: string[]        // ["PANTONE BLACK 4 C"]
      method: 'screenprint' | 'embroidery' | 'heat_press' | 'super_color' | 'other'
    }
    garment_applications: Array<{
      product_id: string                  // FK to products
      product_variant_id: string | null
      product_name: string                // snapshotted; survives master rename
      brand_name: string
      sku: string | null
      colour_label: string                // e.g. "Ecru"
      colour_code: string                 // e.g. "ECRU"
      print_areas: Array<{
        label: string                     // "LEFT CHEST", "CENTRE BACK", "BOTTOM LEFT"
        method: 'screenprint' | 'embroidery' | 'heat_press' | 'super_color' | 'other'
        dimensions_w_mm: number
        dimensions_h_mm: number
        production_note: string | null
      }>
      mockup_paths: {
        front: string | null               // storage path
        back: string | null
        other: Record<string, string>
      }
    }>
  }>
  line_items: Array<{
    design_index: number
    label: string                        // e.g. "Design 1 - Tamaki Makaurau white"
    is_staff_subtotal: boolean           // true for "(staff)" rows
    product_id: string
    product_variant_id: string | null
    brand_name: string
    garment_label: string
    sku: string | null
    colour_code: string
    sizes: Record<string, number>        // { 'S': 20, 'M': 53, ... }
    one_size_qty: number | null          // for totes/beanies/caps
    total_qty: number
  }>
  totals: {
    subtotal: number | null              // optional — kept for parity if a price was attached
    currency: string
  }
}
```

This shape comes directly from the Allpress PDF. Fields that look like duplication (`product_id` + `product_name`) are deliberate snapshotting — proofs are immutable historical documents.

### 5.3 Change-order fee semantics

- v1 = the original sent version. `change_order_fee_amount = 0`.
- v2 onward = `change_order_fee_amount = 35.00` *automatically applied* on version creation. Staff can override (set to 0) when the change is non-customer-driven (typo on our side, missing artwork, etc.).
- Fee surfaces on the proof PDF cover, on the approval page, and on the staff dashboard's per-version line.
- Fee enforcement is informational in v1 — no Xero / payment flow integration. Sales adds the line to the eventual quote.

## 6. Workflow & state machine

```
draft ─────► sent ─────► approved
  ▲           │             │
  │           ▼             │
  │     changes_requested ──┘  (revision creates new version, supersedes prior)
  │           │
  │           ▼
  └─── superseded
```

Transitions:
- `draft → sent` — staff action; locks the snapshot, generates PDF, emails customer, mints approval token (24-hour TTL by default, renewable)
- `sent → approved` — customer signs (via approval page); `proof.status` and version status both move to `approved`; `current_version_id` stays pointing at the approved version; an `approval` row is created
- `sent → changes_requested` — customer submits notes; staff get an email
- `changes_requested → superseded` — staff create v_n+1; v_n flips to `superseded`; `current_version_id` moves to v_n+1 (in `draft`)
- `approved → archived` — staff action; doesn't undo the approval, just hides from active lists

Tokens: HMAC of `(version_id, timestamp, secret)`. Hash stored in `approval_token_hash`. Plaintext token never persisted; sent in the email link.

## 7. PDF generation

**Approach:** puppeteer-based HTML→PDF, NOT pdf-lib drawing primitives. Reasons:
- The proof template is heavily layout-driven (page-per-design, mockups + tables); HTML/CSS handles this an order of magnitude better than pdf-lib
- Mockup rendering already happens in the design-tool's React canvas; reusing that canvas as the source of truth is the whole point of repurposing the design-tool
- The existing `generate-views` admin route already uses puppeteer-on-the-canvas; same pattern
- pdf-lib reservation: the existing `invoice-generator.ts` does use pdf-lib, but invoices are flat tabular data — different shape problem

**Pipeline:**
1. POST `/api/proofs/[id]/versions/[versionId]/render-pdf`
2. Server spawns headless puppeteer
3. Navigate to `<design-tool>/internal/proof-html/[versionId]?token=<service>` — a server-rendered HTML view of the proof using the snapshot_data
4. `page.pdf()` with format `A4`, landscape, print-CSS in the page
5. Upload to `design-proofs/<proof_id>/<version_id>/proof.pdf`
6. Update `pdf_storage_path` + `pdf_generated_at`

The internal `proof-html` route is service-token-protected and never linked publicly.

**Mockup pre-rendering** (separate prior step):
1. For each design × garment application, render the design-tool canvas with that artwork at that placement
2. Capture as PNG via `html2canvas` or puppeteer screenshot
3. Upload to `design-proofs/<proof_id>/<version_id>/mockups/<design>-<view>.png`
4. URLs land in `snapshot_data.designs[].garment_applications[].mockup_paths`

## 8. Auth, permissions, RLS

### 8.1 Staff (design-tool + staff-portal)

- Existing `verify-staff-token` JWT pattern in design-tool stays.
- Staff-portal uses `requireB2BAccountsStaffAccess` as the read gate (b2b_accounts:write OR admin/super_admin).
- New permission key `proofs:write` for design-tool staff actions. Falls back to `admin`/`super_admin`.

### 8.2 Customer approval URL (no login)

- Token-only access. No Supabase session required.
- Token TTL: 7 days from `sent_at`. Re-send creates a new token; old token revoked.
- Rate-limit: 60 views per token per hour to prevent enumeration / scraping.
- `noindex,nofollow` headers + `Referrer-Policy: no-referrer` on the approval page.

### 8.3 Customer portal (`/proofs`)

- Reads only proofs where `organization_id` is in user's `user_organizations` AND status in (`approved`, `superseded`).
- RLS:
  ```sql
  alter table design_proofs enable row level security;
  alter table design_proof_versions enable row level security;
  alter table design_proof_approvals enable row level security;
  alter table proof_catalogue_links enable row level security;

  create policy design_proofs_customer_read on design_proofs
    for select to authenticated
    using (
      status in ('approved','superseded')
      and organization_id in (
        select organization_id from user_organizations where user_id = auth.uid()
      )
    );
  -- Versions follow proof visibility:
  create policy design_proof_versions_customer_read on design_proof_versions
    for select to authenticated
    using (proof_id in (select id from design_proofs));
  -- Approvals: same
  create policy design_proof_approvals_customer_read on design_proof_approvals
    for select to authenticated
    using (version_id in (select id from design_proof_versions));
  -- Catalogue links: needed for PDP gallery — readable for any user whose org owns the catalogue
  create policy proof_catalogue_links_customer_read on proof_catalogue_links
    for select to authenticated
    using (catalogue_item_id in (
      select bci.id from b2b_catalogue_items bci
      join b2b_catalogues bc on bc.id = bci.catalogue_id
      where bc.organization_id in (
        select organization_id from user_organizations where user_id = auth.uid()
      )
    ));
  ```
- Staff writes via service role; RLS not applicable.

## 9. PDP gallery resolution (the catalogue-images promise)

In `print-room-portal/app/(portal)/shop/[productId]/page.tsx`, the existing flow resolves the catalogue item; we add one query before image fetch:

```ts
// After catalogueItemId is resolved
const { data: linkedImages } = await admin
  .from('proof_catalogue_links')
  .select('design_index, view_type, sort_order, is_primary, design_proofs!inner(id, current_version_id)')
  .eq('catalogue_item_id', catalogueItemId)
  .order('is_primary', { ascending: false })
  .order('sort_order', { ascending: true })

// For each link, look up snapshot_data on the linked version, pluck the matching design's
// public mockup URLs (front/back/...). Fall back to master product_images if zero links.
```

The "promote to public bucket" step happens once at link-creation time (`POST /api/proof-catalogue-links`), so the customer query is a single indexed table lookup + a JSON path on `snapshot_data` — bound by # of links per item (typically ≤ 4).

## 10. The "build for B2B customer" entry mode in the design-tool

The existing `(staff-quote)` route group treats every flow the same as customer. We introduce a forking entry:

- `/staff-quote/proof/new` — staff selects org + names the proof. Creates a draft `design_proofs` row. Redirects to `/staff-quote/proof/[proofId]/builder`.
- The builder page is a thin wrapper around the existing `ProductCustomizer` / `DesignPage` components, with extra context:
  - "You are building proof: <name> for <org>" header
  - Add/remove design slots
  - Each design has a "garment applications" section where staff add product variants the design appears on
  - Per-application: print-area picker, dimensions input, method selector, Pantone codes input
  - "Save snapshot & preview" → goes to `/staff-quote/proof/[proofId]/preview` showing the would-be PDF
  - "Send for approval" → triggers send flow
- The existing `/staff-quote/design/[productId]/[instanceId]` flow continues to handle the simpler "staff places one quote on behalf of one customer" path. The proof flow is additive.

## 11. 4-axis stack rationale (per `feedback_web_project_pre_plan_strategy.md`)

- **Rendering:** server components for the dashboard list + read-heavy detail screens; client components for the builder canvas (already client; no change). Proof PDF rendering is server-side puppeteer. Customer approval page is SSR (token resolved at render time, no client auth state needed).
- **Caching:** `design-proofs` storage bucket is private; signed URLs minted at PDF render time, 7-day TTL. The customer approval page is `dynamic = 'force-dynamic'` (per-token rendering). PDP gallery's `proof_catalogue_links` query is per-request, not cached at CDN — same pattern as the rest of `/shop`. Customer archive list page is `dynamic` for the same reason (auth-scoped reads).
- **Performance:** the heavy operation is PDF render (~5–15 s for a 13-design proof). Runs server-side in a queued route; UI shows progress. Mockup pre-rendering happens at builder save-time (≤ 30 s for the largest proofs). PDP gallery picks up linked images from `snapshot_data.designs[].garment_applications[].mockup_paths` — same JSON-path cost as a single column read.
- **Ecommerce pattern:** proofs are immutable historical documents (not product configurations). Snapshot pattern ensures product/variant rename never invalidates a proof. Proof-to-catalogue link is the join that bridges historical proof to live catalogue. Approval is a side-channel (no login required) to remove friction from the customer signing step.

## 12. Decisions made

| # | Decision | Locked answer |
|---|---|---|
| 1 | D-tier | D3 (full workflow + revision + customer archive + B2B entry mode) |
| 2 | Tables | 4 new (`design_proofs`, `design_proof_versions`, `design_proof_approvals`, `proof_catalogue_links`); plus FK back from `design_proofs.current_version_id` |
| 3 | Design-to-garment cardinality | One design → many garment applications (matches Allpress proof) |
| 4 | Snapshot strategy | `snapshot_data jsonb` on each version — immutable, point-in-time, survives master rename |
| 5 | PDF generation | Puppeteer HTML→PDF (NOT pdf-lib) |
| 6 | Mockup rendering | Puppeteer screenshots of design-tool canvas, pre-rendered at builder save |
| 7 | Customer approval auth | Signed JWT in URL, no Supabase session, 7-day TTL, rate-limited |
| 8 | Storage | Supabase bucket `design-proofs`, private; PDP-promoted mockups copied to public `b2b-catalogue-images` bucket |
| 9 | Change-order fee | $35 default on v2+, staff can override; informational in v1 (no Xero auto-charge) |
| 10 | Permissions | `proofs:write` permission key (staff); RLS reads scoped to user's `user_organizations` |
| 11 | Repo split | design-tool owns builder + PDF + approval page; staff-portal reads proofs into the catalogue editor; customer-portal hosts the archive + PDP image resolution |
| 12 | Relationship to `staff_quotes` | Separate. Approved proof can be linked to a staff_quote when one is created, but they have independent lifecycles |
| 13 | Customer-side editing | Out of scope — customers approve or request changes (text), they don't manipulate the design |
| 14 | Historical proof migration | Out of scope — start fresh |

## 13. Migration & rollout plan

1. **Phase 1 (D3-α):** ship Sections 5 (schema) + 7 (PDF generation) + 8 (auth) + 10 (B2B entry mode). Internal-only. Account managers build a few proofs; we validate the snapshot shape and PDF template against a real proof comparison.
2. **Phase 2 (D3-β):** ship customer approval flow (Sections 6, 8.2). Send the first real proof to one cooperative customer (Allpress is the obvious candidate given the reference PDF). Approval signs into `design_proof_approvals`.
3. **Phase 3 (D3-v1):** ship `proof_catalogue_links` + PDP gallery resolution + customer archive. PDP starts showing approved mockups for orgs with linked proofs. Catalogue editor's "Linked proofs" sub-tab.
4. **Phase 4 (D3-v1.1):** revision flow + change-order fee surfacing. v2 of an existing proof gets a $35 line on the cover.

Each phase commits independently; each has a SQL gate. Phase boundaries are natural review checkpoints.

**Status:** Phase 1 shipped 2026-04-28. Migration files at design-tool/supabase/migrations/create-design-proofs-tables.sql / create-design-proof-approvals-links.sql / create-design-proofs-storage.sql. Builder routes at /staff-quote/proof/{new,[id]/builder,[id]/preview}. PDF render via puppeteer + /internal/proof-html/[versionId].

## 14. Verification

- A staff user with `proofs:write` can create a draft proof for the PRT test org from `/staff-quote/proof/new`, add 2 designs spanning 3 product variants each, set print areas + Pantones, save, preview as PDF.
- Sending the proof emails the customer with a unique signed-link URL. The URL renders the PDF + sign form. Submitting an approval moves status to `approved`; refresh shows the approved state, sign date, and signer name.
- A version 2 created after `changes_requested` carries a $35 change-order fee on its cover by default; staff can clear it.
- Linking the approved proof's design 1 to a `b2b_catalogue_items` row via the catalogue editor's Linked-proofs sub-tab makes the PDP for that catalogue item show the proof's mockup as the primary image; clearing the link reverts to master images.
- A non-org customer cannot see the proof in `/proofs` (RLS); a staff user can see all proofs at `/proofs` regardless of org (service role).
- An expired token returns a 410 with a "request a new link" CTA.
- A second device opening the same token within rate limits succeeds; the 61st view in the same hour is rate-limited (429).

## 15. Dependencies & follow-ups

- **Consumes existing schema:** `organizations`, `user_organizations`, `b2b_catalogue_items`, `products`, `product_variants`.
- **Consumes existing design-tool primitives:** `ConsistentProductViewer`, `ProductCustomizer`, `DesignPage`, `MethodCard`, `PrintAreaSelector`, `verify-staff-token`, `invoice-generator.ts` patterns.
- **Pairs with sub-app #3:** PDP query already does catalogue-scope check; this spec extends it for image resolution only. No backwards-incompatible change.
- **Pairs with sub-app #4 (CSR):** approved proof can be referenced from a CSR-built B2B order. The CSR flow consumes the proof's product/variant references; this is a follow-up wiring step, not part of D3-v1.
- **v1.1 follow-ups:**
  - Auto-charge $35 change-order fee via Xero
  - Customer-side comment threads on each design (instead of just a single notes field)
  - Public-bucket → signed-URL migration if a customer raises confidentiality
  - Templates: "save this design as a starting template" for repeat-customer onboarding
  - Approval audit trail surfaced in the customer archive

## 16. Open questions

- Q1 — should the approval page accept a typed signature (current spec) or a drawn signature (canvas)? Typed is simpler and matches the existing PDF template's signature line. Drawn is more "real" but adds a canvas dependency on the customer page. Default: typed.
- Q2 — the proof PDF cover lists "Prepared by" as a single staff member. Should that always be the proof's `created_by_user_id`, or can it be overridden? Default: `created_by_user_id`'s display name; staff can override per-proof.
- Q3 — when a proof is `superseded`, should the customer archive show it or hide it? Default: show, with a "superseded by v2" badge so customers can see the history.
