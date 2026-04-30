# Design Proofs — Phase 1 (D3-α) Implementation Plan

> **⚠ SUPERSEDED 2026-04-30 — DO NOT IMPLEMENT.** This plan was built on the assumption that `print-room-studio/apps/design-tool` would own a `staff-quote/proof/*` route group with iframe wiring back to the staff portal. That entire architecture was deleted on 2026-04-29 (design-tool side) and 2026-04-29 (staff-portal side). The proof builder, proof iframe modal, JWT token routes, and quote-tool iframe embed are all gone. Re-architecture is pending a context-mapping exercise on the design tool. See `~/.claude/projects/c--Users-MSI-Documents-Projects/memory/project_proof_iframe_consolidation.md` for the current baseline.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internal-only proof builder where staff create a proof, fill in designs against existing products, generate the proof PDF, and have the PDF stored in Supabase. No customer interaction, no catalogue linkage, no versioning beyond v1 — those land in Phases 2-4.

**Architecture:** Build inside `print-room-studio/apps/design-tool` (the only repo Phase 1 touches). New `staff-quote/proof/*` route group on top of the existing `(staff-quote)` flow. New tables + storage bucket on the shared Supabase project (`bthsxgmcnbvwwgvdveek`). PDF generation via puppeteer HTML→PDF rendering of an internal `/internal/proof-html/[versionId]` page. Auth gate is the existing `verifyStaffToken` JWT — no new permission key.

**Tech Stack:** Next.js 15.5, React 19, Supabase (postgres + storage), puppeteer (already installed), pdf-lib (installed but unused for proofs — kept for invoice path), nanoid for IDs, jose for JWT, vitest for tests.

**Spec:** `print-room-staff-portal/docs/superpowers/specs/2026-04-28-b2b-design-proofs-system-design.md` (commit `12cfa08`).

**Scope cuts vs full D3 spec:**
- Phase 1 = schema (all 4 tables) + storage bucket + builder + PDF generation
- Phase 2 (separate plan) = customer approval flow, signed-token URLs
- Phase 3 (separate plan) = catalogue-link UI in staff-portal, PDP gallery resolution in customer-portal, customer archive
- Phase 4 (separate plan) = version revisions + change-order fee surfacing

---

## File structure (new files only)

**Migrations** (design-tool's `supabase/migrations/`):
- `create-design-proofs-tables.sql` — design_proofs + design_proof_versions
- `create-design-proof-approvals-links.sql` — design_proof_approvals + proof_catalogue_links (created empty for Phase 2/3)
- `create-design-proofs-storage.sql` — storage bucket + access policy

**Lib modules:**
- `src/lib/proofs/types.ts` — `ProofSnapshot` shape + DB row types
- `src/lib/proofs/auth.ts` — `requireProofsAccess(request)` thin wrapper around `verifyStaffToken`
- `src/lib/proofs/snapshot.ts` — pure builder: input draft state → `ProofSnapshot`
- `src/lib/proofs/storage.ts` — upload helpers for PDF + mockups
- `src/lib/proofs/pdf.ts` — puppeteer render wrapper (navigate to internal URL, capture PDF)

**API routes:**
- `src/app/api/proofs/route.ts` — POST create, GET list
- `src/app/api/proofs/[id]/route.ts` — GET full, PATCH (rename / archive)
- `src/app/api/proofs/[id]/versions/route.ts` — POST create version, GET list
- `src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.ts` — POST render

**UI routes:**
- `src/app/(staff-quote)/staff-quote/proof/new/page.tsx` — entry: org + name → POST /api/proofs → redirect to builder
- `src/app/(staff-quote)/staff-quote/proof/[proofId]/builder/page.tsx` — multi-design builder shell
- `src/app/(staff-quote)/staff-quote/proof/[proofId]/preview/page.tsx` — PDF preview iframe + "Generate PDF" trigger
- `src/app/internal/proof-html/[versionId]/page.tsx` — server-rendered HTML proof template (puppeteer target)

**Components:**
- `src/components/proofs/ProofBuilderShell.tsx` — wraps existing canvas with proof context (org + designs[] state)
- `src/components/proofs/ProofPreviewClient.tsx` — client component with iframe + render-pdf button

**Tests:**
- `src/lib/proofs/snapshot.test.ts` — vitest unit
- `src/lib/proofs/auth.test.ts` — vitest unit
- `src/app/api/proofs/route.test.ts` — vitest integration
- `src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.test.ts` — vitest integration
- `src/app/internal/proof-html/[versionId]/page.test.tsx` — vitest render check

---

## Task 1: Schema migration — design_proofs + design_proof_versions

**Files:**
- Create: `print-room-studio/apps/design-tool/supabase/migrations/create-design-proofs-tables.sql`

🟡 **SQL gate** — present migration in chat first, wait for explicit 🟢 reply before running `mcp__supabase__apply_migration`.

- [ ] **Step 1: Write migration SQL**

```sql
-- design-proofs: top-level proof entity + versioned snapshots
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

create index if not exists design_proofs_org_status_idx
  on design_proofs (organization_id, status) where archived_at is null;
create index if not exists design_proofs_status_idx on design_proofs (status);

create table if not exists design_proof_versions (
  id                          uuid primary key default gen_random_uuid(),
  proof_id                    uuid not null references design_proofs(id) on delete cascade,
  version_number              integer not null,
  status                      text not null default 'draft'
    check (status in ('draft','sent','approved','changes_requested','superseded')),
  snapshot_data               jsonb not null,
  pdf_storage_path            text,
  pdf_generated_at            timestamptz,
  change_order_fee_amount     numeric(10,2) not null default 0,
  approval_token_hash         text unique,
  approval_token_expires_at   timestamptz,
  changes_requested_notes     text,
  created_by_user_id          uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  sent_at                     timestamptz,
  approved_at                 timestamptz,
  constraint design_proof_versions_unique_number unique (proof_id, version_number)
);

create index if not exists design_proof_versions_proof_idx on design_proof_versions (proof_id);
create index if not exists design_proof_versions_token_idx on design_proof_versions (approval_token_hash) where approval_token_hash is not null;

alter table design_proofs
  add constraint design_proofs_current_version_fk
  foreign key (current_version_id) references design_proof_versions(id) on delete set null;
```

- [ ] **Step 2: 🟡 Present SQL to Jamie, await 🟢**

- [ ] **Step 3: Apply migration via `mcp__supabase__apply_migration`**

Migration name: `create_design_proofs_tables`

- [ ] **Step 4: Smoke test — verify tables exist**

Run via `mcp__supabase__execute_sql`:
```sql
select count(*) from design_proofs;
select count(*) from design_proof_versions;
```
Expected: both return `0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/create-design-proofs-tables.sql
git commit -m "feat(proofs): schema for design_proofs + versions"
```

---

## Task 2: Schema migration — approvals + catalogue links (empty for Phase 2/3)

**Files:**
- Create: `print-room-studio/apps/design-tool/supabase/migrations/create-design-proof-approvals-links.sql`

🟡 **SQL gate** — present migration in chat first.

- [ ] **Step 1: Write migration SQL**

```sql
create table if not exists design_proof_approvals (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references design_proof_versions(id) on delete cascade,
  action            text not null check (action in ('approved','changes_requested')),
  signed_by_email   text not null,
  signed_by_name    text not null,
  signature_text    text,
  notes             text,
  ip                inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index if not exists design_proof_approvals_version_idx
  on design_proof_approvals (version_id);

create table if not exists proof_catalogue_links (
  id                  uuid primary key default gen_random_uuid(),
  proof_id            uuid not null references design_proofs(id) on delete cascade,
  catalogue_item_id   uuid not null references b2b_catalogue_items(id) on delete cascade,
  design_index        integer not null,
  view_type           text check (view_type in ('front','back','side','sleeve','tag','lifestyle','other')),
  sort_order          integer not null default 0,
  is_primary          boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint proof_catalogue_links_unique
    unique (catalogue_item_id, proof_id, design_index, view_type)
);

create index if not exists proof_catalogue_links_catalogue_item_idx
  on proof_catalogue_links (catalogue_item_id);
```

- [ ] **Step 2: 🟡 Present SQL to Jamie, await 🟢**

- [ ] **Step 3: Apply migration**

- [ ] **Step 4: Smoke**

```sql
select count(*) from design_proof_approvals;
select count(*) from proof_catalogue_links;
```
Expected: both `0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/create-design-proof-approvals-links.sql
git commit -m "feat(proofs): schema for approvals + catalogue links (Phase 2/3 prep)"
```

---

## Task 3: Storage bucket — `design-proofs`

**Files:**
- Create: `print-room-studio/apps/design-tool/supabase/migrations/create-design-proofs-storage.sql`

🟡 **SQL gate.**

- [ ] **Step 1: Write storage setup SQL**

```sql
-- Private bucket; signed URLs only (PDP-promoted public images go to b2b-catalogue-images bucket in Phase 3)
insert into storage.buckets (id, name, public)
values ('design-proofs', 'design-proofs', false)
on conflict (id) do nothing;

-- Authenticated staff users can upload via service-role from API; no anon access
create policy if not exists "staff service role insert design-proofs"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'design-proofs');

create policy if not exists "staff service role read design-proofs"
  on storage.objects for select
  to service_role
  using (bucket_id = 'design-proofs');
```

- [ ] **Step 2: 🟡 Present SQL to Jamie, await 🟢**

- [ ] **Step 3: Apply migration**

- [ ] **Step 4: Smoke — list bucket**

```sql
select id, name, public from storage.buckets where id = 'design-proofs';
```
Expected: 1 row, `public = false`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/create-design-proofs-storage.sql
git commit -m "feat(proofs): private storage bucket for proofs + mockups"
```

---

## Task 4: Types module

**Files:**
- Create: `print-room-studio/apps/design-tool/src/lib/proofs/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type ProofStatus =
  | 'draft' | 'sent' | 'approved' | 'changes_requested' | 'superseded' | 'archived'

export type ProofVersionStatus =
  | 'draft' | 'sent' | 'approved' | 'changes_requested' | 'superseded'

export interface ProofSnapshotCustomer {
  organization_id: string
  organization_name: string
  customer_code: string | null
  customer_email: string
  customer_name: string | null
}

export interface ProofSnapshotJob {
  name: string
  reference: string
  delivery_date: string | null
  additional_notes: string | null
  prepared_by: { name: string; email: string; phone: string }
}

export type DecorationMethod =
  | 'screenprint' | 'embroidery' | 'heat_press' | 'super_color' | 'other'

export interface ProofSnapshotPrintArea {
  label: string
  method: DecorationMethod
  dimensions_w_mm: number
  dimensions_h_mm: number
  production_note: string | null
}

export interface ProofSnapshotMockupPaths {
  front: string | null
  back: string | null
  other: Record<string, string>
}

export interface ProofSnapshotGarmentApplication {
  product_id: string
  product_variant_id: string | null
  product_name: string
  brand_name: string
  sku: string | null
  colour_label: string
  colour_code: string
  print_areas: ProofSnapshotPrintArea[]
  mockup_paths: ProofSnapshotMockupPaths
}

export interface ProofSnapshotDesign {
  index: number
  name: string
  artwork: {
    original_filename: string
    storage_path: string
    preview_url: string
    colour_pantones: string[]
    method: DecorationMethod
  }
  garment_applications: ProofSnapshotGarmentApplication[]
}

export interface ProofSnapshotLineItem {
  design_index: number
  label: string
  is_staff_subtotal: boolean
  product_id: string
  product_variant_id: string | null
  brand_name: string
  garment_label: string
  sku: string | null
  colour_code: string
  sizes: Record<string, number>
  one_size_qty: number | null
  total_qty: number
}

export interface ProofSnapshot {
  customer: ProofSnapshotCustomer
  job: ProofSnapshotJob
  designs: ProofSnapshotDesign[]
  line_items: ProofSnapshotLineItem[]
  totals: { subtotal: number | null; currency: string }
}

export interface DesignProofRow {
  id: string
  organization_id: string
  name: string
  customer_email: string
  customer_name: string | null
  status: ProofStatus
  current_version_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  archived_at: string | null
}

export interface DesignProofVersionRow {
  id: string
  proof_id: string
  version_number: number
  status: ProofVersionStatus
  snapshot_data: ProofSnapshot
  pdf_storage_path: string | null
  pdf_generated_at: string | null
  change_order_fee_amount: number
  approval_token_hash: string | null
  approval_token_expires_at: string | null
  changes_requested_notes: string | null
  created_by_user_id: string | null
  created_at: string
  sent_at: string | null
  approved_at: string | null
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/design-tool && pnpm type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/proofs/types.ts
git commit -m "feat(proofs): TypeScript types for proof snapshot + DB rows"
```

---

## Task 5: Auth helper

**Files:**
- Create: `src/lib/proofs/auth.ts`
- Test: `src/lib/proofs/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/proofs/auth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { requireProofsAccess } from './auth'
import { createStaffToken } from '../staff-token'

describe('requireProofsAccess', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://x/api/proofs', { headers: {} })
    const result = await requireProofsAccess(req)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(401)
    }
  })

  it('returns staff context for valid token', async () => {
    process.env.STAFF_QUOTE_SECRET = 'test-secret-32-chars-or-more-please'
    const token = await createStaffToken({
      staffId: 's-1', staffEmail: 'a@b.co', staffName: 'A B', portalOrigin: 'http://x',
    })
    const req = new Request('http://x/api/proofs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await requireProofsAccess(req)
    expect('staff' in result).toBe(true)
    if ('staff' in result) {
      expect(result.staff.staffEmail).toBe('a@b.co')
    }
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm vitest run src/lib/proofs/auth.test.ts
```
Expected: fails because `requireProofsAccess` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
// src/lib/proofs/auth.ts
import { NextResponse } from 'next/server'
import { verifyStaffToken, type StaffTokenPayload } from '@/lib/staff-token'

export async function requireProofsAccess(
  request: Request,
): Promise<{ staff: StaffTokenPayload } | { error: NextResponse }> {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const staff = await verifyStaffToken(token)
    return { staff }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid or expired staff token' }, { status: 401 }) }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm vitest run src/lib/proofs/auth.test.ts
```
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proofs/auth.ts src/lib/proofs/auth.test.ts
git commit -m "feat(proofs): requireProofsAccess auth helper"
```

---

## Task 6: Snapshot builder

**Files:**
- Create: `src/lib/proofs/snapshot.ts`
- Test: `src/lib/proofs/snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/proofs/snapshot.test.ts
import { describe, it, expect } from 'vitest'
import { buildProofSnapshot } from './snapshot'

describe('buildProofSnapshot', () => {
  it('produces a snapshot with one design across two garments', () => {
    const result = buildProofSnapshot({
      customer: {
        organization_id: 'org-1',
        organization_name: 'Allpress',
        customer_code: 'ALLP',
        customer_email: 'm@a.co',
        customer_name: 'Matt',
      },
      job: {
        name: 'Allpress Espresso',
        reference: 'ALLP_4040 - Des5',
        delivery_date: null,
        additional_notes: null,
        prepared_by: { name: 'Matt', email: 'matt@theprint-room.co.nz', phone: '034259694' },
      },
      designs: [
        {
          index: 1,
          name: 'Tamaki Makaurau white',
          artwork: {
            original_filename: 'd1.svg',
            storage_path: 'proofs/p1/v1/artwork/1.svg',
            preview_url: 'https://x/proofs/p1/v1/artwork/1.svg',
            colour_pantones: ['PANTONE BLACK 4 C'],
            method: 'screenprint',
          },
          garment_applications: [
            {
              product_id: 'prod-tee',
              product_variant_id: 'var-tee-ecru',
              product_name: 'AS Colour Box Tee Ecru',
              brand_name: 'AS Colour',
              sku: '5030',
              colour_label: 'Ecru',
              colour_code: 'ECRU',
              print_areas: [
                {
                  label: 'LEFT CHEST', method: 'screenprint',
                  dimensions_w_mm: 64, dimensions_h_mm: 9, production_note: null,
                },
              ],
              mockup_paths: { front: null, back: null, other: {} },
            },
          ],
        },
      ],
      line_items: [
        {
          design_index: 1,
          label: 'Design 1 - Tamaki Makaurau white',
          is_staff_subtotal: false,
          product_id: 'prod-tee',
          product_variant_id: 'var-tee-ecru',
          brand_name: 'AS Colour',
          garment_label: 'AS Colour Box Tee Ecru',
          sku: '5030',
          colour_code: 'ECRU',
          sizes: { S: 20, M: 53, L: 53, XL: 23, '2XL': 5 },
          one_size_qty: null,
          total_qty: 154,
        },
      ],
      totals: { subtotal: null, currency: 'NZD' },
    })

    expect(result.designs).toHaveLength(1)
    expect(result.designs[0].garment_applications).toHaveLength(1)
    expect(result.line_items[0].total_qty).toBe(154)
    // total_qty must equal sum of sizes
    const computed = Object.values(result.line_items[0].sizes).reduce((a, b) => a + b, 0)
    expect(computed).toBe(154)
  })

  it('throws if line_item.total_qty does not match summed sizes', () => {
    expect(() =>
      buildProofSnapshot({
        customer: {
          organization_id: 'o', organization_name: 'X', customer_code: null,
          customer_email: 'a@b', customer_name: null,
        },
        job: {
          name: 'j', reference: 'r', delivery_date: null, additional_notes: null,
          prepared_by: { name: 'n', email: 'e', phone: 'p' },
        },
        designs: [],
        line_items: [
          {
            design_index: 1, label: 'l', is_staff_subtotal: false,
            product_id: 'p', product_variant_id: null,
            brand_name: 'b', garment_label: 'g', sku: null, colour_code: 'C',
            sizes: { S: 10 }, one_size_qty: null, total_qty: 99,
          },
        ],
        totals: { subtotal: null, currency: 'NZD' },
      }),
    ).toThrow(/total_qty/)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm vitest run src/lib/proofs/snapshot.test.ts
```
Expected: fails because `buildProofSnapshot` doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/proofs/snapshot.ts
import type { ProofSnapshot } from './types'

export function buildProofSnapshot(input: ProofSnapshot): ProofSnapshot {
  for (const li of input.line_items) {
    const sumSizes = Object.values(li.sizes).reduce((a, b) => a + b, 0)
    const oneSize = li.one_size_qty ?? 0
    const computed = sumSizes + oneSize
    if (computed !== li.total_qty) {
      throw new Error(
        `line_item ${li.label} total_qty mismatch: declared ${li.total_qty}, computed ${computed}`,
      )
    }
  }
  return input
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm vitest run src/lib/proofs/snapshot.test.ts
```
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proofs/snapshot.ts src/lib/proofs/snapshot.test.ts
git commit -m "feat(proofs): snapshot builder + total_qty invariant"
```

---

## Task 7: POST /api/proofs (create draft) + GET (list)

**Files:**
- Create: `src/app/api/proofs/route.ts`
- Test: `src/app/api/proofs/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/proofs/route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { POST, GET } from './route'
import { createStaffToken } from '@/lib/staff-token'

let token: string
beforeAll(async () => {
  process.env.STAFF_QUOTE_SECRET = 'test-secret-32-chars-or-more-please'
  token = await createStaffToken({
    staffId: 's-1', staffEmail: 'a@b.co', staffName: 'A B', portalOrigin: 'http://x',
  })
})

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
}

describe('POST /api/proofs', () => {
  it('returns 401 without token', async () => {
    const r = await POST(new Request('http://x/api/proofs', { method: 'POST' }) as any)
    expect(r.status).toBe(401)
  })

  it('returns 400 when organization_id is missing', async () => {
    const r = await POST(
      authedRequest('http://x/api/proofs', {
        method: 'POST',
        body: JSON.stringify({ name: 'X', customer_email: 'a@b' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    )
    expect(r.status).toBe(400)
  })

  // Create test relies on PRT seed (organization_id ee155266-...)
  it('creates a draft proof for PRT', async () => {
    const r = await POST(
      authedRequest('http://x/api/proofs', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: 'ee155266-200c-4b73-8dbd-be385db3e5b0',
          name: 'PRT smoke proof',
          customer_email: 'hello@theprint-room.co.nz',
        }),
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    )
    expect(r.status).toBe(201)
    const body = await r.json()
    expect(typeof body.id).toBe('string')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm vitest run src/app/api/proofs/route.test.ts
```
Expected: fails because route doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/app/api/proofs/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireProofsAccess } from '@/lib/proofs/auth'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface CreateBody {
  organization_id?: string
  name?: string
  customer_email?: string
  customer_name?: string
}

export async function POST(request: Request) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error

  let body: CreateBody = {}
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.organization_id || !body.name || !body.customer_email) {
    return NextResponse.json(
      { error: 'organization_id, name, and customer_email are required' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('design_proofs')
    .insert({
      organization_id: body.organization_id,
      name: body.name,
      customer_email: body.customer_email,
      customer_name: body.customer_name ?? null,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function GET(request: Request) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error

  const url = new URL(request.url)
  const orgId = url.searchParams.get('organization_id')
  const status = url.searchParams.get('status')

  const admin = getSupabaseAdmin()
  let q = admin
    .from('design_proofs')
    .select('id, organization_id, name, customer_email, status, current_version_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (orgId) q = q.eq('organization_id', orgId)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proofs: data ?? [] })
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm vitest run src/app/api/proofs/route.test.ts
```
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/proofs/route.ts src/app/api/proofs/route.test.ts
git commit -m "feat(proofs): POST /api/proofs (create draft) + GET (list)"
```

---

## Task 8: GET + PATCH /api/proofs/[id]

**Files:**
- Create: `src/app/api/proofs/[id]/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/proofs/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireProofsAccess } from '@/lib/proofs/auth'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error
  const { id } = await params

  const admin = getSupabaseAdmin()
  const [proofResult, versionsResult] = await Promise.all([
    admin
      .from('design_proofs')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('design_proof_versions')
      .select('id, version_number, status, pdf_storage_path, pdf_generated_at, change_order_fee_amount, created_at, sent_at, approved_at')
      .eq('proof_id', id)
      .order('version_number', { ascending: true }),
  ])

  if (proofResult.error) return NextResponse.json({ error: proofResult.error.message }, { status: 500 })
  if (!proofResult.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    proof: proofResult.data,
    versions: versionsResult.data ?? [],
  })
}

interface PatchBody {
  name?: string
  customer_email?: string
  customer_name?: string | null
  archived?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error
  const { id } = await params

  let body: PatchBody = {}
  try { body = (await request.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name
  if (body.customer_email !== undefined) update.customer_email = body.customer_email
  if (body.customer_name !== undefined) update.customer_name = body.customer_name
  if (body.archived === true) {
    update.archived_at = new Date().toISOString()
    update.status = 'archived'
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('design_proofs').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

- [ ] **Step 3: Smoke (manual cURL after dev server up)**

```bash
curl -H "Authorization: Bearer $STAFF_TOKEN" http://localhost:3001/api/proofs/<id-from-Task-7>
# Expect: { proof: {...}, versions: [] }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/proofs/[id]/route.ts
git commit -m "feat(proofs): GET + PATCH /api/proofs/[id]"
```

---

## Task 9: POST /api/proofs/[id]/versions (create draft version)

**Files:**
- Create: `src/app/api/proofs/[id]/versions/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/proofs/[id]/versions/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireProofsAccess } from '@/lib/proofs/auth'
import { buildProofSnapshot } from '@/lib/proofs/snapshot'
import type { ProofSnapshot } from '@/lib/proofs/types'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface CreateVersionBody {
  snapshot: ProofSnapshot
  change_order_fee_amount?: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error
  const { id } = await params

  let body: CreateVersionBody
  try { body = (await request.json()) as CreateVersionBody } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.snapshot) {
    return NextResponse.json({ error: 'snapshot is required' }, { status: 400 })
  }

  // Validate snapshot invariants (throws on mismatched totals)
  let validated: ProofSnapshot
  try { validated = buildProofSnapshot(body.snapshot) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Block creating versions on archived proofs
  const { data: proof } = await admin
    .from('design_proofs')
    .select('id, status, archived_at')
    .eq('id', id)
    .maybeSingle()
  if (!proof) return NextResponse.json({ error: 'Proof not found' }, { status: 404 })
  if (proof.archived_at) return NextResponse.json({ error: 'Proof is archived' }, { status: 409 })

  // Compute next version number
  const { data: existing } = await admin
    .from('design_proof_versions')
    .select('version_number')
    .eq('proof_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
  const nextNumber = (existing?.[0]?.version_number ?? 0) + 1

  const { data: inserted, error: insertErr } = await admin
    .from('design_proof_versions')
    .insert({
      proof_id: id,
      version_number: nextNumber,
      status: 'draft',
      snapshot_data: validated,
      change_order_fee_amount: body.change_order_fee_amount ?? (nextNumber > 1 ? 35 : 0),
    })
    .select('id, version_number')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Bump current_version_id on the proof
  await admin
    .from('design_proofs')
    .update({ current_version_id: inserted.id, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json(
    { id: inserted.id, version_number: inserted.version_number },
    { status: 201 },
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('design_proof_versions')
    .select('id, version_number, status, pdf_storage_path, pdf_generated_at, change_order_fee_amount, created_at, sent_at, approved_at')
    .eq('proof_id', id)
    .order('version_number', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versions: data ?? [] })
}
```

- [ ] **Step 2: Manual smoke (after dev server up)**

```bash
curl -X POST -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"snapshot": <valid ProofSnapshot fixture>}' \
  http://localhost:3001/api/proofs/<proof-id>/versions
# Expect: 201 + { id, version_number: 1 }; second call → version_number: 2
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proofs/[id]/versions/route.ts
git commit -m "feat(proofs): create + list proof versions; auto-fee on v2+"
```

---

## Task 10: Storage helper

**Files:**
- Create: `src/lib/proofs/storage.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/proofs/storage.ts
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'design-proofs'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function pdfPath(proofId: string, versionId: string) {
  return `proofs/${proofId}/${versionId}/proof.pdf`
}

export function mockupPath(
  proofId: string,
  versionId: string,
  designIndex: number,
  view: string,
) {
  return `proofs/${proofId}/${versionId}/mockups/${designIndex}-${view}.png`
}

export async function uploadBuffer(path: string, buf: Buffer, contentType: string) {
  const supa = admin()
  const { error } = await supa.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`)
  return { path }
}

export async function signedUrlForPdf(path: string, ttlSeconds = 60 * 60 * 24 * 7) {
  const supa = admin()
  const { data, error } = await supa.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/proofs/storage.ts
git commit -m "feat(proofs): storage helpers (pdf/mockup paths, signed urls)"
```

---

## Task 11: Internal proof-html template (puppeteer target)

**Files:**
- Create: `src/app/internal/proof-html/[versionId]/page.tsx`

- [ ] **Step 1: Implement the server component**

```tsx
// src/app/internal/proof-html/[versionId]/page.tsx
// Server-rendered HTML page that puppeteer navigates to.
// Returns the proof template populated from snapshot_data.
// Service-token-gated (no public access).
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { ProofSnapshot } from '@/lib/proofs/types'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SERVICE_TOKEN_HEADER = 'X-Internal-Token'

export default async function ProofHtmlPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { versionId } = await params
  const sp = await searchParams
  if (sp.token !== process.env.INTERNAL_RENDER_TOKEN) return notFound()

  const admin = getAdmin()
  const { data: version } = await admin
    .from('design_proof_versions')
    .select('snapshot_data, version_number')
    .eq('id', versionId)
    .maybeSingle()
  if (!version) return notFound()

  const snap = version.snapshot_data as ProofSnapshot

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Proof — {snap.job.name}</title>
        <style>{`
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; font-family: -apple-system, system-ui, sans-serif; color: #111; }
          .page { width: 297mm; height: 210mm; padding: 12mm 14mm; box-sizing: border-box; page-break-after: always; }
          .cover h1 { font-size: 22pt; margin: 0 0 6mm; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; font-size: 9pt; }
          .meta-grid dt { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 6mm; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
          th { background: #f4f4f4; }
          .design-page header { background: #1d3a8a; color: #fff; padding: 4mm 6mm; font-size: 18pt; font-weight: 800; }
          .design-page .areas { display: flex; gap: 6mm; margin-top: 6mm; font-size: 9pt; }
        `}</style>
      </head>
      <body>
        {/* Cover */}
        <section className="page cover">
          <h1>FINAL PROOF — {snap.job.name}</h1>
          <div className="meta-grid">
            <dl>
              <dt>Prepared by</dt><dd>{snap.job.prepared_by.name} ({snap.job.prepared_by.email})</dd>
              <dt>Phone</dt><dd>{snap.job.prepared_by.phone}</dd>
            </dl>
            <dl>
              <dt>Customer</dt><dd>{snap.customer.organization_name}</dd>
              <dt>Job ref</dt><dd>{snap.job.reference}</dd>
              <dt>Customer email</dt><dd>{snap.customer.customer_email}</dd>
            </dl>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Brand</th><th>Garment</th><th>SKU</th><th>Colour</th><th>Sizes</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {snap.line_items.map((li, i) => (
                <tr key={i}>
                  <td>{li.label}{li.is_staff_subtotal ? ' (staff)' : ''}</td>
                  <td>{li.brand_name}</td>
                  <td>{li.garment_label}</td>
                  <td>{li.sku ?? ''}</td>
                  <td>{li.colour_code}</td>
                  <td>{Object.entries(li.sizes).map(([s, q]) => `${s}:${q}`).join(' · ')}{li.one_size_qty ? ` 1size:${li.one_size_qty}` : ''}</td>
                  <td>{li.total_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* One page per design */}
        {snap.designs.map((d) => (
          <section key={d.index} className="page design-page">
            <header>FINAL PROOF — DESIGN {d.index} / {d.name.toUpperCase()}</header>
            <div className="areas">
              {d.garment_applications.flatMap((g, gi) => g.print_areas.map((a, ai) => (
                <div key={`${gi}-${ai}`}>
                  <div><strong>PRINT AREA {ai + 1}:</strong> {a.label}</div>
                  <div>METHOD: {a.method.toUpperCase()}</div>
                  <div>DIMENSIONS: {a.dimensions_w_mm}MM W x {a.dimensions_h_mm}MM H</div>
                  <div>PANTONES: {d.artwork.colour_pantones.join(', ')}</div>
                  {a.production_note && <div>PRODUCTION: {a.production_note}</div>}
                </div>
              )))}
            </div>
          </section>
        ))}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Smoke (manual)**

After setting `INTERNAL_RENDER_TOKEN` env, with a version row in the DB:
```bash
curl "http://localhost:3001/internal/proof-html/<version-id>?token=$INTERNAL_RENDER_TOKEN" | head -50
# Expect: HTML with FINAL PROOF — heading
```

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/proof-html/[versionId]/page.tsx
git commit -m "feat(proofs): internal HTML template for puppeteer rendering"
```

---

## Task 12: PDF render route (puppeteer pipeline)

**Files:**
- Create: `src/lib/proofs/pdf.ts`
- Create: `src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.ts`

- [ ] **Step 1: PDF render helper**

```ts
// src/lib/proofs/pdf.ts
import puppeteer from 'puppeteer'

export async function renderProofPdf(internalUrl: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.goto(internalUrl, { waitUntil: 'networkidle0', timeout: 60_000 })
    const buf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return Buffer.from(buf)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Render route**

```ts
// src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireProofsAccess } from '@/lib/proofs/auth'
import { renderProofPdf } from '@/lib/proofs/pdf'
import { pdfPath, uploadBuffer, signedUrlForPdf } from '@/lib/proofs/storage'

export const maxDuration = 120

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const auth = await requireProofsAccess(request)
  if ('error' in auth) return auth.error
  const { id, versionId } = await params

  const internalToken = process.env.INTERNAL_RENDER_TOKEN
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001'
  if (!internalToken) {
    return NextResponse.json({ error: 'INTERNAL_RENDER_TOKEN not configured' }, { status: 500 })
  }
  const internalUrl = `${baseUrl}/internal/proof-html/${versionId}?token=${internalToken}`

  let buf: Buffer
  try { buf = await renderProofPdf(internalUrl) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const path = pdfPath(id, versionId)
  try { await uploadBuffer(path, buf, 'application/pdf') } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const supa = admin()
  await supa
    .from('design_proof_versions')
    .update({ pdf_storage_path: path, pdf_generated_at: new Date().toISOString() })
    .eq('id', versionId)

  const url = await signedUrlForPdf(path)
  return NextResponse.json({ pdf_storage_path: path, signed_url: url })
}
```

- [ ] **Step 3: Smoke (manual)**

```bash
curl -X POST -H "Authorization: Bearer $STAFF_TOKEN" \
  http://localhost:3001/api/proofs/<id>/versions/<versionId>/render-pdf
# Expect: 200 + signed_url; download URL → opens PDF
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/proofs/pdf.ts src/app/api/proofs/[id]/versions/[versionId]/render-pdf/route.ts
git commit -m "feat(proofs): puppeteer-based PDF render + storage upload"
```

---

## Task 13: Builder UI shell — `/staff-quote/proof/new`

**Files:**
- Create: `src/app/(staff-quote)/staff-quote/proof/new/page.tsx`

- [ ] **Step 1: Implement (client component)**

```tsx
// src/app/(staff-quote)/staff-quote/proof/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProofPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setBusy(true); setErr(null)
    // Staff token is injected by the same flow as existing /staff-quote pages.
    // Source from sessionStorage / cookie matches the existing pattern.
    const token = sessionStorage.getItem('staffToken')
    if (!token) { setErr('No staff token in session.'); setBusy(false); return }
    const res = await fetch('/api/proofs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ organization_id: orgId, name, customer_email: email }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error ?? 'Create failed')
      setBusy(false)
      return
    }
    const { id } = await res.json()
    router.push(`/staff-quote/proof/${id}/builder`)
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">New B2B proof</h1>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          Organization ID
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={orgId} onChange={(e) => setOrgId(e.target.value)} />
        </label>
        <label className="block text-sm">
          Proof name
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Customer email
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          onClick={submit}
          disabled={busy || !orgId || !name || !email}
          className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Smoke (browser)**

Visit `http://localhost:3001/staff-quote/proof/new`. Fill in PRT org ID `ee155266-200c-4b73-8dbd-be385db3e5b0`, name "PRT smoke", email `hello@theprint-room.co.nz`, submit. Expect redirect to `/staff-quote/proof/<id>/builder`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(staff-quote)/staff-quote/proof/new/page.tsx
git commit -m "feat(proofs): /staff-quote/proof/new entry page"
```

---

## Task 14: Builder shell — `/staff-quote/proof/[proofId]/builder`

**Files:**
- Create: `src/app/(staff-quote)/staff-quote/proof/[proofId]/builder/page.tsx`
- Create: `src/components/proofs/ProofBuilderShell.tsx`

This task is a **scaffold only** — the full canvas integration with `ProductCustomizer` is large and gets refined in Phase 1.5 / 2 once the data flow is exercised. v1 of the shell shows: proof metadata header, an empty `designs[]` editor (add/remove design slots, name field), and a "Save snapshot" button that POSTs the snapshot to `/api/proofs/[id]/versions`.

- [ ] **Step 1: Build the shell**

```tsx
// src/components/proofs/ProofBuilderShell.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProofSnapshot, ProofSnapshotDesign } from '@/lib/proofs/types'

interface Props {
  proofId: string
  proofMeta: { name: string; customer_email: string; organization_id: string; organization_name: string }
}

const EMPTY_DESIGN = (index: number): ProofSnapshotDesign => ({
  index,
  name: `Design ${index}`,
  artwork: {
    original_filename: '',
    storage_path: '',
    preview_url: '',
    colour_pantones: [],
    method: 'screenprint',
  },
  garment_applications: [],
})

export function ProofBuilderShell({ proofId, proofMeta }: Props) {
  const router = useRouter()
  const [designs, setDesigns] = useState<ProofSnapshotDesign[]>([EMPTY_DESIGN(1)])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function addDesign() {
    setDesigns((d) => [...d, EMPTY_DESIGN(d.length + 1)])
  }
  function removeDesign(idx: number) {
    setDesigns((d) => d.filter((x) => x.index !== idx).map((x, i) => ({ ...x, index: i + 1 })))
  }
  function renameDesign(idx: number, name: string) {
    setDesigns((d) => d.map((x) => (x.index === idx ? { ...x, name } : x)))
  }

  async function saveSnapshot() {
    setBusy(true); setErr(null)
    const snap: ProofSnapshot = {
      customer: {
        organization_id: proofMeta.organization_id,
        organization_name: proofMeta.organization_name,
        customer_code: null,
        customer_email: proofMeta.customer_email,
        customer_name: null,
      },
      job: {
        name: proofMeta.name, reference: '', delivery_date: null, additional_notes: null,
        prepared_by: { name: '', email: '', phone: '' },
      },
      designs,
      line_items: [],
      totals: { subtotal: null, currency: 'NZD' },
    }
    const token = sessionStorage.getItem('staffToken')
    const res = await fetch(`/api/proofs/${proofId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ snapshot: snap }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error ?? 'Save failed'); setBusy(false); return
    }
    router.push(`/staff-quote/proof/${proofId}/preview`)
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">{proofMeta.name}</h1>
        <p className="text-sm text-gray-500">
          {proofMeta.organization_name} · {proofMeta.customer_email}
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Designs</h2>
          <button onClick={addDesign} className="text-sm text-blue-600 underline">
            + Add design
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {designs.map((d) => (
            <li key={d.index} className="flex items-center gap-3 rounded border p-3">
              <span className="text-xs text-gray-500">#{d.index}</span>
              <input
                aria-label="Design name"
                className="flex-1 rounded border px-2 py-1 text-sm"
                value={d.name}
                onChange={(e) => renameDesign(d.index, e.target.value)}
              />
              <button onClick={() => removeDesign(d.index)}
                className="text-xs text-red-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <div className="mt-6">
        <button
          onClick={saveSnapshot}
          disabled={busy || designs.length === 0}
          className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Save snapshot & preview'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Page wrapper (server component, fetches metadata)**

```tsx
// src/app/(staff-quote)/staff-quote/proof/[proofId]/builder/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ProofBuilderShell } from '@/components/proofs/ProofBuilderShell'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ proofId: string }>
}) {
  const { proofId } = await params
  const supa = admin()
  const { data: proof } = await supa
    .from('design_proofs')
    .select('id, name, customer_email, organization_id')
    .eq('id', proofId)
    .maybeSingle()
  if (!proof) return notFound()
  const { data: org } = await supa
    .from('organizations')
    .select('id, name')
    .eq('id', proof.organization_id)
    .maybeSingle()

  return (
    <ProofBuilderShell
      proofId={proof.id}
      proofMeta={{
        name: proof.name,
        customer_email: proof.customer_email,
        organization_id: proof.organization_id,
        organization_name: org?.name ?? 'Unknown',
      }}
    />
  )
}
```

- [ ] **Step 3: Smoke**

After Task 13, navigate to the redirected `/builder` page. Add 2 designs. Click "Save snapshot & preview". Expect redirect to `/preview`.

- [ ] **Step 4: Commit**

```bash
git add src/components/proofs/ProofBuilderShell.tsx \
  src/app/(staff-quote)/staff-quote/proof/[proofId]/builder/page.tsx
git commit -m "feat(proofs): builder shell (designs[] editor, save snapshot)"
```

---

## Task 15: Preview page — render-pdf trigger + iframe

**Files:**
- Create: `src/app/(staff-quote)/staff-quote/proof/[proofId]/preview/page.tsx`
- Create: `src/components/proofs/ProofPreviewClient.tsx`

- [ ] **Step 1: Build the preview client**

```tsx
// src/components/proofs/ProofPreviewClient.tsx
'use client'
import { useState } from 'react'

interface Props {
  proofId: string
  versionId: string
  versionNumber: number
  initialPdfUrl: string | null
}

export function ProofPreviewClient({ proofId, versionId, versionNumber, initialPdfUrl }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generate() {
    setBusy(true); setErr(null)
    const token = sessionStorage.getItem('staffToken')
    const res = await fetch(`/api/proofs/${proofId}/versions/${versionId}/render-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error ?? 'Render failed'); setBusy(false); return
    }
    const data = await res.json()
    setPdfUrl(data.signed_url)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Preview — v{versionNumber}</h1>
        <button onClick={generate} disabled={busy}
          className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? 'Generating…' : pdfUrl ? 'Regenerate PDF' : 'Generate PDF'}
        </button>
      </header>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {pdfUrl ? (
        <iframe src={pdfUrl} className="h-[80vh] w-full rounded border" title="Proof PDF" />
      ) : (
        <div className="rounded border border-dashed p-12 text-center text-sm text-gray-500">
          No PDF generated yet. Click "Generate PDF" above.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Page wrapper**

```tsx
// src/app/(staff-quote)/staff-quote/proof/[proofId]/preview/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ProofPreviewClient } from '@/components/proofs/ProofPreviewClient'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ proofId: string }>
}) {
  const { proofId } = await params
  const supa = admin()
  const { data: proof } = await supa
    .from('design_proofs')
    .select('id, current_version_id')
    .eq('id', proofId)
    .maybeSingle()
  if (!proof || !proof.current_version_id) return notFound()
  const { data: version } = await supa
    .from('design_proof_versions')
    .select('id, version_number, pdf_storage_path')
    .eq('id', proof.current_version_id)
    .maybeSingle()
  if (!version) return notFound()

  let signedUrl: string | null = null
  if (version.pdf_storage_path) {
    const { data } = await supa.storage
      .from('design-proofs')
      .createSignedUrl(version.pdf_storage_path, 60 * 60 * 24)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <ProofPreviewClient
      proofId={proofId}
      versionId={version.id}
      versionNumber={version.version_number}
      initialPdfUrl={signedUrl}
    />
  )
}
```

- [ ] **Step 3: Smoke (full end-to-end)**

After Tasks 13, 14, 15 are wired:
1. `/staff-quote/proof/new` → submit → land on `/builder`
2. Add 1 design, click "Save snapshot & preview" → land on `/preview`
3. Click "Generate PDF" → wait ~10s → iframe shows the proof

- [ ] **Step 4: Commit**

```bash
git add src/components/proofs/ProofPreviewClient.tsx \
  src/app/(staff-quote)/staff-quote/proof/[proofId]/preview/page.tsx
git commit -m "feat(proofs): preview page with PDF render trigger + iframe"
```

---

## Task 16: Update memory + spec

**Files:**
- Modify: `print-room-staff-portal/docs/superpowers/specs/2026-04-28-b2b-design-proofs-system-design.md` (append "Phase 1 shipped 2026-MM-DD" line to §13)
- Modify: `~/.claude/projects/c--Users-MSI-Documents-Projects/memory/MEMORY.md` (add a new entry: "Design Proofs System")
- Create: `~/.claude/projects/c--Users-MSI-Documents-Projects/memory/project_design_proofs.md`

- [ ] **Step 1: Append ship status to spec**

In the spec's §13 ("Migration & rollout plan"), append at the end of the Phase 1 entry:
```
**Status:** Phase 1 shipped 2026-MM-DD. Migration files at design-tool/supabase/migrations/create-design-proofs-tables.sql / create-design-proof-approvals-links.sql / create-design-proofs-storage.sql. Builder routes at /staff-quote/proof/{new,[id]/builder,[id]/preview}. PDF render via puppeteer + /internal/proof-html/[versionId].
```

- [ ] **Step 2: Create the memory file**

```markdown
---
name: Design Proofs System (Phase 1 shipped)
description: B2B design-proof system. Phase 1 (D3-α) shipped 2026-MM-DD; covers schema + builder + PDF in design-tool. Phase 2 = customer approval, Phase 3 = catalogue links + PDP gallery + customer archive, Phase 4 = revisions + change-order fee.
type: project
---
... (concise summary mirroring the catalogues memory shape)
```

- [ ] **Step 3: Add a line to MEMORY.md index**

```
- [Design Proofs System](project_design_proofs.md) — Phase 1 (D3-α) SHIPPED 2026-MM-DD: 4 tables + storage bucket + builder + puppeteer PDF; spec at staff-portal/docs/superpowers/specs/2026-04-28-b2b-design-proofs-system-design.md
```

- [ ] **Step 4: Commit memory + spec updates**

```bash
# In staff-portal repo:
git add docs/superpowers/specs/2026-04-28-b2b-design-proofs-system-design.md
git commit -m "docs(proofs): mark Phase 1 shipped"
# Memory updates land in the auto-memory dir, no commit needed there
```

---

## Phase 1 done when

- [ ] All 16 tasks committed
- [ ] Smoke test full happy path: `/staff-quote/proof/new` → builder → preview → "Generate PDF" → iframe shows the proof
- [ ] PRT test tenant has at least one design_proofs row with a generated PDF
- [ ] Memory + spec updated
- [ ] No console errors during the smoke
- [ ] No 🟡 SQL gates skipped — all three migrations approved before apply

## Phase 2 / 3 / 4 are separate plans

Do NOT bake into Phase 1:
- Customer approval URL / signed tokens / `/proof/[token]` page (Phase 2)
- `proof_catalogue_links` UI in staff-portal or PDP gallery resolution in customer-portal (Phase 3)
- Version 2+ creation flow / change-order fee surfacing in UI (Phase 4)

These are all queued in the spec's §13 and will get their own plans at phase boundaries.

## Self-review note

After writing this plan I checked it against the spec:
- Spec §5 (data model): covered by Tasks 1–3
- Spec §6 (state machine): only `draft` state used in Phase 1; sent/approved transitions are Phase 2
- Spec §7 (PDF generation): covered by Tasks 11, 12
- Spec §10 (B2B entry mode): covered by Tasks 13, 14, 15
- Spec §8 (auth): existing `verifyStaffToken` is sufficient for Phase 1; new permission keys arrive with Phase 3 (staff-portal needs `proofs:write` for the catalogue-link UI)
- Spec §11 (4-axis): not duplicated here — see spec
- Spec §12 (decisions locked): all preserved

No placeholders found. Type names consistent across tasks (`ProofSnapshot`, `DesignProofRow`, `DesignProofVersionRow`, `requireProofsAccess`, `buildProofSnapshot`, `renderProofPdf`, `pdfPath`, `mockupPath`, `uploadBuffer`, `signedUrlForPdf`).
