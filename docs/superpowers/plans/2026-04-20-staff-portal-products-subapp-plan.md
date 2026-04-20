# Staff Portal Products Sub-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the standalone `middleware-pr` Express/EJS product editor into the `print-room-staff-portal` as a `(portal)/products/*` sub-app with feature parity, plus new product-type tag filters and a "live on Shopify" filter, scoped to `platform = 'uniforms'` for v1.

**Architecture:** Next.js 16 App Router segment under `src/app/(portal)/products/` with co-located REST API routes under `src/app/api/products/`. Server components render the list; client components render the tabbed editor with per-tab local state and per-tab save. Supabase access goes through the existing `getSupabaseServer` (auth) and `getSupabaseAdmin` (mutations) helpers; every query and mutation passes through a single `withUniformsScope` helper so v1.1 can drop the platform filter in one place. Permission gating reuses the existing `staff_users` row + `StaffContext`/`useStaff` pattern, with a new `products:write` permission key. UI is built only from existing primitives in `src/components/ui/` (no new dependencies, no Radix/Headless).

**Tech Stack:** Next.js 16.2.3, React 19, Tailwind v4, `@supabase/ssr` 0.10, `@supabase/supabase-js` 2.103, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`. TypeScript 5.

---

## Reference: spec and existing patterns

- **Spec (authoritative):** `docs/superpowers/specs/2026-04-20-staff-portal-products-subapp-design.md`
- **Next.js 16 docs:** Read `node_modules/next/dist/docs/` before each step that uses route handlers, dynamic params, or server/client component boundaries — the framework rule in `AGENTS.md` overrides any patterns from training data.
- **Auth pattern:** `src/middleware.ts` (Supabase session gate), `src/contexts/StaffContext.tsx` (`hasPermission`), `src/lib/presentations/server.ts` (`requirePresentationStaffAccess` — mirror this for products).
- **Supabase clients:** `src/lib/supabase-server.ts` (`getSupabaseServer`, `getSupabaseAdmin`), `src/lib/supabase-browser.ts`.
- **UI primitives:** `src/components/ui/{button,card,input,textarea,badge}.tsx`. `src/lib/utils.ts` for `cn()`.
- **Sidebar pattern:** `src/components/layout/Sidebar.tsx` — `NAV_SECTIONS` array, `permission` field gates visibility through `hasPermission`.
- **Source to port (do NOT copy verbatim, re-implement):**
  `routes/products.js`, `routes/swatches.js`, `routes/sizes.js`, `routes/images.js`, `routes/pricing.js` in `C:\Users\MSI\Documents\Projects\middleware-pr`.

## Confirmed DB shapes (no migrations required for v1)

- `products` includes: `id uuid`, `name text`, `sku text`, `supplier_code text`, `code text`, `description text`, `brand_id uuid`, `category_id uuid`, `garment_family text`, `industry text[]`, `tags text[] NOT NULL DEFAULT '{}'`, `base_cost numeric`, `markup_pct numeric NOT NULL DEFAULT 0`, `decoration_eligible boolean DEFAULT true`, `decoration_price numeric DEFAULT 0`, `specs jsonb`, `safety_standard text`, `moq integer NOT NULL DEFAULT 24`, `lead_time_days integer NOT NULL DEFAULT 14`, `sizing_type text NOT NULL DEFAULT 'multi_size'`, `default_sizes text[]`, `supports_labels boolean NOT NULL DEFAULT true`, `is_hero boolean DEFAULT false`, `is_active boolean NOT NULL DEFAULT true`, `image_url text`, `customizable_features jsonb`, `shopify_product_id text`, `platform text NOT NULL DEFAULT 'print-room'`, `created_at timestamptz`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- `product_color_swatches`: `id uuid, product_id uuid, label text NOT NULL, hex text NOT NULL, position int NOT NULL, is_active bool NOT NULL, image_url text`.
- `sizes`: `id integer (NOT uuid), product_id uuid, label text, order_index int`.
- `product_images`: `id uuid, product_id uuid, file_url text, view text, position int, alt_text text, dpi int, print_areas jsonb, view_lower text, image_type text NOT NULL`.
- `product_pricing_tiers`: `id uuid, product_id uuid, min_quantity int, max_quantity int, unit_price numeric, sku text, pricing_option text, tier_level int NOT NULL, customization_value_id int, is_active bool NOT NULL, currency text NOT NULL`.
- `brands`: `id uuid, name text, hero_product_id uuid, size_chart_url text, platform text`.
- `categories`: `id uuid, name text, hero_product_id uuid, platform text, category_type text`.
- `staff_users`: per `sql/001_staff_users.sql` — `permissions JSONB`, `role` IN `('staff','admin','super_admin')`.

## Spec ambiguities resolved with defaults

The spec is mostly tight. The following defaults were applied; any can be overridden by editing the relevant task before implementation:

1. **`code` field placement** — spec lists `code` under "Identity" but middleware-pr edit form omits it. Default: include in Details tab as a free-text input alongside `sku` and `supplier_code`.
2. **`industry` editor UX** — spec says "multi-input → text[]", middleware-pr uses comma-separated string. Default: comma-separated `<Input>` with helper text "comma-separated list" and array conversion on save (preserves middleware-pr behaviour; richer chips control deferred).
3. **`default_sizes` editor** — spec lists it but doesn't specify UX. Default: comma-separated `<Input>` (same pattern as `industry`).
4. **Tab routing** — single client page or per-tab URL? Default: single client page at `/products/[id]` with tab state held in local React state; tab name is reflected as a URL hash (`#details`, `#swatches`, ...) for deep-linking and browser back/forward. No separate routes per tab — keeps editor cohesive and avoids server round-trips on tab switch.
5. **Confirmation on delete** — spec doesn't mandate. Default: native `window.confirm` for product delete and sub-resource deletes (cheap, consistent with quote-tool patterns; modal upgrade deferred).
6. **List page server vs client** — spec says "server components for the list view (initial render)". Default: page.tsx is a server component that reads URL search params and renders a client `<ProductList>` for filter interactions; data fetched server-side and passed in as initial props, with client-side fetch for subsequent filter/page changes via the existing API route (single source of truth).
7. **`product_images.image_type` value** — required field, no spec note. Default: `'product'` literal (matches middleware-pr).
8. **`product_images.view` allowed values** — middleware-pr lists `['front','back','side','detail','swatch','lifestyle']`; spec lists `front/back/side/detail`. Default: use the spec's 4-value list to keep the new tool simpler.
9. **`product_color_swatches.position`** — required NOT NULL int. Default on add: `(max(position) + 1) || 0` per product, computed server-side.
10. **`product_pricing_tiers` numeric currency / tier_level defaults** — middleware-pr uses `currency='NZD'`, `tier_level=1`, `is_active=true`. Default: same values for v1.

---

## File structure to be created

**New source files (all under `print-room-staff-portal/`):**

```
src/lib/products/
  scope.ts                 # withUniformsScope helper + PLATFORM_SCOPE constant
  tags.ts                  # PRODUCT_TYPE_TAGS, RESERVED_TAGS, ALLOWED_TAGS, validators, label map
  garment-families.ts      # GARMENT_FAMILIES (16 strings, ported verbatim)
  server.ts                # requireProductsStaffAccess (mirrors presentations/server.ts)
  schema.ts                # Type definitions + normalizers/validators for create/update payloads
  query.ts                 # buildListQuery + parseListSearchParams (URL <-> filter state)

src/types/
  products.ts              # ProductSummary, ProductDetail, Swatch, Size, Image, PricingTier, filter types

src/app/(portal)/products/
  page.tsx                 # Server component: parse search params, fetch initial page, render ProductList
  new/page.tsx             # Client component wrapper for ProductCreateForm
  [id]/page.tsx            # Server component: load product, render <ProductEditor> client component

src/app/api/products/
  route.ts                                       # GET list (with filters), POST create
  [id]/route.ts                                  # GET, PATCH, DELETE
  [id]/toggle-active/route.ts                    # POST
  [id]/swatches/route.ts                         # GET, POST
  [id]/swatches/[swatchId]/route.ts              # PATCH, DELETE
  [id]/sizes/route.ts                            # GET, POST
  [id]/sizes/quick-add/route.ts                  # POST (standard sizes batch)
  [id]/sizes/[sizeId]/route.ts                   # DELETE
  [id]/images/route.ts                           # GET, POST
  [id]/images/[imageId]/route.ts                 # PATCH (set primary / position), DELETE
  [id]/pricing-tiers/route.ts                    # GET, POST
  [id]/pricing-tiers/[tierId]/route.ts           # PATCH, DELETE

src/components/products/
  ProductList.tsx          # Client: rows + pagination + filter wiring
  ProductFilters.tsx       # Client: search, brand, category, garment-family, tag checkboxes, shopify, active
  ProductRow.tsx           # Client: row UI with badges + active toggle + edit link
  ProductCreateForm.tsx    # Client: minimal create form (name, brand, category, etc.)
  ProductEditor.tsx        # Client: tab navigation + tab-state hash sync; renders the active tab pane
  tabs/
    DetailsTab.tsx         # Client: full Details form, per-tab save
    SwatchesTab.tsx        # Client: swatch grid CRUD
    SizesTab.tsx           # Client: quick-add row + custom size + delete
    ImagesTab.tsx          # Client: image grid CRUD
    PricingTab.tsx         # Client: tier rows CRUD
  TagCheckboxGroup.tsx     # Client: PRODUCT_TYPE_TAGS checkboxes (Workwear / Pre-order / B2B)
  ShopifyLiveBadge.tsx     # Tiny presentational helper
  TabNav.tsx               # Custom tab list with active-underline (no Radix)
```

**Modified files:**

- `src/types/staff.ts` — add `'products'` to `StaffPermission` union (for sidebar nav permission gating; the API uses a stricter `'products:write'` literal in JSONB).
- `src/components/layout/Sidebar.tsx` — add a new section in `NAV_SECTIONS`.
- `sql/003_products_permission.sql` (new file) — documentation-only SQL one-off you run once to grant `products:write` to the seed admins. Application reads `permissions` from `staff_users` either way.

**Important naming note:** The spec calls the permission `products:write` (literal string in `staff_users.permissions` JSONB). The sidebar `NAV_SECTIONS.permission` field uses the `StaffPermission` type, which currently lists kebab-case keys like `'quote-tool'`. To avoid forking the convention, the sidebar entry uses a new permission key `'products'` (kebab-case, like its peers) but the API authorisation check accepts EITHER `permissions @> '["products:write"]'` OR `permissions @> '["products"]'`. Document both in the `staff_users.permissions` shape so a future task can converge them. (See Task 5.)

---

## Natural review checkpoints

After completing each of these checkpoints, stop and ask the user to review before continuing:

- **Checkpoint A** — after Task 5 (auth, scope, tags, types in place; nothing user-visible yet).
- **Checkpoint B** — after Task 12 (list page works end-to-end with filters, pagination, active toggle).
- **Checkpoint C** — after Task 16 (Details tab saves; create flow works; product round-trips).
- **Checkpoint D** — after Task 21 (all four sub-resource tabs work).
- **Checkpoint E** — after Task 23 (delete + final polish; ready for the spec's 1-week side-by-side run).

---

# Tasks

## Task 1: Add `products` permission to StaffPermission type

**Files:**
- Modify: `src/types/staff.ts`

- [ ] **Step 1: Read current types file**

Open `src/types/staff.ts`. Confirm current `StaffPermission` union has the seven kebab-case keys (`'image-generator' | 'job-tracker' | 'reports' | 'chatbot-admin' | 'presentations' | 'settings' | 'quote-tool'`).

- [ ] **Step 2: Add `'products'` to the union**

Replace the union with:

```ts
export type StaffPermission =
  | 'image-generator'
  | 'job-tracker'
  | 'reports'
  | 'chatbot-admin'
  | 'presentations'
  | 'settings'
  | 'quote-tool'
  | 'products'
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS (zero errors). The Sidebar's `NavSection.id` type widens to include `'products'` for free.

- [ ] **Step 4: Commit**

```bash
git add src/types/staff.ts
git commit -m "feat(products): add products permission to StaffPermission type"
```

---

## Task 2: Add Products section to Sidebar nav

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Package icon import**

In the `lucide-react` import block at the top of `Sidebar.tsx`, append `Package` to the imports.

- [ ] **Step 2: Add NAV_SECTIONS entry**

Insert this section into `NAV_SECTIONS` immediately after the existing `'quote-tool'` block (so it appears just under Quote Tool in the sidebar):

```ts
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    permission: 'products',
    items: [
      { label: 'All Products', href: '/products', icon: Package },
    ],
  },
```

- [ ] **Step 3: Manual verify**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npm run dev`
Sign in as an admin. The "Products" item appears in the sidebar (admins always see all). Sign in as a staff user without `'products'` permission — Products entry hidden. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(products): add Products entry to staff portal sidebar"
```

---

## Task 3: Create platform-scope helper

**Files:**
- Create: `src/lib/products/scope.ts`

- [ ] **Step 1: Write the helper**

Create `src/lib/products/scope.ts` with:

```ts
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

/**
 * v1 hard-codes the products sub-app to the 'uniforms' platform slice.
 * v1.1 will make this user-selectable; centralising the filter here lets
 * us swap call sites in one place.
 */
export const PLATFORM_SCOPE = 'uniforms' as const

export function withUniformsScope<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends PostgrestFilterBuilder<any, any, any>
>(query: T): T {
  return query.eq('platform', PLATFORM_SCOPE) as T
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/products/scope.ts
git commit -m "feat(products): add platform-scope helper for v1 uniforms filter"
```

---

## Task 4: Create tag and garment-family vocabularies

**Files:**
- Create: `src/lib/products/tags.ts`
- Create: `src/lib/products/garment-families.ts`

- [ ] **Step 1: Write tags.ts**

Create `src/lib/products/tags.ts`:

```ts
export const PRODUCT_TYPE_TAGS = ['workwear', 'preorder', 'b2b'] as const
export type ProductTypeTag = (typeof PRODUCT_TYPE_TAGS)[number]

/** Tags that pre-existed; preserved on save, no UI to add/remove in v1. */
export const RESERVED_TAGS = ['leavers', 'design-tool'] as const
export type ReservedTag = (typeof RESERVED_TAGS)[number]

export const ALLOWED_TAGS = [...PRODUCT_TYPE_TAGS, ...RESERVED_TAGS] as const
export type AllowedTag = (typeof ALLOWED_TAGS)[number]

export const PRODUCT_TYPE_TAG_LABELS: Record<ProductTypeTag, string> = {
  workwear: 'Workwear',
  preorder: 'Pre-order',
  b2b: 'B2B',
}

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_TAGS)

/**
 * Server-side guard. Filters incoming tags to only the controlled vocabulary.
 * Reserved tags currently on a product are preserved by the caller before
 * passing user-edited type tags through this guard.
 */
export function sanitiseProductTags(input: unknown): AllowedTag[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: AllowedTag[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    if (!ALLOWED_SET.has(value)) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value as AllowedTag)
  }
  return out
}

/**
 * Merge user-edited type tags with the reserved tags that were already on
 * the product. Used in PATCH handlers so a user editing Details cannot
 * inadvertently strip 'leavers' or 'design-tool'.
 */
export function mergeWithReservedTags(
  userTypeTags: readonly string[],
  existingTags: readonly string[]
): AllowedTag[] {
  const reservedFromExisting = existingTags.filter(
    (t): t is ReservedTag => (RESERVED_TAGS as readonly string[]).includes(t)
  )
  const sanitisedUser = sanitiseProductTags(userTypeTags).filter(
    t => !(RESERVED_TAGS as readonly string[]).includes(t)
  )
  return [...sanitisedUser, ...reservedFromExisting]
}
```

- [ ] **Step 2: Write garment-families.ts**

Create `src/lib/products/garment-families.ts`:

```ts
/**
 * Ported verbatim from middleware-pr/routes/products.js.
 * 16 entries; alphabetical except where the original wasn't.
 */
export const GARMENT_FAMILIES = [
  'accessories',
  'belt',
  'corporate',
  'crew',
  'headwear',
  'healthcare',
  'hoodie',
  'jacket',
  'pants',
  'polo',
  'scrubs',
  'shirt',
  'shorts',
  'tee',
  'trades',
  'vest',
] as const

export type GarmentFamily = (typeof GARMENT_FAMILIES)[number]

const FAMILY_SET: ReadonlySet<string> = new Set(GARMENT_FAMILIES)

export function isGarmentFamily(value: unknown): value is GarmentFamily {
  return typeof value === 'string' && FAMILY_SET.has(value)
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/products/tags.ts src/lib/products/garment-families.ts
git commit -m "feat(products): add controlled-vocabulary tag and garment-family helpers"
```

---

## Task 5: Auth helper for products API routes

**Files:**
- Create: `src/lib/products/server.ts`
- Create: `sql/003_products_permission.sql`

- [ ] **Step 1: Write the auth helper**

Create `src/lib/products/server.ts` (mirrors `src/lib/presentations/server.ts`):

```ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface ProductsStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

/**
 * Authorises a request against the products sub-app.
 *
 * Access rule: role is admin/super_admin OR permissions array contains
 * either 'products' (sidebar permission key) or 'products:write' (the
 * spec's explicit write key — accepted for forward-compat with v1.1
 * which may split read vs write).
 */
export async function requireProductsStaffAccess() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  const typedStaff = staff as StaffRow
  const permissions = Array.isArray(typedStaff.permissions) ? typedStaff.permissions : []
  const isAdmin = typedStaff.role === 'admin' || typedStaff.role === 'super_admin'
  const hasProductsPerm =
    permissions.includes('products') || permissions.includes('products:write')

  if (!isAdmin && !hasProductsPerm) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typedStaff.id,
      role: typedStaff.role,
      isAdmin,
      displayName: typedStaff.display_name,
    } satisfies ProductsStaffContext,
  }
}

/**
 * Loads a product (UUID) verifying it is in the v1 platform scope.
 * Returns either { product } or { error: NextResponse }.
 */
export async function requireUniformsProduct(productId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('products')
    .select('id, name, tags, platform')
    .eq('id', productId)
    .eq('platform', 'uniforms')
    .single()

  if (error || !data) {
    return { error: NextResponse.json({ error: 'Product not found' }, { status: 404 }) }
  }

  return { product: data }
}

export function dbErrorResponse(
  error: { code?: string; message?: string } | null,
  fallbackMessage: string,
  status = 500
) {
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Duplicate value (unique constraint).' }, { status: 409 })
  }
  return NextResponse.json({ error: fallbackMessage }, { status })
}
```

- [ ] **Step 2: Write the documentation-only SQL one-off**

Create `sql/003_products_permission.sql`:

```sql
-- One-off: grant the new 'products' permission to seed admins.
-- The application accepts 'products' OR 'products:write' on staff_users.permissions.
-- Run manually via the Supabase SQL editor as a logged-in service user.

UPDATE staff_users
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM jsonb_array_elements_text(permissions || '["products"]'::jsonb) AS value
)
WHERE role IN ('admin', 'super_admin');

-- v1.1 follow-up: add CHECK constraint on products.tags
-- ALTER TABLE products
--   ADD CONSTRAINT products_tags_allowed
--   CHECK (tags <@ ARRAY['workwear','preorder','b2b','leavers','design-tool']::text[]);
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/products/server.ts sql/003_products_permission.sql
git commit -m "feat(products): add staff-access helper and seed-permission SQL"
```

> **CHECKPOINT A** — Auth, scope, vocab, types in place. Stop. Ask the user to review the four new lib files and the StaffPermission addition before continuing.

---

## Task 6: Type definitions for the products domain

**Files:**
- Create: `src/types/products.ts`

- [ ] **Step 1: Write the type file**

Create `src/types/products.ts`:

```ts
import type { ProductTypeTag } from '@/lib/products/tags'
import type { GarmentFamily } from '@/lib/products/garment-families'

export interface BrandRef {
  id: string
  name: string
}

export interface CategoryRef {
  id: string
  name: string
}

export interface ProductSummary {
  id: string
  name: string
  sku: string | null
  supplier_code: string | null
  base_cost: number | null
  is_active: boolean
  image_url: string | null
  garment_family: GarmentFamily | null
  tags: string[]
  shopify_product_id: string | null
  brand: BrandRef | null
  category: CategoryRef | null
}

export interface ProductDetail {
  id: string
  name: string
  sku: string | null
  supplier_code: string | null
  code: string | null
  description: string | null
  brand_id: string
  category_id: string
  garment_family: GarmentFamily | null
  industry: string[] | null
  default_sizes: string[] | null
  tags: string[]
  base_cost: number | null
  markup_pct: number
  decoration_eligible: boolean
  decoration_price: number
  specs: unknown
  safety_standard: string | null
  moq: number
  lead_time_days: number
  sizing_type: string
  supports_labels: boolean
  is_hero: boolean
  is_active: boolean
  shopify_product_id: string | null
  platform: string
  created_at: string | null
  updated_at: string
}

export interface SwatchRow {
  id: string
  product_id: string
  label: string
  hex: string
  position: number
  is_active: boolean
  image_url: string | null
}

export interface SizeRow {
  id: number
  product_id: string
  label: string
  order_index: number
}

export interface ImageRow {
  id: string
  product_id: string
  file_url: string
  view: string | null
  position: number
  alt_text: string | null
  image_type: string
}

export interface PricingTierRow {
  id: string
  product_id: string
  min_quantity: number
  max_quantity: number | null
  unit_price: number
  currency: string
  tier_level: number
  is_active: boolean
}

export type ShopifyLiveFilter = 'all' | 'live' | 'not-live'
export type ActiveFilter = 'all' | 'active' | 'inactive'

export interface ProductListFilters {
  search: string
  brand_id: string | null
  category_id: string | null
  garment_family: GarmentFamily | null
  type_tags: ProductTypeTag[]
  shopify: ShopifyLiveFilter
  active: ActiveFilter
  page: number
}

export interface ProductListResponse {
  products: ProductSummary[]
  total: number
  page: number
  perPage: number
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/products.ts
git commit -m "feat(products): add domain type definitions"
```

---

## Task 7: List query builder + URL parsing

**Files:**
- Create: `src/lib/products/query.ts`

- [ ] **Step 1: Write query builder**

Create `src/lib/products/query.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { withUniformsScope } from './scope'
import { PRODUCT_TYPE_TAGS, type ProductTypeTag } from './tags'
import { GARMENT_FAMILIES, type GarmentFamily } from './garment-families'
import type {
  ActiveFilter,
  ProductListFilters,
  ShopifyLiveFilter,
} from '@/types/products'

export const PRODUCTS_PER_PAGE = 25

const SUMMARY_SELECT =
  'id, name, sku, supplier_code, base_cost, is_active, image_url, garment_family, tags, shopify_product_id, brand:brands!products_brand_id_fkey(id,name), category:categories!products_category_id_fkey(id,name)'

export function defaultListFilters(): ProductListFilters {
  return {
    search: '',
    brand_id: null,
    category_id: null,
    garment_family: null,
    type_tags: [],
    shopify: 'all',
    active: 'all',
    page: 1,
  }
}

export function parseListSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProductListFilters {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined
    const v = params[key]
    if (Array.isArray(v)) return v[0]
    return v
  }
  const getAll = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key)
    const v = params[key]
    if (Array.isArray(v)) return v
    if (typeof v === 'string') return [v]
    return []
  }

  const garmentFamilyRaw = get('garment_family')
  const garmentFamily =
    garmentFamilyRaw && (GARMENT_FAMILIES as readonly string[]).includes(garmentFamilyRaw)
      ? (garmentFamilyRaw as GarmentFamily)
      : null

  const typeTagsRaw = getAll('tag')
  const validTagSet: ReadonlySet<string> = new Set(PRODUCT_TYPE_TAGS)
  const typeTags = typeTagsRaw.filter((t): t is ProductTypeTag => validTagSet.has(t))

  const shopifyRaw = get('shopify')
  const shopify: ShopifyLiveFilter =
    shopifyRaw === 'live' || shopifyRaw === 'not-live' ? shopifyRaw : 'all'

  const activeRaw = get('active')
  const active: ActiveFilter =
    activeRaw === 'active' || activeRaw === 'inactive' ? activeRaw : 'all'

  const pageRaw = parseInt(get('page') || '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  return {
    search: (get('search') || '').trim(),
    brand_id: get('brand_id') || null,
    category_id: get('category_id') || null,
    garment_family: garmentFamily,
    type_tags: typeTags,
    shopify,
    active,
    page,
  }
}

export function listFiltersToSearchParams(filters: ProductListFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (filters.search) sp.set('search', filters.search)
  if (filters.brand_id) sp.set('brand_id', filters.brand_id)
  if (filters.category_id) sp.set('category_id', filters.category_id)
  if (filters.garment_family) sp.set('garment_family', filters.garment_family)
  for (const tag of filters.type_tags) sp.append('tag', tag)
  if (filters.shopify !== 'all') sp.set('shopify', filters.shopify)
  if (filters.active !== 'all') sp.set('active', filters.active)
  if (filters.page > 1) sp.set('page', String(filters.page))
  return sp
}

/**
 * Builds the list query. Pagination range applied by caller for clarity.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildListQuery(client: SupabaseClient<any, any, any>, filters: ProductListFilters) {
  let query = withUniformsScope(
    client.from('products').select(SUMMARY_SELECT, { count: 'exact' }).order('name')
  )

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.garment_family) query = query.eq('garment_family', filters.garment_family)
  if (filters.type_tags.length > 0) query = query.contains('tags', filters.type_tags)

  if (filters.shopify === 'live') query = query.not('shopify_product_id', 'is', null)
  else if (filters.shopify === 'not-live') query = query.is('shopify_product_id', null)

  if (filters.active === 'active') query = query.eq('is_active', true)
  else if (filters.active === 'inactive') query = query.eq('is_active', false)

  return query
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/products/query.ts
git commit -m "feat(products): add list query builder and URL filter parser"
```

---

## Task 8: Schema normalisers and validators

**Files:**
- Create: `src/lib/products/schema.ts`

- [ ] **Step 1: Write the schema module**

Create `src/lib/products/schema.ts`:

```ts
import { GARMENT_FAMILIES, isGarmentFamily, type GarmentFamily } from './garment-families'
import { sanitiseProductTags, type AllowedTag } from './tags'

const NUMERIC_FIELDS = ['base_cost', 'markup_pct', 'decoration_price'] as const
const INTEGER_FIELDS = ['moq', 'lead_time_days'] as const
type NumericField = (typeof NUMERIC_FIELDS)[number]
type IntegerField = (typeof INTEGER_FIELDS)[number]

export interface ProductCreatePayload {
  name: string
  brand_id: string
  category_id: string
  sku: string | null
  supplier_code: string | null
  code: string | null
  description: string | null
  garment_family: GarmentFamily | null
  industry: string[] | null
  default_sizes: string[] | null
  tags: AllowedTag[]
  base_cost: number | null
  markup_pct: number
  decoration_eligible: boolean
  decoration_price: number
  specs: unknown
  safety_standard: string | null
  moq: number
  lead_time_days: number
  sizing_type: string
  supports_labels: boolean
  is_hero: boolean
  is_active: boolean
}

export interface ValidationResult<T> {
  ok: true
  value: T
}
export interface ValidationFailure {
  ok: false
  errors: Record<string, string>
}

function trimOrNull(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const t = input.trim()
  return t.length === 0 ? null : t
}

function parseCommaList(input: unknown): string[] | null {
  if (Array.isArray(input)) {
    const cleaned = input
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => v.length > 0)
    return cleaned.length === 0 ? null : cleaned
  }
  if (typeof input === 'string') {
    const cleaned = input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    return cleaned.length === 0 ? null : cleaned
  }
  return null
}

function parseNumeric(input: unknown, fallback: number | null): number | null {
  if (input === null || input === undefined || input === '') return fallback
  const n = typeof input === 'number' ? input : parseFloat(String(input))
  return Number.isFinite(n) ? n : fallback
}

function parseInteger(input: unknown, fallback: number): number {
  if (input === null || input === undefined || input === '') return fallback
  const n = typeof input === 'number' ? input : parseInt(String(input), 10)
  return Number.isFinite(n) ? n : fallback
}

function parseSpecs(input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null }
  if (typeof input === 'object') return { ok: true, value: input }
  if (typeof input !== 'string') return { ok: false, error: 'Specs must be JSON.' }
  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false, error: 'Specs must be valid JSON.' }
  }
}

function normaliseCommonFields(
  body: Record<string, unknown>
): { errors: Record<string, string>; partial: Partial<ProductCreatePayload> } {
  const errors: Record<string, string> = {}
  const partial: Partial<ProductCreatePayload> = {}

  const name = trimOrNull(body.name)
  if (!name) errors.name = 'Name is required.'
  else partial.name = name

  const brandId = trimOrNull(body.brand_id)
  if (!brandId) errors.brand_id = 'Brand is required.'
  else partial.brand_id = brandId

  const categoryId = trimOrNull(body.category_id)
  if (!categoryId) errors.category_id = 'Category is required.'
  else partial.category_id = categoryId

  partial.sku = trimOrNull(body.sku)
  partial.supplier_code = trimOrNull(body.supplier_code)
  partial.code = trimOrNull(body.code)
  partial.description = trimOrNull(body.description)
  partial.safety_standard = trimOrNull(body.safety_standard)

  const garmentRaw = trimOrNull(body.garment_family)
  if (garmentRaw && !isGarmentFamily(garmentRaw)) {
    errors.garment_family = `Must be one of: ${GARMENT_FAMILIES.join(', ')}.`
  } else {
    partial.garment_family = garmentRaw as GarmentFamily | null
  }

  partial.industry = parseCommaList(body.industry)
  partial.default_sizes = parseCommaList(body.default_sizes)
  partial.tags = sanitiseProductTags(body.tags)

  partial.base_cost = parseNumeric(body.base_cost, null)
  partial.markup_pct = parseNumeric(body.markup_pct, 0) ?? 0
  partial.decoration_price = parseNumeric(body.decoration_price, 0) ?? 0
  partial.decoration_eligible = body.decoration_eligible === true || body.decoration_eligible === 'on'
  partial.supports_labels = body.supports_labels === true || body.supports_labels === 'on'
  partial.is_hero = body.is_hero === true || body.is_hero === 'on'
  partial.is_active = body.is_active === true || body.is_active === 'on'

  partial.moq = parseInteger(body.moq, 24)
  partial.lead_time_days = parseInteger(body.lead_time_days, 14)
  partial.sizing_type = trimOrNull(body.sizing_type) || 'multi_size'

  const specs = parseSpecs(body.specs)
  if (!specs.ok) errors.specs = specs.error
  else partial.specs = specs.value

  return { errors, partial }
}

export function normaliseCreate(
  body: unknown
): ValidationResult<ProductCreatePayload> | ValidationFailure {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _root: 'Body must be an object.' } }
  }
  const { errors, partial } = normaliseCommonFields(body as Record<string, unknown>)
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  // is_active default for new products = false (matches middleware-pr).
  if (!('is_active' in (body as Record<string, unknown>))) partial.is_active = false
  return { ok: true, value: partial as ProductCreatePayload }
}

export function normaliseUpdate(
  body: unknown
): ValidationResult<Partial<ProductCreatePayload>> | ValidationFailure {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _root: 'Body must be an object.' } }
  }
  const { errors, partial } = normaliseCommonFields(body as Record<string, unknown>)
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: partial }
}

// Re-exports for tests / callers
export { NUMERIC_FIELDS, INTEGER_FIELDS }
export type { NumericField, IntegerField }
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/products/schema.ts
git commit -m "feat(products): add create/update payload normaliser and validator"
```

---

## Task 9: API route — GET list / POST create

**Files:**
- Create: `src/app/api/products/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import { mergeWithReservedTags } from '@/lib/products/tags'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { normaliseCreate } from '@/lib/products/schema'

export async function GET(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const filters = parseListSearchParams(request.nextUrl.searchParams)
  const offset = (filters.page - 1) * PRODUCTS_PER_PAGE

  const { data, error, count } = await buildListQuery(access.admin, filters).range(
    offset,
    offset + PRODUCTS_PER_PAGE - 1
  )

  if (error) return dbErrorResponse(error, 'Failed to load products.')

  return NextResponse.json({
    products: data || [],
    total: count || 0,
    page: filters.page,
    perPage: PRODUCTS_PER_PAGE,
  })
}

export async function POST(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = normaliseCreate(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Validation failed.', errors: parsed.errors }, { status: 400 })
  }

  const finalTags = mergeWithReservedTags(parsed.value.tags, [])

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .insert({
        ...parsed.value,
        tags: finalTags,
        platform: 'uniforms',
      })
      .select('id, name')
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to create product.')

  return NextResponse.json({ product: data }, { status: 201 })
}
```

> **Note:** `withUniformsScope` is harmless on inserts (it's a `where` clause — but we explicitly set `platform: 'uniforms'` in the insert payload). The scope wrapper is applied to the SELECT after insert to prevent reading rows on a hypothetical race where another writer creates a non-uniforms product with the same generated id (paranoia, but free).

- [ ] **Step 2: Manual smoke test**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npm run dev`. As an admin user, hit `http://localhost:3000/api/products` in a logged-in browser tab. Expect a JSON `{ products: [...], total: <int>, page: 1, perPage: 25 }` response with at least one record. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/products/route.ts
git commit -m "feat(products): GET list and POST create API endpoints"
```

---

## Task 10: API route — GET / PATCH / DELETE single product + toggle-active

**Files:**
- Create: `src/app/api/products/[id]/route.ts`
- Create: `src/app/api/products/[id]/toggle-active/route.ts`

- [ ] **Step 1: Write the [id] route**

Create `src/app/api/products/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import { mergeWithReservedTags } from '@/lib/products/tags'
import { normaliseUpdate } from '@/lib/products/schema'

const DETAIL_SELECT = '*'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const { data, error } = await withUniformsScope(
    access.admin.from('products').select(DETAIL_SELECT).eq('id', id)
  ).single()

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = normaliseUpdate(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Validation failed.', errors: parsed.errors }, { status: 400 })
  }

  // Preserve any reserved tags that were on the row.
  const existingTags = Array.isArray(existing.product.tags) ? existing.product.tags : []
  const incomingTags = parsed.value.tags ?? []
  const finalTags = mergeWithReservedTags(incomingTags, existingTags)

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .update({ ...parsed.value, tags: finalTags, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(DETAIL_SELECT)
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to update product.')

  return NextResponse.json({ product: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  // Cascade delete sub-resources in parallel, then the row.
  const [swatchRes, sizeRes, imageRes, tierRes] = await Promise.all([
    access.admin.from('product_color_swatches').delete().eq('product_id', id),
    access.admin.from('sizes').delete().eq('product_id', id),
    access.admin.from('product_images').delete().eq('product_id', id),
    access.admin.from('product_pricing_tiers').delete().eq('product_id', id),
  ])
  for (const res of [swatchRes, sizeRes, imageRes, tierRes]) {
    if (res.error) return dbErrorResponse(res.error, 'Failed to delete product children.')
  }

  const { error } = await withUniformsScope(
    access.admin.from('products').delete().eq('id', id)
  )
  if (error) return dbErrorResponse(error, 'Failed to delete product.')

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write the toggle-active route**

Create `src/app/api/products/[id]/toggle-active/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data: row, error: readErr } = await withUniformsScope(
    access.admin.from('products').select('is_active').eq('id', id)
  ).single()
  if (readErr || !row) return dbErrorResponse(readErr, 'Product not found', 404)

  const next = !row.is_active
  const { error } = await withUniformsScope(
    access.admin
      .from('products')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', id)
  )
  if (error) return dbErrorResponse(error, 'Failed to toggle active status.')

  return NextResponse.json({ is_active: next })
}
```

- [ ] **Step 3: Manual smoke test**

Run dev server. Hit `GET /api/products/<some-id>` for a known uniforms product → 200. Hit `POST /api/products/<id>/toggle-active` → 200 with `{ is_active: <bool> }`. Re-toggle to restore original state.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/products/[id]/route.ts src/app/api/products/[id]/toggle-active/route.ts
git commit -m "feat(products): GET/PATCH/DELETE product and toggle-active endpoints"
```

---

## Task 11: ProductFilters and TagCheckboxGroup components

**Files:**
- Create: `src/components/products/TagCheckboxGroup.tsx`
- Create: `src/components/products/ProductFilters.tsx`

- [ ] **Step 1: Write TagCheckboxGroup**

Create `src/components/products/TagCheckboxGroup.tsx`:

```tsx
'use client'

import { PRODUCT_TYPE_TAGS, PRODUCT_TYPE_TAG_LABELS, type ProductTypeTag } from '@/lib/products/tags'

interface Props {
  value: ProductTypeTag[]
  onChange: (next: ProductTypeTag[]) => void
  legend?: string
}

export function TagCheckboxGroup({ value, onChange, legend = 'Type' }: Props) {
  const set = new Set(value)

  function toggle(tag: ProductTypeTag) {
    const next = new Set(set)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange(PRODUCT_TYPE_TAGS.filter(t => next.has(t)))
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-gray-600">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {PRODUCT_TYPE_TAGS.map(tag => (
          <label key={tag} className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={set.has(tag)}
              onChange={() => toggle(tag)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {PRODUCT_TYPE_TAG_LABELS[tag]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Write ProductFilters**

Create `src/components/products/ProductFilters.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GARMENT_FAMILIES, type GarmentFamily } from '@/lib/products/garment-families'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ShopifyLiveFilter,
  ActiveFilter,
} from '@/types/products'
import { TagCheckboxGroup } from './TagCheckboxGroup'

interface Props {
  filters: ProductListFilters
  brands: BrandRef[]
  categories: CategoryRef[]
  onChange: (next: ProductListFilters) => void
  onClear: () => void
}

export function ProductFilters({ filters, brands, categories, onChange, onClear }: Props) {
  function patch(part: Partial<ProductListFilters>) {
    onChange({ ...filters, ...part, page: 1 })
  }

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input
          placeholder="Search by name..."
          value={filters.search}
          onChange={e => patch({ search: e.target.value })}
        />

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.brand_id ?? ''}
          onChange={e => patch({ brand_id: e.target.value || null })}
        >
          <option value="">All brands</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.category_id ?? ''}
          onChange={e => patch({ category_id: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.garment_family ?? ''}
          onChange={e =>
            patch({ garment_family: (e.target.value || null) as GarmentFamily | null })
          }
        >
          <option value="">All garment families</option>
          {GARMENT_FAMILIES.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <TagCheckboxGroup
          value={filters.type_tags}
          onChange={tags => patch({ type_tags: tags })}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Live on Shopify</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.shopify}
            onChange={e => patch({ shopify: e.target.value as ShopifyLiveFilter })}
          >
            <option value="all">All</option>
            <option value="live">Yes</option>
            <option value="not-live">No</option>
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Status</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.active}
            onChange={e => patch({ active: e.target.value as ActiveFilter })}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </fieldset>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/products/TagCheckboxGroup.tsx src/components/products/ProductFilters.tsx
git commit -m "feat(products): filter UI components"
```

---

## Task 12: List page (server) + ProductList (client) + ProductRow

**Files:**
- Create: `src/components/products/ShopifyLiveBadge.tsx`
- Create: `src/components/products/ProductRow.tsx`
- Create: `src/components/products/ProductList.tsx`
- Create: `src/app/(portal)/products/page.tsx`

- [ ] **Step 1: Write ShopifyLiveBadge**

Create `src/components/products/ShopifyLiveBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'

export function ShopifyLiveBadge({ shopifyId }: { shopifyId: string | null }) {
  if (!shopifyId) return null
  return <Badge variant="info">Shopify</Badge>
}
```

- [ ] **Step 2: Write ProductRow**

Create `src/components/products/ProductRow.tsx`:

```tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShopifyLiveBadge } from './ShopifyLiveBadge'
import { PRODUCT_TYPE_TAGS, PRODUCT_TYPE_TAG_LABELS, type ProductTypeTag } from '@/lib/products/tags'
import type { ProductSummary } from '@/types/products'

const TAG_BADGE_VARIANT: Record<ProductTypeTag, 'green' | 'yellow' | 'blue'> = {
  workwear: 'blue',
  preorder: 'yellow',
  b2b: 'green',
}

interface Props {
  product: ProductSummary
  onToggleActive: (id: string, next: boolean) => Promise<void>
}

export function ProductRow({ product, onToggleActive }: Props) {
  const [busy, setBusy] = useState(false)
  const typeTags = (product.tags || []).filter((t): t is ProductTypeTag =>
    (PRODUCT_TYPE_TAGS as readonly string[]).includes(t)
  )

  async function handleToggle() {
    setBusy(true)
    try {
      await onToggleActive(product.id, !product.is_active)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <span className="text-gray-300 text-xs">No image</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/products/${product.id}`}
            className="text-sm font-semibold text-foreground hover:underline truncate"
          >
            {product.name}
          </Link>
          {typeTags.map(t => (
            <Badge key={t} variant={TAG_BADGE_VARIANT[t]}>
              {PRODUCT_TYPE_TAG_LABELS[t]}
            </Badge>
          ))}
          <ShopifyLiveBadge shopifyId={product.shopify_product_id} />
          {!product.is_active && <Badge variant="gray">Inactive</Badge>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-4">
          {product.sku && <span>SKU: {product.sku}</span>}
          {product.brand?.name && <span>{product.brand.name}</span>}
          {product.category?.name && <span>{product.category.name}</span>}
          {product.garment_family && <span>{product.garment_family}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant={product.is_active ? 'secondary' : 'accent'}
          size="sm"
          onClick={handleToggle}
          disabled={busy}
        >
          {product.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Link href={`/products/${product.id}`}>
          <Button type="button" variant="outline" size="sm">
            Edit
          </Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write ProductList**

Create `src/components/products/ProductList.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ProductFilters } from './ProductFilters'
import { ProductRow } from './ProductRow'
import {
  PRODUCTS_PER_PAGE,
  defaultListFilters,
  listFiltersToSearchParams,
  parseListSearchParams,
} from '@/lib/products/query'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ProductListResponse,
  ProductSummary,
} from '@/types/products'

interface Props {
  initial: ProductListResponse
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductList({ initial, brands, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<ProductListFilters>(() =>
    parseListSearchParams(searchParams)
  )
  const [products, setProducts] = useState<ProductSummary[]>(initial.products)
  const [total, setTotal] = useState<number>(initial.total)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE)),
    [total]
  )

  // Re-parse on URL change (back/forward)
  useEffect(() => {
    setFilters(parseListSearchParams(searchParams))
  }, [searchParams])

  const fetchPage = useCallback(async (next: ProductListFilters) => {
    setLoading(true)
    try {
      const sp = listFiltersToSearchParams(next).toString()
      const res = await fetch(`/api/products${sp ? `?${sp}` : ''}`)
      if (!res.ok) throw new Error('Failed to load products.')
      const json = (await res.json()) as ProductListResponse
      setProducts(json.products)
      setTotal(json.total)
    } finally {
      setLoading(false)
    }
  }, [])

  function applyFilters(next: ProductListFilters) {
    setFilters(next)
    const sp = listFiltersToSearchParams(next).toString()
    startTransition(() => {
      router.replace(`/products${sp ? `?${sp}` : ''}`, { scroll: false })
    })
    void fetchPage(next)
  }

  function goToPage(page: number) {
    applyFilters({ ...filters, page })
  }

  async function handleToggleActive(id: string, next: boolean) {
    const res = await fetch(`/api/products/${id}/toggle-active`, { method: 'POST' })
    if (!res.ok) {
      window.alert('Failed to toggle active status.')
      return
    }
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, is_active: next } : p))
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-gray-500">{total} matching</p>
        </div>
        <Link href="/products/new">
          <Button variant="accent">New product</Button>
        </Link>
      </div>

      <ProductFilters
        filters={filters}
        brands={brands}
        categories={categories}
        onChange={applyFilters}
        onClear={() => applyFilters(defaultListFilters())}
      />

      {loading && <p className="text-xs text-gray-500">Loading...</p>}

      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No products match these filters.{' '}
          <button
            type="button"
            onClick={() => applyFilters(defaultListFilters())}
            className="text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <ProductRow key={p.id} product={p} onToggleActive={handleToggleActive} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => goToPage(filters.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => goToPage(filters.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the server page**

Create `src/app/(portal)/products/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { withUniformsScope } from '@/lib/products/scope'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { ProductList } from '@/components/products/ProductList'
import type { BrandRef, CategoryRef, ProductListResponse } from '@/types/products'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()

  // Permission gate (defence-in-depth — middleware also enforces).
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('products') && !perms.includes('products:write')) {
    redirect('/dashboard')
  }

  const sp = await searchParams
  const filters = parseListSearchParams(sp)
  const offset = (filters.page - 1) * PRODUCTS_PER_PAGE

  const [productsResult, brandsResult, categoriesResult] = await Promise.all([
    buildListQuery(admin, filters).range(offset, offset + PRODUCTS_PER_PAGE - 1),
    withUniformsScope(admin.from('brands').select('id, name').order('name')),
    withUniformsScope(admin.from('categories').select('id, name').order('name')),
  ])

  const initial: ProductListResponse = {
    products: productsResult.data || [],
    total: productsResult.count || 0,
    page: filters.page,
    perPage: PRODUCTS_PER_PAGE,
  }

  const brands: BrandRef[] = (brandsResult.data || []) as BrandRef[]
  const categories: CategoryRef[] = (categoriesResult.data || []) as CategoryRef[]

  return <ProductList initial={initial} brands={brands} categories={categories} />
}
```

> **Note on brand/category platform:** middleware-pr loads brands without a platform filter because some brands referenced by uniforms products live under `platform='print-room'`. We mirror by NOT applying the scope to brands/categories. Update Step 4 above accordingly:

- [ ] **Step 4a: Drop scope on brand/category dropdowns**

In the page.tsx file just written, replace the `Promise.all` arms for brands and categories with un-scoped queries:

```ts
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
```

(Drop the `withUniformsScope` wrappers and remove the now-unused import if no other call site remains. The `buildListQuery` line still uses it under the hood.)

- [ ] **Step 5: Manual verify**

Run: `npm run dev`. Sign in as admin. Navigate to `/products`. Verify:
- ~1,863 results, 25/page
- Search narrows
- Brand, category, garment family dropdowns filter
- Each tag checkbox narrows; combinations AND
- Shopify dropdown filters live/not-live
- Active dropdown filters
- URL updates with filter state; back/forward works
- Active toggle works
- "New product" button visible

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/ShopifyLiveBadge.tsx src/components/products/ProductRow.tsx src/components/products/ProductList.tsx src/app/(portal)/products/page.tsx
git commit -m "feat(products): list page with filters, pagination, and active toggle"
```

> **CHECKPOINT B** — List view works end-to-end. Stop. Ask the user to load the page, exercise filters, and approve before continuing to the editor.

---

## Task 13: ProductCreateForm + /products/new page

**Files:**
- Create: `src/components/products/ProductCreateForm.tsx`
- Create: `src/app/(portal)/products/new/page.tsx`

- [ ] **Step 1: Write ProductCreateForm**

Create `src/components/products/ProductCreateForm.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GARMENT_FAMILIES } from '@/lib/products/garment-families'
import type { BrandRef, CategoryRef } from '@/types/products'

interface Props {
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductCreateForm({ brands, categories }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '',
    brand_id: '',
    category_id: '',
    sku: '',
    supplier_code: '',
    garment_family: '',
    description: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrors(json.errors || { _root: json.error || 'Failed to create product.' })
        return
      }
      router.push(`/products/${json.product.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New product</h1>
      <p className="text-sm text-gray-500">
        Save the core fields first; swatches, sizes, images, and pricing tiers unlock after save.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-600">Name *</label>
        <Input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Brand *</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.brand_id}
            onChange={e => setForm({ ...form, brand_id: e.target.value })}
            required
          >
            <option value="">Select brand...</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.brand_id && <p className="text-xs text-red-600">{errors.brand_id}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Category *</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.category_id}
            onChange={e => setForm({ ...form, category_id: e.target.value })}
            required
          >
            <option value="">Select category...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category_id && <p className="text-xs text-red-600">{errors.category_id}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">SKU</label>
          <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Supplier code</label>
          <Input
            value={form.supplier_code}
            onChange={e => setForm({ ...form, supplier_code: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Garment family</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.garment_family}
            onChange={e => setForm({ ...form, garment_family: e.target.value })}
          >
            <option value="">—</option>
            {GARMENT_FAMILIES.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-600">Description</label>
        <Textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {errors._root && <p className="text-sm text-red-600">{errors._root}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={busy}>
          {busy ? 'Creating...' : 'Create product'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/products')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Write the new/page.tsx server wrapper**

Create `src/app/(portal)/products/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { ProductCreateForm } from '@/components/products/ProductCreateForm'
import type { BrandRef, CategoryRef } from '@/types/products'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('products') && !perms.includes('products:write')) {
    redirect('/dashboard')
  }

  const [brandsRes, categoriesRes] = await Promise.all([
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
  ])

  return (
    <ProductCreateForm
      brands={(brandsRes.data || []) as BrandRef[]}
      categories={(categoriesRes.data || []) as CategoryRef[]}
    />
  )
}
```

- [ ] **Step 3: Manual verify**

Run dev server. Click "New product". Submit with empty name → see error. Fill required fields → submits, redirects to `/products/<new-id>` (page will 404 until next task). Verify the row appears in `/products` list with `is_active=false`.

- [ ] **Step 4: Commit**

```bash
git add src/components/products/ProductCreateForm.tsx src/app/(portal)/products/new/page.tsx
git commit -m "feat(products): create form for new products"
```

---

## Task 14: TabNav + ProductEditor shell

**Files:**
- Create: `src/components/products/TabNav.tsx`
- Create: `src/components/products/ProductEditor.tsx`
- Create: `src/app/(portal)/products/[id]/page.tsx`

- [ ] **Step 1: Write TabNav**

Create `src/components/products/TabNav.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'

export interface TabDef {
  key: string
  label: string
}

interface Props {
  tabs: TabDef[]
  active: string
  onChange: (key: string) => void
}

export function TabNav({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" className="border-b border-gray-200 flex gap-2">
      {tabs.map(tab => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-[rgb(var(--color-brand-blue))] text-[rgb(var(--color-brand-blue))]'
                : 'border-transparent text-gray-500 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Write ProductEditor shell (no tab panes yet — placeholders)**

Create `src/components/products/ProductEditor.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TabNav, type TabDef } from './TabNav'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

const TABS: TabDef[] = [
  { key: 'details', label: 'Details' },
  { key: 'swatches', label: 'Swatches' },
  { key: 'sizes', label: 'Sizes' },
  { key: 'images', label: 'Images' },
  { key: 'pricing', label: 'Pricing' },
]

interface Props {
  product: ProductDetail
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductEditor({ product, brands: _brands, categories: _categories }: Props) {
  const [active, setActive] = useState<string>('details')

  // Hash sync (#details, #swatches, ...)
  useEffect(() => {
    const fromHash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
    if (fromHash && TABS.some(t => t.key === fromHash)) setActive(fromHash)
  }, [])

  function changeTab(key: string) {
    setActive(key)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/products" className="text-xs text-gray-500 hover:underline">
            ← Back to products
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{product.name}</h1>
          <p className="text-xs text-gray-500">
            {product.is_active ? 'Active' : 'Inactive'} · platform: {product.platform}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm">
          (delete moved to Details tab)
        </Button>
      </div>

      <TabNav tabs={TABS} active={active} onChange={changeTab} />

      <div>
        {active === 'details' && (
          <p className="text-sm text-gray-500">Details form goes here (Task 15).</p>
        )}
        {active === 'swatches' && (
          <p className="text-sm text-gray-500">Swatches manager goes here (Task 17).</p>
        )}
        {active === 'sizes' && (
          <p className="text-sm text-gray-500">Sizes manager goes here (Task 18).</p>
        )}
        {active === 'images' && (
          <p className="text-sm text-gray-500">Images manager goes here (Task 19).</p>
        )}
        {active === 'pricing' && (
          <p className="text-sm text-gray-500">Pricing tiers manager goes here (Task 20).</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the server [id]/page.tsx**

Create `src/app/(portal)/products/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { withUniformsScope } from '@/lib/products/scope'
import { ProductEditor } from '@/components/products/ProductEditor'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

export const dynamic = 'force-dynamic'

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('products') && !perms.includes('products:write')) {
    redirect('/dashboard')
  }

  const { id } = await params
  const [productRes, brandsRes, categoriesRes] = await Promise.all([
    withUniformsScope(admin.from('products').select('*').eq('id', id)).single(),
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
  ])

  if (productRes.error || !productRes.data) notFound()

  return (
    <ProductEditor
      product={productRes.data as ProductDetail}
      brands={(brandsRes.data || []) as BrandRef[]}
      categories={(categoriesRes.data || []) as CategoryRef[]}
    />
  )
}
```

- [ ] **Step 4: Manual verify**

Run dev server. Navigate to a product from the list. The editor shell loads with five clickable tabs and placeholder text per tab. URL hash updates as you switch tabs. Refresh with `#sizes` — opens on that tab.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/TabNav.tsx src/components/products/ProductEditor.tsx src/app/(portal)/products/[id]/page.tsx
git commit -m "feat(products): tabbed editor shell with hash-synced tab state"
```

---

## Task 15: DetailsTab — full edit form (no save yet)

**Files:**
- Create: `src/components/products/tabs/DetailsTab.tsx`

- [ ] **Step 1: Write DetailsTab UI**

Create `src/components/products/tabs/DetailsTab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TagCheckboxGroup } from '../TagCheckboxGroup'
import { GARMENT_FAMILIES } from '@/lib/products/garment-families'
import { PRODUCT_TYPE_TAGS, type ProductTypeTag } from '@/lib/products/tags'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

interface Props {
  product: ProductDetail
  brands: BrandRef[]
  categories: CategoryRef[]
  onSave: (patch: Record<string, unknown>) => Promise<void>
  onDelete: () => Promise<void>
  saving: boolean
  errors: Record<string, string>
}

function readTypeTags(tags: string[]): ProductTypeTag[] {
  return tags.filter((t): t is ProductTypeTag =>
    (PRODUCT_TYPE_TAGS as readonly string[]).includes(t)
  )
}

export function DetailsTab({
  product,
  brands,
  categories,
  onSave,
  onDelete,
  saving,
  errors,
}: Props) {
  const [form, setForm] = useState({
    name: product.name ?? '',
    sku: product.sku ?? '',
    supplier_code: product.supplier_code ?? '',
    code: product.code ?? '',
    description: product.description ?? '',
    brand_id: product.brand_id ?? '',
    category_id: product.category_id ?? '',
    garment_family: product.garment_family ?? '',
    industry: (product.industry || []).join(', '),
    default_sizes: (product.default_sizes || []).join(', '),
    base_cost: product.base_cost == null ? '' : String(product.base_cost),
    markup_pct: String(product.markup_pct ?? 0),
    decoration_eligible: !!product.decoration_eligible,
    decoration_price: String(product.decoration_price ?? 0),
    specs: product.specs ? JSON.stringify(product.specs, null, 2) : '',
    safety_standard: product.safety_standard ?? '',
    moq: String(product.moq ?? 24),
    lead_time_days: String(product.lead_time_days ?? 14),
    sizing_type: product.sizing_type ?? 'multi_size',
    supports_labels: !!product.supports_labels,
    is_hero: !!product.is_hero,
    is_active: !!product.is_active,
    type_tags: readTypeTags(product.tags || []),
  })

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      ...form,
      tags: form.type_tags,
    })
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    await onDelete()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name *" error={errors.name}>
            <Input value={form.name} onChange={e => patch('name', e.target.value)} required />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={e => patch('sku', e.target.value)} />
          </Field>
          <Field label="Supplier code">
            <Input
              value={form.supplier_code}
              onChange={e => patch('supplier_code', e.target.value)}
            />
          </Field>
          <Field label="Internal code">
            <Input value={form.code} onChange={e => patch('code', e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={e => patch('description', e.target.value)}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Classification</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Brand *" error={errors.brand_id}>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.brand_id}
              onChange={e => patch('brand_id', e.target.value)}
              required
            >
              <option value="">Select brand...</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category *" error={errors.category_id}>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.category_id}
              onChange={e => patch('category_id', e.target.value)}
              required
            >
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Garment family">
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.garment_family}
              onChange={e => patch('garment_family', e.target.value)}
            >
              <option value="">—</option>
              {GARMENT_FAMILIES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Industry (comma-separated)">
            <Input
              value={form.industry}
              onChange={e => patch('industry', e.target.value)}
              placeholder="trades, healthcare, ..."
            />
          </Field>
        </div>
        <TagCheckboxGroup
          legend="Product type"
          value={form.type_tags}
          onChange={tags => patch('type_tags', tags)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Pricing & costs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Base cost (NZD)">
            <Input
              type="number"
              step="0.01"
              value={form.base_cost}
              onChange={e => patch('base_cost', e.target.value)}
            />
          </Field>
          <Field label="Markup %">
            <Input
              type="number"
              step="0.01"
              value={form.markup_pct}
              onChange={e => patch('markup_pct', e.target.value)}
            />
          </Field>
          <Field label="Decoration price">
            <Input
              type="number"
              step="0.01"
              value={form.decoration_price}
              onChange={e => patch('decoration_price', e.target.value)}
            />
          </Field>
          <Field label=" ">
            <label className="inline-flex items-center gap-2 text-sm h-10">
              <input
                type="checkbox"
                checked={form.decoration_eligible}
                onChange={e => patch('decoration_eligible', e.target.checked)}
              />
              Decoration eligible
            </label>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Specs & ops</h2>
        <Field label="Specs (JSON)" error={errors.specs}>
          <Textarea
            value={form.specs}
            onChange={e => patch('specs', e.target.value)}
            placeholder='{"weight_gsm": 200}'
            className="font-mono text-xs"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Safety standard">
            <Input
              value={form.safety_standard}
              onChange={e => patch('safety_standard', e.target.value)}
            />
          </Field>
          <Field label="MOQ">
            <Input
              type="number"
              value={form.moq}
              onChange={e => patch('moq', e.target.value)}
            />
          </Field>
          <Field label="Lead time (days)">
            <Input
              type="number"
              value={form.lead_time_days}
              onChange={e => patch('lead_time_days', e.target.value)}
            />
          </Field>
          <Field label="Sizing type">
            <Input
              value={form.sizing_type}
              onChange={e => patch('sizing_type', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Default sizes (comma-separated)">
          <Input
            value={form.default_sizes}
            onChange={e => patch('default_sizes', e.target.value)}
            placeholder="S, M, L, XL"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Flags</h2>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.supports_labels}
              onChange={e => patch('supports_labels', e.target.checked)}
            />
            Supports labels
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_hero}
              onChange={e => patch('is_hero', e.target.checked)}
            />
            Hero product
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => patch('is_active', e.target.checked)}
            />
            Active
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-1 text-xs text-gray-500">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Read-only</h2>
        <p>
          Shopify:{' '}
          {product.shopify_product_id ? (
            <span className="font-mono">{product.shopify_product_id}</span>
          ) : (
            'Not synced'
          )}
        </p>
        <p>Platform: {product.platform}</p>
        <p>
          Created {product.created_at || '—'} · Updated {product.updated_at}
        </p>
      </section>

      {errors._root && <p className="text-sm text-red-600">{errors._root}</p>}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
          Delete product
        </Button>
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? 'Saving...' : 'Save details'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/tabs/DetailsTab.tsx
git commit -m "feat(products): Details tab UI"
```

---

## Task 16: Wire DetailsTab into ProductEditor with save and delete

**Files:**
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 1: Replace placeholder with DetailsTab integration**

In `src/components/products/ProductEditor.tsx`:

1. Add imports at the top:

```tsx
import { useRouter } from 'next/navigation'
import { DetailsTab } from './tabs/DetailsTab'
```

2. In the `ProductEditor` function, add state:

```tsx
  const router = useRouter()
  const [product, setProduct] = useState<ProductDetail>(props.product)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({})
```

(Adjust the function signature to take `props` then destructure: `export function ProductEditor(props: Props) {` and use `props.brands`, `props.categories`, `props.product` only for the initial state.)

3. Add handlers:

```tsx
  async function saveDetails(patch: Record<string, unknown>) {
    setSavingDetails(true)
    setDetailsErrors({})
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) {
        setDetailsErrors(json.errors || { _root: json.error || 'Failed to save.' })
        return
      }
      setProduct(json.product as ProductDetail)
    } finally {
      setSavingDetails(false)
    }
  }

  async function deleteProduct() {
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    if (!res.ok) {
      window.alert('Failed to delete.')
      return
    }
    router.push('/products')
  }
```

4. Replace the `Details` placeholder branch with:

```tsx
        {active === 'details' && (
          <DetailsTab
            product={product}
            brands={props.brands}
            categories={props.categories}
            onSave={saveDetails}
            onDelete={deleteProduct}
            saving={savingDetails}
            errors={detailsErrors}
          />
        )}
```

5. Remove the old delete-button placeholder line in the header (the button is now in DetailsTab).

- [ ] **Step 2: Manual verify**

Run dev server. Open an existing product. Edit name → save → page refreshes with new name in header. Tick a tag → save → reload → tag persists. Add invalid JSON to specs → save → see inline `Specs must be valid JSON.` Delete a test product → redirects to `/products`, row gone.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ProductEditor.tsx
git commit -m "feat(products): wire Details tab save/delete to API"
```

> **CHECKPOINT C** — Create + Details edit + delete round-trip. Stop. Ask the user to compare a few uniforms products against middleware-pr to confirm parity on the Details surface before sub-resources.

---

## Task 17: Swatches API + SwatchesTab

**Files:**
- Create: `src/app/api/products/[id]/swatches/route.ts`
- Create: `src/app/api/products/[id]/swatches/[swatchId]/route.ts`
- Create: `src/components/products/tabs/SwatchesTab.tsx`
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 1: Write swatches list/create route**

Create `src/app/api/products/[id]/swatches/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('product_color_swatches')
    .select('*')
    .eq('product_id', id)
    .order('position')

  if (error) return dbErrorResponse(error, 'Failed to load swatches.')
  return NextResponse.json({ swatches: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { label?: string; hex?: string; image_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const label = (body.label || '').trim() || 'Unnamed'
  const hex = (body.hex || '').trim() || '#000000'
  const image_url = body.image_url ? String(body.image_url).trim() || null : null

  const { data: existingSwatches } = await access.admin
    .from('product_color_swatches')
    .select('position')
    .eq('product_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition =
    existingSwatches && existingSwatches.length > 0
      ? (existingSwatches[0].position || 0) + 1
      : 0

  const { data, error } = await access.admin
    .from('product_color_swatches')
    .insert({
      product_id: id,
      label,
      hex,
      image_url,
      position: nextPosition,
      is_active: true,
    })
    .select('*')
    .single()

  if (error || !data) return dbErrorResponse(error, 'Failed to add swatch.')
  return NextResponse.json({ swatch: data }, { status: 201 })
}
```

- [ ] **Step 2: Write swatch update/delete route**

Create `src/app/api/products/[id]/swatches/[swatchId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; swatchId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, swatchId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { label?: string; hex?: string; image_url?: string | null; position?: number; is_active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (typeof body.label === 'string') update.label = body.label.trim() || 'Unnamed'
  if (typeof body.hex === 'string') update.hex = body.hex.trim() || '#000000'
  if (body.image_url !== undefined) update.image_url = body.image_url ? String(body.image_url).trim() || null : null
  if (typeof body.position === 'number') update.position = body.position
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await access.admin
    .from('product_color_swatches')
    .update(update)
    .eq('id', swatchId)
    .eq('product_id', id)
    .select('*')
    .single()

  if (error || !data) return dbErrorResponse(error, 'Failed to update swatch.')
  return NextResponse.json({ swatch: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; swatchId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, swatchId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_color_swatches')
    .delete()
    .eq('id', swatchId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete swatch.')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write SwatchesTab**

Create `src/components/products/tabs/SwatchesTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SwatchRow } from '@/types/products'

interface Props {
  productId: string
}

export function SwatchesTab({ productId }: Props) {
  const [items, setItems] = useState<SwatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ label: '', hex: '#000000', image_url: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/swatches`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.swatches || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/swatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.swatch])
        setDraft({ label: '', hex: '#000000', image_url: '' })
      } else {
        window.alert(json.error || 'Failed to add swatch.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<SwatchRow>) {
    const res = await fetch(`/api/products/${productId}/swatches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) setItems(prev => prev.map(s => (s.id === id ? json.swatch : s)))
    else window.alert(json.error || 'Failed to update swatch.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this swatch?')) return
    const res = await fetch(`/api/products/${productId}/swatches/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(s => s.id !== id))
    else window.alert('Failed to delete swatch.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading swatches...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(s => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.hex}
                onChange={e => update(s.id, { hex: e.target.value })}
                className="w-10 h-10 rounded border border-gray-200"
              />
              <Input
                value={s.label}
                onChange={e => update(s.id, { label: e.target.value })}
                className="flex-1"
              />
            </div>
            <Input
              placeholder="Image URL (optional)"
              value={s.image_url || ''}
              onChange={e => update(s.id, { image_url: e.target.value })}
            />
            <div className="flex justify-between items-center">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={s.is_active}
                  onChange={e => update(s.id, { is_active: e.target.checked })}
                />
                Active
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(s.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add swatch</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <input
            type="color"
            value={draft.hex}
            onChange={e => setDraft({ ...draft, hex: e.target.value })}
            className="w-12 h-10 rounded border border-gray-200"
          />
          <Input
            placeholder="Label (e.g. Navy)"
            value={draft.label}
            onChange={e => setDraft({ ...draft, label: e.target.value })}
          />
          <Input
            placeholder="Image URL (optional)"
            value={draft.image_url}
            onChange={e => setDraft({ ...draft, image_url: e.target.value })}
          />
          <Button type="button" variant="accent" onClick={add} disabled={busy}>
            {busy ? 'Adding...' : 'Add swatch'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire SwatchesTab into ProductEditor**

In `ProductEditor.tsx`, import `SwatchesTab` and replace the placeholder:

```tsx
        {active === 'swatches' && <SwatchesTab productId={product.id} />}
```

- [ ] **Step 5: Manual verify**

Open a product, switch to Swatches. List loads. Add a Navy `#001f3f` swatch with image URL → appears. Edit hex live → saves on blur (well, on every change — note that's per-keystroke; if it's too chatty for the user, plan a v1.1 debounce — record this as a known limitation). Delete it.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/[id]/swatches src/components/products/tabs/SwatchesTab.tsx src/components/products/ProductEditor.tsx
git commit -m "feat(products): swatches CRUD API and Swatches tab"
```

---

## Task 18: Sizes API + SizesTab

**Files:**
- Create: `src/app/api/products/[id]/sizes/route.ts`
- Create: `src/app/api/products/[id]/sizes/quick-add/route.ts`
- Create: `src/app/api/products/[id]/sizes/[sizeId]/route.ts`
- Create: `src/components/products/tabs/SizesTab.tsx`
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 1: Write sizes list/create route**

Create `src/app/api/products/[id]/sizes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('sizes')
    .select('*')
    .eq('product_id', id)
    .order('order_index')
  if (error) return dbErrorResponse(error, 'Failed to load sizes.')
  return NextResponse.json({ sizes: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { label?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const label = (body.label || '').trim() || 'One Size'

  const { data: maxRow } = await access.admin
    .from('sizes')
    .select('order_index')
    .eq('product_id', id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIdx = maxRow && maxRow.length > 0 ? (maxRow[0].order_index || 0) + 1 : 1

  const { data, error } = await access.admin
    .from('sizes')
    .insert({ product_id: id, label, order_index: nextIdx })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add size.')
  return NextResponse.json({ size: data }, { status: 201 })
}
```

- [ ] **Step 2: Write quick-add route**

Create `src/app/api/products/[id]/sizes/quick-add/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'] as const

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data: existingSizes } = await access.admin
    .from('sizes')
    .select('label, order_index')
    .eq('product_id', id)

  const labels = new Set((existingSizes || []).map(r => r.label))
  const maxIndex = (existingSizes || []).reduce(
    (max, r) => Math.max(max, r.order_index || 0),
    0
  )

  const toAdd = STANDARD_SIZES.filter(s => !labels.has(s)).map((label, i) => ({
    product_id: id,
    label,
    order_index: maxIndex + i + 1,
  }))

  if (toAdd.length === 0) {
    const { data, error } = await access.admin
      .from('sizes')
      .select('*')
      .eq('product_id', id)
      .order('order_index')
    if (error) return dbErrorResponse(error, 'Failed to reload sizes.')
    return NextResponse.json({ sizes: data || [], added: 0 })
  }

  const { error: insertErr } = await access.admin.from('sizes').insert(toAdd)
  if (insertErr) return dbErrorResponse(insertErr, 'Failed to add sizes.')

  const { data, error } = await access.admin
    .from('sizes')
    .select('*')
    .eq('product_id', id)
    .order('order_index')
  if (error) return dbErrorResponse(error, 'Failed to reload sizes.')
  return NextResponse.json({ sizes: data || [], added: toAdd.length })
}
```

- [ ] **Step 3: Write size delete route**

Create `src/app/api/products/[id]/sizes/[sizeId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sizeId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, sizeId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const sizeIdInt = parseInt(sizeId, 10)
  if (!Number.isFinite(sizeIdInt)) {
    return NextResponse.json({ error: 'Invalid size id.' }, { status: 400 })
  }

  const { error } = await access.admin
    .from('sizes')
    .delete()
    .eq('id', sizeIdInt)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete size.')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write SizesTab**

Create `src/components/products/tabs/SizesTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SizeRow } from '@/types/products'

interface Props {
  productId: string
}

export function SizesTab({ productId }: Props) {
  const [items, setItems] = useState<SizeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/sizes`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.sizes || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function quickAdd() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/sizes/quick-add`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) setItems(json.sizes || [])
      else window.alert(json.error || 'Failed to add standard sizes.')
    } finally {
      setBusy(false)
    }
  }

  async function addCustom() {
    if (!custom.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/sizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: custom.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.size])
        setCustom('')
      } else window.alert(json.error || 'Failed to add size.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(sizeId: number) {
    if (!window.confirm('Delete this size?')) return
    const res = await fetch(`/api/products/${productId}/sizes/${sizeId}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(s => s.id !== sizeId))
    else window.alert('Failed to delete size.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading sizes...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {items.map(s => (
          <Badge key={s.id} variant="gray" className="text-sm gap-2">
            {s.label}
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="text-gray-400 hover:text-red-600"
              aria-label={`Delete ${s.label}`}
            >
              ×
            </button>
          </Badge>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No sizes yet.</p>}
      </div>

      <div className="flex flex-wrap gap-3 items-center border-t border-gray-100 pt-4">
        <Button type="button" variant="secondary" onClick={quickAdd} disabled={busy}>
          Add standard sizes (XS-5XL)
        </Button>
        <span className="text-xs text-gray-400">or</span>
        <Input
          placeholder="Custom size label"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant="accent" onClick={addCustom} disabled={busy || !custom.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire into ProductEditor**

In `ProductEditor.tsx` import `SizesTab` and replace the sizes placeholder with `<SizesTab productId={product.id} />`.

- [ ] **Step 6: Manual verify**

On a product, Sizes tab. Quick-add → adds missing standard sizes only. Add `One Size` custom → appears. Delete one → gone.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/products/[id]/sizes src/components/products/tabs/SizesTab.tsx src/components/products/ProductEditor.tsx
git commit -m "feat(products): sizes CRUD API and Sizes tab with quick-add"
```

---

## Task 19: Images API + ImagesTab

**Files:**
- Create: `src/app/api/products/[id]/images/route.ts`
- Create: `src/app/api/products/[id]/images/[imageId]/route.ts`
- Create: `src/components/products/tabs/ImagesTab.tsx`
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 1: Write images list/create route**

Create `src/app/api/products/[id]/images/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const ALLOWED_VIEWS = ['front', 'back', 'side', 'detail'] as const
type View = (typeof ALLOWED_VIEWS)[number]

function isView(v: unknown): v is View {
  return typeof v === 'string' && (ALLOWED_VIEWS as readonly string[]).includes(v)
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('position')
  if (error) return dbErrorResponse(error, 'Failed to load images.')
  return NextResponse.json({ images: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { file_url?: string; view?: string; alt_text?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const fileUrl = (body.file_url || '').trim()
  if (!fileUrl) return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 })
  if (!isHttpUrl(fileUrl)) return NextResponse.json({ error: 'Image URL must be http(s).' }, { status: 400 })

  const view = isView(body.view) ? body.view : null
  const altText = body.alt_text ? String(body.alt_text).trim() || null : null

  const { data: maxRow } = await access.admin
    .from('product_images')
    .select('position')
    .eq('product_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = maxRow && maxRow.length > 0 ? (maxRow[0].position || 0) + 1 : 0

  const { data, error } = await access.admin
    .from('product_images')
    .insert({
      product_id: id,
      file_url: fileUrl,
      view,
      alt_text: altText,
      position: nextPosition,
      image_type: 'product',
    })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add image.')
  return NextResponse.json({ image: data }, { status: 201 })
}
```

- [ ] **Step 2: Write image update/delete route**

Create `src/app/api/products/[id]/images/[imageId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const ALLOWED_VIEWS = ['front', 'back', 'side', 'detail'] as const
type View = (typeof ALLOWED_VIEWS)[number]

function isView(v: unknown): v is View {
  return typeof v === 'string' && (ALLOWED_VIEWS as readonly string[]).includes(v)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, imageId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { view?: string; alt_text?: string | null; position?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (body.view !== undefined) update.view = isView(body.view) ? body.view : null
  if (body.alt_text !== undefined) update.alt_text = body.alt_text ? String(body.alt_text).trim() || null : null
  if (typeof body.position === 'number') update.position = body.position

  const { data, error } = await access.admin
    .from('product_images')
    .update(update)
    .eq('id', imageId)
    .eq('product_id', id)
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to update image.')
  return NextResponse.json({ image: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, imageId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_images')
    .delete()
    .eq('id', imageId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete image.')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write ImagesTab**

Create `src/components/products/tabs/ImagesTab.tsx`:

```tsx
'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ImageRow } from '@/types/products'

const VIEWS: Array<{ value: string; label: string }> = [
  { value: '', label: '—' },
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side', label: 'Side' },
  { value: 'detail', label: 'Detail' },
]

interface Props {
  productId: string
}

export function ImagesTab({ productId }: Props) {
  const [items, setItems] = useState<ImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ file_url: '', view: '', alt_text: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/images`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.images || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    if (!draft.file_url.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.image])
        setDraft({ file_url: '', view: '', alt_text: '' })
      } else window.alert(json.error || 'Failed to add image.')
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<ImageRow>) {
    const res = await fetch(`/api/products/${productId}/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) setItems(prev => prev.map(i => (i.id === id ? json.image : i)))
    else window.alert(json.error || 'Failed to update image.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this image?')) return
    const res = await fetch(`/api/products/${productId}/images/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    else window.alert('Failed to delete image.')
  }

  async function makePrimary(id: string) {
    // "Primary" = position 0; bump others.
    const target = items.find(i => i.id === id)
    if (!target) return
    await update(id, { position: -1 }) // place ahead of all
    setItems(prev => {
      const re = [target, ...prev.filter(i => i.id !== id)]
      return re.map((img, idx) => ({ ...img, position: idx }))
    })
  }

  if (loading) return <p className="text-sm text-gray-500">Loading images...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((img, idx) => (
          <div key={img.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
              <Image
                src={img.file_url}
                alt={img.alt_text || ''}
                width={300}
                height={300}
                unoptimized
                className="object-cover w-full h-full"
              />
            </div>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs"
              value={img.view || ''}
              onChange={e => update(img.id, { view: e.target.value || null })}
            >
              {VIEWS.map(v => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Alt text"
              value={img.alt_text || ''}
              onChange={e => update(img.id, { alt_text: e.target.value })}
              className="text-xs"
            />
            <div className="flex justify-between items-center">
              {idx === 0 ? (
                <span className="text-xs text-emerald-700 font-medium">Primary</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => makePrimary(img.id)}>
                  Set primary
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(img.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add image</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <Input
            placeholder="https://..."
            value={draft.file_url}
            onChange={e => setDraft({ ...draft, file_url: e.target.value })}
            className="md:col-span-2"
          />
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={draft.view}
            onChange={e => setDraft({ ...draft, view: e.target.value })}
          >
            {VIEWS.map(v => (
              <option key={v.value} value={v.value}>
                {v.label || 'View (optional)'}
              </option>
            ))}
          </select>
          <Button type="button" variant="accent" onClick={add} disabled={busy || !draft.file_url.trim()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire into ProductEditor**

In `ProductEditor.tsx` import `ImagesTab` and replace the images placeholder with `<ImagesTab productId={product.id} />`.

- [ ] **Step 5: Manual verify**

Open Images tab. Add a public PNG URL (e.g. a Supabase storage URL). Image renders. Edit alt text → saves on each keystroke (chatty but acceptable v1). Set-primary moves the image to slot 0. Delete works.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/[id]/images src/components/products/tabs/ImagesTab.tsx src/components/products/ProductEditor.tsx
git commit -m "feat(products): images CRUD API and Images tab"
```

---

## Task 20: Pricing tiers API + PricingTab

**Files:**
- Create: `src/app/api/products/[id]/pricing-tiers/route.ts`
- Create: `src/app/api/products/[id]/pricing-tiers/[tierId]/route.ts`
- Create: `src/components/products/tabs/PricingTab.tsx`
- Modify: `src/components/products/ProductEditor.tsx`

- [ ] **Step 1: Write pricing list/create route**

Create `src/app/api/products/[id]/pricing-tiers/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .select('*')
    .eq('product_id', id)
    .order('min_quantity')
  if (error) return dbErrorResponse(error, 'Failed to load pricing tiers.')
  return NextResponse.json({ tiers: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { min_quantity?: number; max_quantity?: number | null; unit_price?: number; currency?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const minQ = Number(body.min_quantity)
  const maxQ = body.max_quantity == null ? null : Number(body.max_quantity)
  const price = Number(body.unit_price)
  const currency = (body.currency || 'NZD').trim() || 'NZD'

  if (!Number.isFinite(minQ) || minQ < 1) {
    return NextResponse.json({ error: 'min_quantity must be a positive integer.' }, { status: 400 })
  }
  if (maxQ != null && (!Number.isFinite(maxQ) || maxQ < minQ)) {
    return NextResponse.json({ error: 'max_quantity must be >= min_quantity (or null).' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'unit_price must be a non-negative number.' }, { status: 400 })
  }

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .insert({
      product_id: id,
      min_quantity: minQ,
      max_quantity: maxQ,
      unit_price: price,
      currency,
      tier_level: 1,
      is_active: true,
    })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add pricing tier.')
  return NextResponse.json({ tier: data }, { status: 201 })
}
```

- [ ] **Step 2: Write pricing update/delete route**

Create `src/app/api/products/[id]/pricing-tiers/[tierId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, tierId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { min_quantity?: number; max_quantity?: number | null; unit_price?: number; currency?: string; is_active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (body.min_quantity !== undefined) {
    const minQ = Number(body.min_quantity)
    if (!Number.isFinite(minQ) || minQ < 1) {
      return NextResponse.json({ error: 'min_quantity must be a positive integer.' }, { status: 400 })
    }
    update.min_quantity = minQ
  }
  if (body.max_quantity !== undefined) {
    if (body.max_quantity === null) update.max_quantity = null
    else {
      const maxQ = Number(body.max_quantity)
      if (!Number.isFinite(maxQ) || maxQ < 1) {
        return NextResponse.json({ error: 'max_quantity must be a positive integer or null.' }, { status: 400 })
      }
      update.max_quantity = maxQ
    }
  }
  if (body.unit_price !== undefined) {
    const price = Number(body.unit_price)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'unit_price must be non-negative.' }, { status: 400 })
    }
    update.unit_price = price
  }
  if (body.currency !== undefined) update.currency = String(body.currency).trim() || 'NZD'
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .update(update)
    .eq('id', tierId)
    .eq('product_id', id)
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to update tier.')
  return NextResponse.json({ tier: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, tierId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_pricing_tiers')
    .delete()
    .eq('id', tierId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete tier.')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write PricingTab**

Create `src/components/products/tabs/PricingTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PricingTierRow } from '@/types/products'

interface Props {
  productId: string
}

export function PricingTab({ productId }: Props) {
  const [items, setItems] = useState<PricingTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ min_quantity: '', max_quantity: '', unit_price: '', currency: 'NZD' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/pricing-tiers`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.tiers || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/pricing-tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_quantity: parseInt(draft.min_quantity, 10),
          max_quantity: draft.max_quantity ? parseInt(draft.max_quantity, 10) : null,
          unit_price: parseFloat(draft.unit_price),
          currency: draft.currency,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.tier].sort((a, b) => a.min_quantity - b.min_quantity))
        setDraft({ min_quantity: '', max_quantity: '', unit_price: '', currency: 'NZD' })
      } else window.alert(json.error || 'Failed to add tier.')
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<PricingTierRow>) {
    const res = await fetch(`/api/products/${productId}/pricing-tiers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) {
      setItems(prev =>
        prev.map(t => (t.id === id ? json.tier : t)).sort((a, b) => a.min_quantity - b.min_quantity)
      )
    } else window.alert(json.error || 'Failed to update tier.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this pricing tier?')) return
    const res = await fetch(`/api/products/${productId}/pricing-tiers/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(t => t.id !== id))
    else window.alert('Failed to delete tier.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading pricing tiers...</p>

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-500 text-left">
            <th className="py-2 pr-2">Min qty</th>
            <th className="py-2 pr-2">Max qty</th>
            <th className="py-2 pr-2">Unit price</th>
            <th className="py-2 pr-2">Currency</th>
            <th className="py-2 pr-2">Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id} className="border-t border-gray-100">
              <td className="py-2 pr-2 w-24">
                <Input
                  type="number"
                  defaultValue={t.min_quantity}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10)
                    if (Number.isFinite(v) && v !== t.min_quantity) update(t.id, { min_quantity: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-24">
                <Input
                  type="number"
                  defaultValue={t.max_quantity ?? ''}
                  placeholder="∞"
                  onBlur={e => {
                    const raw = e.target.value
                    const next = raw === '' ? null : parseInt(raw, 10)
                    update(t.id, { max_quantity: next == null || Number.isFinite(next) ? next : t.max_quantity })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-28">
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={t.unit_price}
                  onBlur={e => {
                    const v = parseFloat(e.target.value)
                    if (Number.isFinite(v) && v !== t.unit_price) update(t.id, { unit_price: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-20">
                <Input
                  defaultValue={t.currency}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    if (v && v !== t.currency) update(t.id, { currency: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  checked={t.is_active}
                  onChange={e => update(t.id, { is_active: e.target.checked })}
                />
              </td>
              <td className="py-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-sm text-gray-500 py-4 text-center">
                No pricing tiers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add tier</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Input
            type="number"
            placeholder="Min qty"
            value={draft.min_quantity}
            onChange={e => setDraft({ ...draft, min_quantity: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Max qty (blank = ∞)"
            value={draft.max_quantity}
            onChange={e => setDraft({ ...draft, max_quantity: e.target.value })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Unit price"
            value={draft.unit_price}
            onChange={e => setDraft({ ...draft, unit_price: e.target.value })}
          />
          <Input
            placeholder="Currency"
            value={draft.currency}
            onChange={e => setDraft({ ...draft, currency: e.target.value })}
          />
          <Button
            type="button"
            variant="accent"
            onClick={add}
            disabled={busy || !draft.min_quantity || !draft.unit_price}
          >
            {busy ? 'Adding...' : 'Add tier'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire into ProductEditor**

In `ProductEditor.tsx` import `PricingTab` and replace the pricing placeholder with `<PricingTab productId={product.id} />`.

- [ ] **Step 5: Manual verify**

Add tiers `1-11 @ $25`, `12-23 @ $20`, `24-NULL @ $15`. Sorted by min_qty. Edit a unit price → blurs and saves. Toggle active → saves. Delete a tier.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/[id]/pricing-tiers src/components/products/tabs/PricingTab.tsx src/components/products/ProductEditor.tsx
git commit -m "feat(products): pricing tiers CRUD API and Pricing tab"
```

---

## Task 21: Permission denial UX polish

**Files:**
- Modify: `src/app/(portal)/products/page.tsx`
- Modify: `src/app/(portal)/products/new/page.tsx`
- Modify: `src/app/(portal)/products/[id]/page.tsx`

- [ ] **Step 1: Replace silent dashboard redirects with a friendly inline message**

In each of the three server pages, replace the `redirect('/dashboard')` permission branch with rendering a 403 block:

```tsx
  if (!isAdmin && !perms.includes('products') && !perms.includes('products:write')) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Products is restricted</h1>
        <p className="text-sm text-gray-500 mt-2">
          Ask an admin to grant the <code>products</code> permission on your staff account.
        </p>
      </div>
    )
  }
```

Remove the now-unused `redirect` import where applicable, but keep it for the `if (!user) redirect('/sign-in')` line.

- [ ] **Step 2: Manual verify**

Sign in as a staff user without `products` permission. Visit `/products` → see the friendly message instead of bouncing to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(portal)/products
git commit -m "feat(products): friendlier permission denial UX"
```

> **CHECKPOINT D** — All four sub-resource tabs work and permission UX is polished. Stop. Ask the user to round-trip several products end-to-end against middleware-pr to confirm parity.

---

## Task 22: README pointer + final lint and typecheck

**Files:**
- Modify: `README.md` (or `docs/superpowers/specs/2026-04-20-staff-portal-products-subapp-design.md` — append a "Status: Implemented" line)

- [ ] **Step 1: Append a status note to the spec**

In `docs/superpowers/specs/2026-04-20-staff-portal-products-subapp-design.md`, change the front-matter Status line:

```markdown
**Status:** Implemented (2026-04-20). v1 live; v1.1 follow-ups tracked in §11.
```

- [ ] **Step 2: Run lint**

Run: `cd "C:/Users/MSI/Documents/Projects/print-room-staff-portal" && npm run lint`
Expected: PASS, zero new warnings.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS. (Resolves any Next.js 16 production-build pitfalls before announcement.)

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs(products): mark spec as implemented"
```

---

## Task 23: Decommission-readiness checklist

**Files:**
- Create: `docs/superpowers/plans/2026-04-20-staff-portal-products-subapp-cutover-checklist.md` (separate file; small)

- [ ] **Step 1: Write the cutover checklist**

Create `docs/superpowers/plans/2026-04-20-staff-portal-products-subapp-cutover-checklist.md`:

```markdown
# Products sub-app — cutover checklist (1-week side-by-side run)

Per spec §9, both `middleware-pr` and the new staff-portal Products sub-app run
side-by-side for at least 1 week. Tick these items as the week progresses.

## Day 0 (announcement)
- [ ] Email/Slack staff who use middleware-pr with the new URL.
- [ ] Confirm at least one admin and one staff user have the `products` permission.
- [ ] Verify URL: `https://<staff-portal-host>/products`.

## During the week
- [ ] Spot-check 5 random products in both tools — fields match.
- [ ] Pick one product, edit in new tool, verify middleware-pr reflects.
- [ ] Pick one product, edit in middleware-pr, verify new tool reflects.
- [ ] Add/remove a tag in new tool — confirm reserved tags survive.
- [ ] Add a swatch, size, image, pricing tier in each — confirm round-trip.

## Day 7+
- [ ] No parity gaps reported.
- [ ] Pause middleware-pr Replit deployment.
- [ ] Calendar reminder for Day 37 to archive middleware-pr GitHub repo.

## v1.1 follow-ups (capture as you go)
- [ ] Add Postgres CHECK constraint on `products.tags` (commented in `sql/003_products_permission.sql`).
- [ ] Drop hard-coded `platform = 'uniforms'` filter; surface as user-selectable.
- [ ] Reconcile `products` vs `products:write` permission keys.
- [ ] Debounce per-keystroke saves on Swatches and Images tabs if staff feedback warrants.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-20-staff-portal-products-subapp-cutover-checklist.md
git commit -m "docs(products): cutover checklist for the 1-week side-by-side run"
```

> **CHECKPOINT E** — Implementation done. Sub-app live and ready for the 1-week parity run with `middleware-pr`.
