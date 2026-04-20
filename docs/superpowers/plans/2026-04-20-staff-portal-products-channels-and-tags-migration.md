# Products sub-app — Channels + Staff Tags Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split channels and open-vocabulary tags out of `products.tags text[]` into a new `product_type_activations` junction (3-state: Off / Active / Inactive) and a new `product_tag_catalog` for autocomplete, with a single-PR clean cut and no dual-write window.

**Architecture:** One Supabase migration creates both tables, backfills junction rows from existing uniforms `tags[]`, strips channel values out of `tags[]`, and seeds the catalog — all in one transaction. App code ships in the same PR: new per-channel `PUT` endpoint, new `GET /api/products/tags` catalog endpoint, list-query hydration of `channels` via a Supabase nested select, sidebar sub-nav with `?channel=` query param, `ChannelControlRow` + `TagPicker` replace the old `TagCheckboxGroup` in Details, and a `ChannelsCell` renders the new list-row column. Closed-vocab helpers in `src/lib/products/tags.ts` are deleted; a trimmed `sanitiseTagName` remains.

**Tech Stack:** Next.js 16.2.3 App Router, React 19, Tailwind v4, `@supabase/ssr` 0.10, `@supabase/supabase-js` 2.103, `lucide-react`, TypeScript 5. **No test runner is configured** — verification uses `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual browser testing via `npm run dev`.

---

## Reference: spec and existing patterns

- **Spec (authoritative):** [docs/superpowers/specs/2026-04-20-staff-portal-products-channels-and-tags-migration.md](docs/superpowers/specs/2026-04-20-staff-portal-products-channels-and-tags-migration.md)
- **Prior plan (v1 products sub-app):** [docs/superpowers/plans/2026-04-20-staff-portal-products-subapp-plan.md](docs/superpowers/plans/2026-04-20-staff-portal-products-subapp-plan.md) — codifies the file structure, permission pattern, and Supabase client conventions this migration builds on.
- **Next.js 16 docs:** `node_modules/next/dist/docs/` — `AGENTS.md` requires reading the relevant guide before touching route handlers, dynamic params, or server/client boundaries.
- **Supabase clients:** [src/lib/supabase-server.ts](src/lib/supabase-server.ts) exposes `getSupabaseServer` (auth) and `getSupabaseAdmin` (mutations via service role).
- **Auth pattern:** [src/lib/products/server.ts](src/lib/products/server.ts) — `requireProductsStaffAccess` and `requireUniformsProduct` — reuse unchanged.
- **Scope helper:** [src/lib/products/scope.ts](src/lib/products/scope.ts) — `withUniformsScope` already applies `.eq('platform','uniforms')` to query builders.
- **UI primitives:** [src/components/ui/button.tsx](src/components/ui/button.tsx), [src/components/ui/input.tsx](src/components/ui/input.tsx), [src/components/ui/badge.tsx](src/components/ui/badge.tsx). No Radix, no Headless UI — keep that discipline.
- **SQL migrations:** Numbered in `sql/` (next two slots are `004_…` and `005_…`). These files are run manually via the Supabase SQL editor; the app does not auto-run them.

## Decisions applied from the spec

Spec §10 locked these; do not re-litigate inside tasks:

- Clean-cut migration, single PR, no dual-write.
- Backfilled junction rows default to `is_active = true`; per-channel pause is forward-only.
- Backfill scope is `platform = 'uniforms'` only. Print-room rows never enter the junction in this scope.
- Tag vocabulary is open — no CHECK constraint and no per-tenant allowlist.
- No dedicated tag-admin screen; catalog autocompletes and is seeded lazily on product save.
- Per-channel `PUT` endpoint (not batch).
- List-row display is a single "Channels" column with stacked labels and `(paused)` suffix for inactive channels (option ii from the brainstorming session).

## Supabase list-query hydration approach

The spec §7.3 shows raw SQL with `jsonb_object_agg`. The supabase-js equivalent in this repo uses the existing nested-select pattern that the code already uses for `brand`/`category`:

- **Hydration (always):** `.select('…, channels:product_type_activations(product_type,is_active)')` — returns `channels` as an array of `{ product_type, is_active }` rows. Transform to `ChannelsMap` in the handler.
- **Channel filter (when `?channel=` is present):** add a second alias on the same relation using `!inner`, and constrain it: `_channel_filter:product_type_activations!inner(product_type)` + `.eq('_channel_filter.product_type', channel)`. This filters the parent product rows to those with a matching channel, while the `channels` alias still hydrates the full set of channel rows per returned product. The `_channel_filter` alias is stripped before returning to the client.

**Fallback (only if the two-alias pattern misbehaves in PostgREST):** fetch a page of product IDs first (inner-join, ID-only), then do a second query with `.in('id', ids)` that hydrates channels. This is called out in Task 7, Step 4.

## File structure to be created or modified

**New SQL:**

```text
sql/004_product_type_activations.sql   # junction table + backfill + tags[] strip (one txn)
sql/005_product_tag_catalog.sql        # catalog table + lazy seed from remaining tags
```

**New TypeScript:**

```text
src/lib/products/channels.ts                   # CHANNELS constant, types, server helpers
src/lib/products/tag-catalog.ts                # catalog read + upsert helpers
src/components/products/ChannelControlRow.tsx  # 3-pill segmented control (Off/Active/Inactive)
src/components/products/TagPicker.tsx          # combobox with autocomplete + create
src/components/products/ChannelsCell.tsx       # list-row Channels column renderer
src/app/api/products/[id]/channels/[channel]/route.ts   # PUT
src/app/api/products/tags/route.ts                       # GET
```

**Modified TypeScript:**

```text
src/types/products.ts                         # Channel, ChannelState, ChannelsMap; extend ProductSummary + ProductDetail; ProductListFilters.channel + tags_filter
src/lib/products/query.ts                     # parseListSearchParams + buildListQuery: channel filter + hydration + tag-AND filter
src/lib/products/schema.ts                    # drop sanitiseProductTags import; open-vocab tag sanitiser; channels not emitted to tags
src/lib/products/tags.ts                      # deleted OR reduced to sanitiseTagName only
src/components/products/TagCheckboxGroup.tsx  # deleted
src/components/products/ProductFilters.tsx    # remove TagCheckboxGroup; add channel select + tag multi-select
src/components/products/ProductRow.tsx        # remove tag badges; use ChannelsCell in a column
src/components/products/ProductList.tsx       # header row unchanged in count, Channels column label added
src/components/products/tabs/DetailsTab.tsx   # remove TagCheckboxGroup; mount ChannelControlRow + TagPicker
src/components/products/ProductEditor.tsx     # wire per-channel PUT callback + persist channels into product state
src/app/api/products/route.ts                 # POST accepts optional channels body; GET passes channel filter
src/app/api/products/[id]/route.ts            # GET hydrates channels; PATCH drops mergeWithReservedTags, upserts catalog
src/components/layout/Sidebar.tsx             # Products section gets 3 child entries
```

## Natural review checkpoints

Pause and ask the user to review after:

- **Checkpoint A** — after Task 2 (migrations SQL written and dry-run-verified locally; no app code changed yet).
- **Checkpoint B** — after Task 8 (all new API routes work end-to-end against the migrated DB; no UI changes yet).
- **Checkpoint C** — after Task 13 (all UI changes in; everything compiles and routes are wired).

---

## Task 1: Add channel and tag types

**Files:**

- Modify: [src/types/products.ts](src/types/products.ts)

- [ ] **Step 1: Add Channel, ChannelState, ChannelsMap types**

Open [src/types/products.ts](src/types/products.ts) and add, just below the existing `import type { GarmentFamily } …` line:

```typescript
export const CHANNELS = ['workwear', 'preorder', 'b2b'] as const
export type Channel = (typeof CHANNELS)[number]
export type ChannelState = 'active' | 'inactive'
export type ChannelsMap = Partial<Record<Channel, ChannelState>>

export const CHANNEL_LABELS: Record<Channel, string> = {
  workwear: 'Workwear',
  preorder: 'Pre-order',
  b2b: 'B2B',
}
```

- [ ] **Step 2: Extend ProductSummary and ProductDetail**

In the same file, add `channels: ChannelsMap` to both `ProductSummary` and `ProductDetail`:

```typescript
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
  channels: ChannelsMap
  shopify_product_id: string | null
  brand: BrandRef | null
  category: CategoryRef | null
}
```

```typescript
export interface ProductDetail {
  // …existing fields…
  tags: string[]
  channels: ChannelsMap
  // …remaining fields…
}
```

- [ ] **Step 3: Replace type_tags filter with channel + tags_filter**

Update `ProductListFilters` — remove `type_tags: ProductTypeTag[]`, remove the `import type { ProductTypeTag }` at the top of the file, and add two new fields:

```typescript
export interface ProductListFilters {
  search: string
  brand_id: string | null
  category_id: string | null
  garment_family: GarmentFamily | null
  channel: Channel | null
  tags_filter: string[]
  shopify: ShopifyLiveFilter
  active: ActiveFilter
  page: number
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the files we'll update in later tasks (`query.ts`, `schema.ts`, `ProductRow.tsx`, `ProductFilters.tsx`, `DetailsTab.tsx`, `ProductList.tsx`). No errors in `src/types/products.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/types/products.ts
git commit -m "feat(products): add Channel, ChannelState, ChannelsMap types"
```

---

## Task 2: Write the migration SQL

**Files:**

- Create: `sql/004_product_type_activations.sql`
- Create: `sql/005_product_tag_catalog.sql`

- [ ] **Step 1: Create 004 — junction + backfill + tags strip**

Write [sql/004_product_type_activations.sql](sql/004_product_type_activations.sql):

```sql
-- 004_product_type_activations.sql
-- Create the channel junction table, backfill from products.tags, and strip
-- channel values out of products.tags so the column is free for open-vocab
-- staff tags. All in one transaction so rollback is atomic.
--
-- Scope: platform = 'uniforms' only (per spec §5.2).
-- Idempotent: each statement uses ON CONFLICT DO NOTHING or is filter-guarded,
-- so re-running after a partial failure is safe.

begin;

create table if not exists product_type_activations (
  product_id    uuid not null references products(id) on delete cascade,
  product_type  text not null check (product_type in ('workwear','preorder','b2b')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (product_id, product_type)
);

create index if not exists product_type_activations_product_type_idx
  on product_type_activations (product_type) where is_active;

-- Seed junction rows from the channel values currently in products.tags.
-- Only uniforms rows; backfilled rows default to is_active = true.
insert into product_type_activations (product_id, product_type, is_active)
select p.id, t.tag, true
from products p
cross join lateral unnest(p.tags) as t(tag)
where p.platform = 'uniforms'
  and t.tag in ('workwear','preorder','b2b')
on conflict (product_id, product_type) do nothing;

-- Strip channel values from products.tags so the column only carries
-- open-vocab staff tags from here on. Uniforms only.
update products
set tags = array(
  select t from unnest(tags) as t
  where t not in ('workwear','preorder','b2b')
)
where platform = 'uniforms'
  and tags && array['workwear','preorder','b2b'];

commit;
```

- [ ] **Step 2: Create 005 — catalog table + lazy seed**

Write [sql/005_product_tag_catalog.sql](sql/005_product_tag_catalog.sql):

```sql
-- 005_product_tag_catalog.sql
-- Autocomplete source for the tag picker. Rows are otherwise created lazily
-- by the API on product save when an unknown name is submitted. This seed
-- pass only backfills the catalog from any staff tags that survived the 004
-- strip (e.g. 'leavers', 'design-tool'), so autocomplete works on day one.

begin;

create table if not exists product_tag_catalog (
  name        text primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references staff_users(id) on delete set null
);

insert into product_tag_catalog (name)
select distinct t
from products, unnest(tags) as t
where platform = 'uniforms'
  and t is not null
  and length(trim(t)) > 0
on conflict (name) do nothing;

commit;
```

- [ ] **Step 3: Dry-run in Supabase SQL editor (staging project)**

Run both files in order against the staging Supabase project. Capture the row counts printed by each statement — expected shape:

- `product_type_activations` row count ≈ 1× to 3× the number of uniforms products that had channel tags (most products carry one channel, some carry two).
- After the `update products` statement, zero uniforms rows should still contain any of `'workwear'`, `'preorder'`, `'b2b'` in `tags`.
- `product_tag_catalog` row count ≈ number of distinct remaining tag strings in uniforms `tags[]`.

Verification queries:

```sql
-- Should return 0.
select count(*) from products
where platform = 'uniforms'
  and tags && array['workwear','preorder','b2b'];

-- Spot-check: picks a product that previously had 'workwear' + 'b2b' and
-- confirms both junction rows exist and are active.
select p.id, p.name, pta.product_type, pta.is_active
from products p
join product_type_activations pta on pta.product_id = p.id
where p.platform = 'uniforms'
order by p.name
limit 20;
```

- [ ] **Step 4: Idempotency check — re-run both files**

Run both files again against staging. Expected:

- No errors.
- Junction row count unchanged (the `on conflict do nothing` handles duplicates).
- Catalog row count unchanged.
- `products.tags` unchanged (the `where tags && array[…]` guard makes the UPDATE a no-op the second time).

- [ ] **Step 5: Commit SQL**

```bash
git add sql/004_product_type_activations.sql sql/005_product_tag_catalog.sql
git commit -m "feat(products): add product_type_activations + product_tag_catalog migrations"
```

**→ Review checkpoint A — confirm SQL is right before touching app code.**

---

## Task 3: Channels helper library

**Files:**

- Create: [src/lib/products/channels.ts](src/lib/products/channels.ts)

- [ ] **Step 1: Write the helper module**

Write [src/lib/products/channels.ts](src/lib/products/channels.ts):

```typescript
import type { Channel, ChannelsMap, ChannelState } from '@/types/products'
import { CHANNELS } from '@/types/products'

export { CHANNELS }
export type { Channel, ChannelState, ChannelsMap }

const CHANNEL_SET: ReadonlySet<string> = new Set(CHANNELS)

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && CHANNEL_SET.has(value)
}

/** Row shape returned by the PostgREST nested select `channels:product_type_activations(product_type,is_active)`. */
export interface ChannelRow {
  product_type: string
  is_active: boolean
}

/** Transform the nested-select array into a ChannelsMap. Silently drops rows with unknown channel names — the DB CHECK prevents this in practice. */
export function rowsToChannelsMap(rows: unknown): ChannelsMap {
  if (!Array.isArray(rows)) return {}
  const out: ChannelsMap = {}
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Partial<ChannelRow>
    if (!isChannel(r.product_type)) continue
    out[r.product_type] = r.is_active ? 'active' : 'inactive'
  }
  return out
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/products/channels.ts
git commit -m "feat(products): add channels helper module"
```

---

## Task 4: Tag catalog helper library

**Files:**

- Create: [src/lib/products/tag-catalog.ts](src/lib/products/tag-catalog.ts)

- [ ] **Step 1: Write the helper module**

Write [src/lib/products/tag-catalog.ts](src/lib/products/tag-catalog.ts):

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

/** Max length for a tag. Keeps the catalog sensible without a DB constraint. */
const MAX_TAG_LEN = 48

const ALLOWED_CHAR = /^[a-z0-9][a-z0-9\- ]*$/

/** Normalise a user-entered tag name: trim, lowercase, collapse inner whitespace. Returns null if invalid / empty. */
export function sanitiseTagName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return null
  if (trimmed.length > MAX_TAG_LEN) return null
  if (!ALLOWED_CHAR.test(trimmed)) return null
  return trimmed
}

/** Sanitise an array of tag inputs and de-duplicate. Preserves first-seen order. */
export function sanitiseTagArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const name = sanitiseTagName(raw)
    if (!name) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

/** Upsert tag names into product_tag_catalog. Quiet on conflict — we only care that each name exists. */
export async function upsertTagCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  names: readonly string[],
  createdBy: string | null
): Promise<void> {
  if (names.length === 0) return
  const rows = names.map(name => ({ name, created_by: createdBy }))
  await admin
    .from('product_tag_catalog')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })
}

/** Read the catalog, optionally filtered by prefix for autocomplete. */
export async function readTagCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  prefix: string | null
): Promise<string[]> {
  let q = admin.from('product_tag_catalog').select('name').order('name')
  if (prefix && prefix.length > 0) {
    const safe = prefix.replace(/[%_]/g, '')
    q = q.ilike('name', `${safe}%`)
  }
  const { data, error } = await q.limit(500)
  if (error || !data) return []
  return data.map(r => r.name as string)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/products/tag-catalog.ts
git commit -m "feat(products): add tag catalog helper module"
```

---

## Task 5: Open-vocab schema normaliser

**Files:**

- Modify: [src/lib/products/schema.ts](src/lib/products/schema.ts)

- [ ] **Step 1: Replace tag sanitiser import**

At the top of [src/lib/products/schema.ts](src/lib/products/schema.ts), remove the line `import { sanitiseProductTags, type AllowedTag } from './tags'` and replace it with:

```typescript
import { sanitiseTagArray } from './tag-catalog'
```

- [ ] **Step 2: Widen the tags type on ProductCreatePayload**

In the same file, change the `tags` field on `ProductCreatePayload` from `AllowedTag[]` to `string[]`:

```typescript
export interface ProductCreatePayload {
  // …existing fields…
  tags: string[]
  // …remaining fields…
}
```

- [ ] **Step 3: Replace the tags normaliser call**

Inside `normaliseCommonFields`, change:

```typescript
partial.tags = sanitiseProductTags(body.tags)
```

to:

```typescript
partial.tags = sanitiseTagArray(body.tags)
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `schema.ts` are gone; errors remain in files that still reference the deleted `mergeWithReservedTags` / `sanitiseProductTags` (API routes, DetailsTab) — those get fixed later.

- [ ] **Step 5: Commit**

```bash
git add src/lib/products/schema.ts
git commit -m "refactor(products): schema normaliser uses open-vocab tag sanitiser"
```

---

## Task 6: List-query refactor — channel filter + hydration

**Files:**

- Modify: [src/lib/products/query.ts](src/lib/products/query.ts)

- [ ] **Step 1: Update imports + SUMMARY_SELECT**

Open [src/lib/products/query.ts](src/lib/products/query.ts). Remove the line `import { PRODUCT_TYPE_TAGS, type ProductTypeTag } from './tags'`. Add:

```typescript
import { CHANNELS, type Channel } from '@/types/products'
```

Replace the `SUMMARY_SELECT` constant with:

```typescript
const SUMMARY_SELECT =
  'id, name, sku, supplier_code, base_cost, is_active, image_url, garment_family, tags, shopify_product_id, brand:brands!products_brand_id_fkey(id,name), category:categories!products_category_id_fkey(id,name), channels:product_type_activations(product_type,is_active)'
```

Note the new trailing `channels:product_type_activations(product_type,is_active)` alias — this hydrates every product row with its channel rows via a single nested select.

- [ ] **Step 2: Update defaultListFilters**

Replace the body of `defaultListFilters` with:

```typescript
export function defaultListFilters(): ProductListFilters {
  return {
    search: '',
    brand_id: null,
    category_id: null,
    garment_family: null,
    channel: null,
    tags_filter: [],
    shopify: 'all',
    active: 'all',
    page: 1,
  }
}
```

- [ ] **Step 3: Update parseListSearchParams**

Replace the `typeTagsRaw` / `validTagSet` / `typeTags` lines with:

```typescript
const channelRaw = get('channel')
const channelSet: ReadonlySet<string> = new Set(CHANNELS)
const channel: Channel | null =
  channelRaw && channelSet.has(channelRaw) ? (channelRaw as Channel) : null

const tagsFilterRaw = getAll('tag')
const tagsFilter = tagsFilterRaw
  .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
  .filter(t => t.length > 0)
```

Then update the return object — remove `type_tags: typeTags`, add `channel` and `tags_filter: tagsFilter`:

```typescript
return {
  search: (get('search') || '').trim(),
  brand_id: get('brand_id') || null,
  category_id: get('category_id') || null,
  garment_family: garmentFamily,
  channel,
  tags_filter: tagsFilter,
  shopify,
  active,
  page,
}
```

- [ ] **Step 4: Update listFiltersToSearchParams**

Replace the body with:

```typescript
export function listFiltersToSearchParams(filters: ProductListFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (filters.search) sp.set('search', filters.search)
  if (filters.brand_id) sp.set('brand_id', filters.brand_id)
  if (filters.category_id) sp.set('category_id', filters.category_id)
  if (filters.garment_family) sp.set('garment_family', filters.garment_family)
  if (filters.channel) sp.set('channel', filters.channel)
  for (const tag of filters.tags_filter) sp.append('tag', tag)
  if (filters.shopify !== 'all') sp.set('shopify', filters.shopify)
  if (filters.active !== 'all') sp.set('active', filters.active)
  if (filters.page > 1) sp.set('page', String(filters.page))
  return sp
}
```

- [ ] **Step 5: Update buildListQuery**

Replace the whole function with:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildListQuery(client: SupabaseClient<any, any, any>, filters: ProductListFilters) {
  // When a channel filter is active, we add a second alias on the same
  // relation using !inner so the parent product rows are restricted to
  // those with a matching channel. The primary `channels` alias in
  // SUMMARY_SELECT continues to hydrate ALL channel rows for each
  // returned product, so the ChannelsCell can show the full picture.
  const selectClause = filters.channel
    ? `${SUMMARY_SELECT}, _channel_filter:product_type_activations!inner(product_type)`
    : SUMMARY_SELECT

  let query = withUniformsScope(
    client.from('products').select(selectClause, { count: 'exact' }).order('name')
  )

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.garment_family) query = query.eq('garment_family', filters.garment_family)

  if (filters.channel) {
    query = query.eq('_channel_filter.product_type', filters.channel)
  }

  if (filters.tags_filter.length > 0) {
    query = query.contains('tags', filters.tags_filter)
  }

  if (filters.shopify === 'live') query = query.not('shopify_product_id', 'is', null)
  else if (filters.shopify === 'not-live') query = query.is('shopify_product_id', null)

  if (filters.active === 'active') query = query.eq('is_active', true)
  else if (filters.active === 'inactive') query = query.eq('is_active', false)

  return query
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: `src/lib/products/query.ts` is clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/products/query.ts
git commit -m "refactor(products): query supports channel filter + channels hydration"
```

- [ ] **Step 8: Smoke-test the nested-alias pattern against staging**

Run the dev server: `npm run dev`. In a browser, hit the list as a staff user (already-active session) and open DevTools → Network. Confirm:

- `GET /api/products` returns each product with a `channels` array of `{product_type, is_active}` rows (may be empty for products with no channel rows).
- `GET /api/products?channel=workwear` returns only products that have a junction row for `workwear`. Each returned row's `channels` array still contains ALL that product's channels (not just `workwear`).

If the `channel=…` variant returns 0 rows unexpectedly or errors out, the aliased-`!inner` pattern is not working — fall back to the ID-then-hydrate approach documented at the top of this plan ("Fallback") and update Task 6 Step 5 accordingly.

---

## Task 7: API — hydrate channels on GET and accept channels on POST

**Files:**

- Modify: [src/app/api/products/route.ts](src/app/api/products/route.ts)
- Modify: [src/app/api/products/[id]/route.ts](src/app/api/products/[id]/route.ts)

- [ ] **Step 1: Read the Next.js 16 route-handler docs**

Open `node_modules/next/dist/docs/` and skim the route handler + dynamic params docs. Confirm that in Next 16 `params` is a `Promise` and that returning `NextResponse.json(…)` is still the idiomatic path. Per AGENTS.md this is required before modifying handlers.

- [ ] **Step 2: Rewrite the list handler in route.ts**

Open [src/app/api/products/route.ts](src/app/api/products/route.ts). At the top, replace the existing import lines:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { normaliseCreate } from '@/lib/products/schema'
import { rowsToChannelsMap, isChannel, CHANNELS } from '@/lib/products/channels'
import { sanitiseTagArray, upsertTagCatalog } from '@/lib/products/tag-catalog'
import type { ChannelState } from '@/types/products'
```

Note the dropped `import { mergeWithReservedTags } from '@/lib/products/tags'`.

Replace the `GET` handler with:

```typescript
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

  const products = (data || []).map(row => {
    const { _channel_filter, channels, ...rest } = row as Record<string, unknown>
    void _channel_filter
    return { ...rest, channels: rowsToChannelsMap(channels) }
  })

  return NextResponse.json({
    products,
    total: count || 0,
    page: filters.page,
    perPage: PRODUCTS_PER_PAGE,
  })
}
```

- [ ] **Step 3: Rewrite POST to accept channels**

In the same file, replace the `POST` handler with:

```typescript
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

  const tags = sanitiseTagArray(parsed.value.tags)
  const bodyObj = body as Record<string, unknown>
  const channelsInput = (bodyObj.channels && typeof bodyObj.channels === 'object')
    ? (bodyObj.channels as Record<string, unknown>)
    : {}

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .insert({
        ...parsed.value,
        tags,
        platform: 'uniforms',
      })
      .select('id, name')
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to create product.')

  const channelRows: { product_id: string; product_type: string; is_active: boolean }[] = []
  for (const channel of CHANNELS) {
    const state = channelsInput[channel]
    if (state === 'active' || state === 'inactive') {
      channelRows.push({
        product_id: data.id,
        product_type: channel,
        is_active: state === 'active',
      })
    }
  }

  if (channelRows.length > 0) {
    const { error: chErr } = await access.admin
      .from('product_type_activations')
      .insert(channelRows)
    if (chErr) return dbErrorResponse(chErr, 'Failed to create channel rows.')
  }

  if (tags.length > 0) {
    await upsertTagCatalog(access.admin, tags, access.context.staffId)
  }

  return NextResponse.json({ product: data }, { status: 201 })
}
```

Note `access.context.staffId` — confirm this is exposed by `requireProductsStaffAccess` (it is: see [src/lib/products/server.ts:63](src/lib/products/server.ts#L63)). Also note `isChannel` is unused here so drop it from the imports — rely on the explicit loop over `CHANNELS`.

- [ ] **Step 4: Fix the imports you just noted as unused**

At the top of [src/app/api/products/route.ts](src/app/api/products/route.ts), remove `isChannel` from the `channels` import and drop the unused `ChannelState` import:

```typescript
import { rowsToChannelsMap, CHANNELS } from '@/lib/products/channels'
import { sanitiseTagArray, upsertTagCatalog } from '@/lib/products/tag-catalog'
```

- [ ] **Step 5: Rewrite [id]/route.ts GET to hydrate channels**

Open [src/app/api/products/[id]/route.ts](src/app/api/products/[id]/route.ts). Update imports:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import { normaliseUpdate } from '@/lib/products/schema'
import { rowsToChannelsMap } from '@/lib/products/channels'
import { sanitiseTagArray, upsertTagCatalog } from '@/lib/products/tag-catalog'
```

Replace `DETAIL_SELECT`:

```typescript
const DETAIL_SELECT = '*, channels:product_type_activations(product_type,is_active)'
```

Replace the `GET` handler body (only the trailing return statement changes — everything up to `error || !data` stays):

```typescript
  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { channels, ...rest } = data as Record<string, unknown>
  return NextResponse.json({
    product: { ...rest, channels: rowsToChannelsMap(channels) },
  })
}
```

- [ ] **Step 6: Rewrite PATCH — drop mergeWithReservedTags, upsert catalog**

In the same file, replace the `PATCH` handler with:

```typescript
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

  const tags = sanitiseTagArray(parsed.value.tags ?? [])

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .update({ ...parsed.value, tags, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(DETAIL_SELECT)
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to update product.')

  if (tags.length > 0) {
    await upsertTagCatalog(access.admin, tags, access.context.staffId)
  }

  const { channels, ...rest } = data as Record<string, unknown>
  return NextResponse.json({
    product: { ...rest, channels: rowsToChannelsMap(channels) },
  })
}
```

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: both clean. Remaining TS errors elsewhere (DetailsTab, ProductFilters, ProductRow) are expected and will be addressed in later tasks.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/products/route.ts src/app/api/products/[id]/route.ts
git commit -m "feat(products): hydrate channels in GET; accept channels on POST; upsert tag catalog on save"
```

---

## Task 8: API — new per-channel PUT and catalog GET endpoints

**Files:**

- Create: [src/app/api/products/[id]/channels/[channel]/route.ts](src/app/api/products/[id]/channels/[channel]/route.ts)
- Create: [src/app/api/products/tags/route.ts](src/app/api/products/tags/route.ts)

- [ ] **Step 1: Write the per-channel PUT handler**

Write [src/app/api/products/[id]/channels/[channel]/route.ts](src/app/api/products/[id]/channels/[channel]/route.ts):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { isChannel, rowsToChannelsMap } from '@/lib/products/channels'

type PutState = 'off' | 'active' | 'inactive'
const VALID_STATES: ReadonlySet<string> = new Set<PutState>(['off', 'active', 'inactive'])

function isPutState(v: unknown): v is PutState {
  return typeof v === 'string' && VALID_STATES.has(v)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; channel: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id, channel } = await params
  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel.' }, { status: 400 })
  }

  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const state = (body as Record<string, unknown>)?.state
  if (!isPutState(state)) {
    return NextResponse.json({ error: 'Invalid state. Expected off | active | inactive.' }, { status: 400 })
  }

  if (state === 'off') {
    const { error } = await access.admin
      .from('product_type_activations')
      .delete()
      .eq('product_id', id)
      .eq('product_type', channel)
    if (error) return dbErrorResponse(error, 'Failed to remove channel.')
  } else {
    const { error } = await access.admin
      .from('product_type_activations')
      .upsert(
        {
          product_id: id,
          product_type: channel,
          is_active: state === 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,product_type' }
      )
    if (error) return dbErrorResponse(error, 'Failed to set channel state.')
  }

  const { data: rows, error: readErr } = await access.admin
    .from('product_type_activations')
    .select('product_type,is_active')
    .eq('product_id', id)
  if (readErr) return dbErrorResponse(readErr, 'Failed to re-read channels.')

  return NextResponse.json({ channels: rowsToChannelsMap(rows) })
}
```

- [ ] **Step 2: Write the catalog GET handler**

Write [src/app/api/products/tags/route.ts](src/app/api/products/tags/route.ts):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireProductsStaffAccess } from '@/lib/products/server'
import { readTagCatalog } from '@/lib/products/tag-catalog'

export async function GET(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const prefix = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const names = await readTagCatalog(access.admin, prefix || null)
  return NextResponse.json({ tags: names })
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: both clean (ignoring still-pending UI-side errors).

- [ ] **Step 4: Manual smoke test against staging**

Run: `npm run dev`, open DevTools → Console while signed in as a staff user with products permission.

```javascript
// 1. List: channels hydrated on every row?
fetch('/api/products').then(r => r.json()).then(j => console.log(j.products[0]))

// 2. Channel filter narrows.
fetch('/api/products?channel=workwear').then(r => r.json()).then(j => console.log(j.total))

// 3. PUT sets a channel to inactive.
// Replace <ID> with a known product id.
fetch('/api/products/<ID>/channels/workwear', {
  method: 'PUT',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({state:'inactive'})
}).then(r => r.json()).then(console.log)

// 4. PUT off removes the row.
fetch('/api/products/<ID>/channels/workwear', {
  method: 'PUT',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({state:'off'})
}).then(r => r.json()).then(console.log)

// 5. Catalog returns a list; prefix filter works.
fetch('/api/products/tags').then(r => r.json()).then(j => console.log(j.tags.length))
fetch('/api/products/tags?q=lea').then(r => r.json()).then(console.log)
```

Expected shapes:

- (1) Each product has `channels: {}` or `{workwear: 'active'}` etc.
- (2) Channel-filtered total is strictly ≤ unfiltered total.
- (3) Response: `{channels: {workwear: 'inactive', …}}`.
- (4) Response: `{channels: { …without workwear… }}`.
- (5) Non-empty array; prefix variant returns names starting with `lea`.

After verification, restore any junction rows you flipped during testing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/[id]/channels/[channel]/route.ts src/app/api/products/tags/route.ts
git commit -m "feat(products): add per-channel PUT and tag catalog GET endpoints"
```

**→ Review checkpoint B — API surface complete; UI work begins next.**

---

## Task 9: Sidebar sub-nav

**Files:**

- Modify: [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)

- [ ] **Step 1: Expand the Products section to four items**

In [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx), locate the Products entry in `NAV_SECTIONS` (around [src/components/layout/Sidebar.tsx:85](src/components/layout/Sidebar.tsx#L85)) and replace it with:

```typescript
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    permission: 'products',
    items: [
      { label: 'All Products', href: '/products', icon: Package },
      { label: 'Workwear', href: '/products?channel=workwear', icon: Package },
      { label: 'Pre-order', href: '/products?channel=preorder', icon: Package },
      { label: 'B2B', href: '/products?channel=b2b', icon: Package },
    ],
  },
```

Note: all four items share the same `/products` pathname; `usePathname()` will mark all four active when the user is on any Products page. That's fine — the auto-expand logic only needs any one of them to match, and visual distinction between "which channel am I filtering" is carried by the URL bar and the list page's own Channel select.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual test**

Run: `npm run dev`. Open the sidebar in a browser. Confirm:

- Products group expands by default on any `/products` page.
- Clicking each sub-link navigates to the right URL (`?channel=workwear` etc.) and the list narrows accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(products): sidebar sub-nav for channel-filtered lists"
```

---

## Task 10: ChannelControlRow component

**Files:**

- Create: [src/components/products/ChannelControlRow.tsx](src/components/products/ChannelControlRow.tsx)

- [ ] **Step 1: Write the component**

Write [src/components/products/ChannelControlRow.tsx](src/components/products/ChannelControlRow.tsx):

```typescript
'use client'

import { useState } from 'react'
import { CHANNEL_LABELS, CHANNELS, type Channel, type ChannelsMap } from '@/types/products'

type Cell = 'off' | 'active' | 'inactive'

interface Props {
  productId: string
  channels: ChannelsMap
  onChange: (next: ChannelsMap) => void
}

export function ChannelControlRow({ productId, channels, onChange }: Props) {
  const [busy, setBusy] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setCell(channel: Channel, next: Cell) {
    setBusy(channel)
    setError(null)
    try {
      const res = await fetch(
        `/api/products/${productId}/channels/${channel}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: next }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to update channel.')
        return
      }
      onChange(json.channels as ChannelsMap)
    } finally {
      setBusy(null)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-gray-600">Channels</legend>
      <div className="flex flex-col gap-1.5">
        {CHANNELS.map(channel => {
          const current: Cell = channels[channel] ?? 'off'
          const isBusy = busy === channel
          return (
            <div key={channel} className="flex items-center gap-3">
              <span className="text-sm text-foreground w-24">{CHANNEL_LABELS[channel]}</span>
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5">
                {(['off', 'active', 'inactive'] as const).map(cell => {
                  const selected = current === cell
                  return (
                    <button
                      key={cell}
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (cell !== current) void setCell(channel, cell)
                      }}
                      className={
                        'px-3 py-1 text-xs rounded-full transition-colors ' +
                        (selected
                          ? 'bg-white shadow text-foreground'
                          : 'text-gray-500 hover:text-foreground')
                      }
                    >
                      {cell === 'off' ? 'Off' : cell === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </fieldset>
  )
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ChannelControlRow.tsx
git commit -m "feat(products): add ChannelControlRow (3-state per channel)"
```

---

## Task 11: TagPicker component

**Files:**

- Create: [src/components/products/TagPicker.tsx](src/components/products/TagPicker.tsx)

- [ ] **Step 1: Write the component**

Write [src/components/products/TagPicker.tsx](src/components/products/TagPicker.tsx):

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

function normalise(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (t.length === 0) return null
  if (t.length > 48) return null
  if (!/^[a-z0-9][a-z0-9\- ]*$/.test(t)) return null
  return t
}

export function TagPicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = draft.trim().toLowerCase()
    if (q.length === 0) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const run = async () => {
      const res = await fetch(`/api/products/tags?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const json = await res.json()
      if (cancelled) return
      const names = Array.isArray(json.tags) ? (json.tags as string[]) : []
      setSuggestions(names.filter(n => !value.includes(n)).slice(0, 8))
    }
    void run()
    return () => { cancelled = true }
  }, [draft, value])

  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addTag(raw: string) {
    const n = normalise(raw)
    if (!n) return
    if (value.includes(n)) {
      setDraft('')
      return
    }
    onChange([...value, n])
    setDraft('')
  }

  function removeTag(name: string) {
    onChange(value.filter(t => t !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-gray-600">Tags</legend>
      <div ref={wrapRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <Input
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={e => { setDraft(e.target.value); setOpen(true) }}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? 'Type a tag name or select existing' : ''}
            className="flex-1 min-w-[10rem] bg-transparent border-0 px-1 py-0 shadow-none focus:ring-0"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/TagPicker.tsx
git commit -m "feat(products): add TagPicker combobox with catalog autocomplete"
```

---

## Task 12: ChannelsCell component

**Files:**

- Create: [src/components/products/ChannelsCell.tsx](src/components/products/ChannelsCell.tsx)

- [ ] **Step 1: Write the cell**

Write [src/components/products/ChannelsCell.tsx](src/components/products/ChannelsCell.tsx):

```typescript
import { CHANNEL_LABELS, CHANNELS, type ChannelsMap } from '@/types/products'

interface Props {
  channels: ChannelsMap
}

export function ChannelsCell({ channels }: Props) {
  const parts: string[] = []
  for (const channel of CHANNELS) {
    const state = channels[channel]
    if (!state) continue
    const label = CHANNEL_LABELS[channel]
    parts.push(state === 'inactive' ? `${label} (paused)` : label)
  }

  if (parts.length === 0) {
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <span className="text-xs text-gray-600">
      {parts.join(' · ')}
    </span>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ChannelsCell.tsx
git commit -m "feat(products): add ChannelsCell list-row renderer"
```

---

## Task 13: Wire channels + tags into the Details tab + editor

**Files:**

- Modify: [src/components/products/tabs/DetailsTab.tsx](src/components/products/tabs/DetailsTab.tsx)
- Modify: [src/components/products/ProductEditor.tsx](src/components/products/ProductEditor.tsx)

- [ ] **Step 1: Update DetailsTab imports**

Open [src/components/products/tabs/DetailsTab.tsx](src/components/products/tabs/DetailsTab.tsx). Replace the import block at the top with:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChannelControlRow } from '../ChannelControlRow'
import { TagPicker } from '../TagPicker'
import { GARMENT_FAMILIES } from '@/lib/products/garment-families'
import type { BrandRef, CategoryRef, ChannelsMap, ProductDetail } from '@/types/products'
```

Note: `TagCheckboxGroup` and `PRODUCT_TYPE_TAGS` imports are gone.

- [ ] **Step 2: Widen Props to carry channels**

Replace the `Props` and `readTypeTags` helper with:

```typescript
interface Props {
  product: ProductDetail
  brands: BrandRef[]
  categories: CategoryRef[]
  onSave: (patch: Record<string, unknown>) => Promise<void>
  onDelete: () => Promise<void>
  onChannelsChange: (next: ChannelsMap) => void
  saving: boolean
  errors: Record<string, string>
}
```

Delete the `readTypeTags` function.

- [ ] **Step 3: Update DetailsTab form state**

Inside the `DetailsTab` function, update the signature:

```typescript
export function DetailsTab({
  product,
  brands,
  categories,
  onSave,
  onDelete,
  onChannelsChange,
  saving,
  errors,
}: Props) {
```

Replace the `useState` initialiser:

```typescript
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
    tags: product.tags || [],
  })
```

- [ ] **Step 4: Update handleSubmit body**

Replace the `handleSubmit` body:

```typescript
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({ ...form })
  }
```

Note: `tags` is now a plain `string[]` in state, which the PATCH handler will sanitise via `sanitiseTagArray`.

- [ ] **Step 5: Replace the TagCheckboxGroup usage with ChannelControlRow + TagPicker**

Find the JSX section currently rendering:

```typescript
        <TagCheckboxGroup
          legend="Product type"
          value={form.type_tags}
          onChange={tags => patch('type_tags', tags)}
        />
```

Replace with a new classification block placed just before the current "Classification" `<section>` closes (so it sits alongside Brand/Category/Garment family/Industry but below them):

```typescript
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <ChannelControlRow
            productId={product.id}
            channels={product.channels}
            onChange={onChannelsChange}
          />
          <TagPicker
            value={form.tags}
            onChange={tags => patch('tags', tags)}
          />
        </div>
```

- [ ] **Step 6: Wire onChannelsChange in ProductEditor**

Open [src/components/products/ProductEditor.tsx](src/components/products/ProductEditor.tsx). Add an import:

```typescript
import type { BrandRef, CategoryRef, ChannelsMap, ProductDetail } from '@/types/products'
```

Inside the `ProductEditor` function, add a handler just after `saveDetails`:

```typescript
  function applyChannelsChange(channels: ChannelsMap) {
    setProduct(prev => ({ ...prev, channels }))
  }
```

Wire it into `<DetailsTab>`:

```typescript
          <DetailsTab
            product={product}
            brands={props.brands}
            categories={props.categories}
            onSave={saveDetails}
            onDelete={deleteProduct}
            onChannelsChange={applyChannelsChange}
            saving={savingDetails}
            errors={detailsErrors}
          />
```

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean in both files. The only remaining TS errors should be in `ProductFilters.tsx`, `ProductRow.tsx`, and anywhere still importing from `src/lib/products/tags.ts` (fixed in Tasks 14–16).

- [ ] **Step 8: Manual test in the browser**

Run: `npm run dev`. Open any uniforms product in the editor. Confirm:

- Channels row shows three segmented pills per channel, highlighting the current state.
- Clicking a pill updates the UI immediately and persists across page reload.
- Tags combobox shows existing tags as chips; typing a new tag adds it on Enter and it sticks after Save.
- Autocomplete suggestions appear while typing and clicking a suggestion inserts it.

- [ ] **Step 9: Commit**

```bash
git add src/components/products/tabs/DetailsTab.tsx src/components/products/ProductEditor.tsx
git commit -m "feat(products): Details tab uses ChannelControlRow + TagPicker"
```

**→ Review checkpoint C — editor UX complete; list-page UX next.**

---

## Task 14: Update ProductFilters — channel select + tag multi-select

**Files:**

- Modify: [src/components/products/ProductFilters.tsx](src/components/products/ProductFilters.tsx)

- [ ] **Step 1: Update imports**

Open [src/components/products/ProductFilters.tsx](src/components/products/ProductFilters.tsx). Replace the import block:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GARMENT_FAMILIES, type GarmentFamily } from '@/lib/products/garment-families'
import { CHANNELS, CHANNEL_LABELS, type Channel } from '@/types/products'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ShopifyLiveFilter,
  ActiveFilter,
} from '@/types/products'
```

Note: `TagCheckboxGroup` import is gone.

- [ ] **Step 2: Replace the TagCheckboxGroup fieldset with a Channel select**

In the JSX, find:

```typescript
        <TagCheckboxGroup
          value={filters.type_tags}
          onChange={tags => patch({ type_tags: tags })}
        />
```

Replace with:

```typescript
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Channel</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.channel ?? ''}
            onChange={e => patch({ channel: (e.target.value || null) as Channel | null })}
          >
            <option value="">All channels</option>
            {CHANNELS.map(c => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </fieldset>
```

- [ ] **Step 3: Add a tag multi-select below the existing row**

Just before the "Clear filters" div, insert a new row:

```typescript
      <TagFilterCombobox
        value={filters.tags_filter}
        onChange={tags_filter => patch({ tags_filter })}
      />
```

Then at the bottom of the file, add the combobox component:

```typescript
function TagFilterCombobox({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = draft.trim().toLowerCase()
    let cancelled = false
    const run = async () => {
      const url = q.length > 0
        ? `/api/products/tags?q=${encodeURIComponent(q)}`
        : '/api/products/tags'
      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json()
      if (cancelled) return
      const names = Array.isArray(json.tags) ? (json.tags as string[]) : []
      setSuggestions(names.filter(n => !value.includes(n)).slice(0, 8))
    }
    void run()
    return () => { cancelled = true }
  }, [draft, value])

  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function add(name: string) {
    if (value.includes(name)) return
    onChange([...value, name])
    setDraft('')
  }

  function remove(name: string) {
    onChange(value.filter(t => t !== name))
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-gray-600">Tags (all must match)</legend>
      <div ref={wrapRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={e => { setDraft(e.target.value); setOpen(true) }}
            placeholder={value.length === 0 ? 'Filter by tag' : ''}
            className="flex-1 min-w-[8rem] bg-transparent border-0 px-1 py-0 text-sm focus:outline-none focus:ring-0"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean in `ProductFilters.tsx`.

- [ ] **Step 5: Manual test**

Run: `npm run dev`. On `/products`:

- Channel select narrows the list.
- Tag filter autocompletes from the catalog; adding multiple tags narrows to products that carry all of them (AND semantics — `.contains` at query level).
- Clear filters restores the full list.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/ProductFilters.tsx
git commit -m "feat(products): list filters support channel + multi-tag"
```

---

## Task 15: Update ProductRow + ProductList — Channels column

**Files:**

- Modify: [src/components/products/ProductRow.tsx](src/components/products/ProductRow.tsx)
- Modify: [src/components/products/ProductList.tsx](src/components/products/ProductList.tsx)

- [ ] **Step 1: Replace tag badges in ProductRow with ChannelsCell**

Open [src/components/products/ProductRow.tsx](src/components/products/ProductRow.tsx). Replace the whole file with:

```typescript
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShopifyLiveBadge } from './ShopifyLiveBadge'
import { ChannelsCell } from './ChannelsCell'
import type { ProductSummary } from '@/types/products'

interface Props {
  product: ProductSummary
  onToggleActive: (id: string, next: boolean) => Promise<void>
}

export function ProductRow({ product, onToggleActive }: Props) {
  const [busy, setBusy] = useState(false)

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

      <div className="min-w-[12rem] max-w-[16rem]">
        <ChannelsCell channels={product.channels} />
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

Note: `PRODUCT_TYPE_TAGS`, `PRODUCT_TYPE_TAG_LABELS`, and `TAG_BADGE_VARIANT` are all gone.

- [ ] **Step 2: Confirm ProductList doesn't need touch**

Open [src/components/products/ProductList.tsx](src/components/products/ProductList.tsx) and verify it only maps `<ProductRow>` without its own header row. Because the current layout is a stack of rounded-rectangle cards (not a tabular header-plus-rows), no separate header row exists to update. Leave `ProductList.tsx` as-is unless the column renders misaligned in practice.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean. No references to deleted symbols should remain.

- [ ] **Step 4: Manual test**

Run: `npm run dev`. On `/products`:

- Each row shows a Channels column (right of the text block, before Activate/Edit).
- Products with no channels render `—`.
- A product with `{workwear: 'active', b2b: 'inactive'}` renders `Workwear · B2B (paused)`.
- On narrow viewports the column wraps rather than breaking layout.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductRow.tsx
git commit -m "feat(products): list row shows Channels column"
```

---

## Task 16: Delete TagCheckboxGroup and gut tags.ts

**Files:**

- Delete: [src/components/products/TagCheckboxGroup.tsx](src/components/products/TagCheckboxGroup.tsx)
- Delete: [src/lib/products/tags.ts](src/lib/products/tags.ts)

- [ ] **Step 1: Confirm no more references**

Run: `npx tsc --noEmit`

Also grep to confirm:

Run: `npm run lint` after the deletes below — any dangling import will show up.

Use the Grep tool (or `rg` via your editor's search) to check for any remaining references to `TagCheckboxGroup`, `PRODUCT_TYPE_TAGS`, `PRODUCT_TYPE_TAG_LABELS`, `RESERVED_TAGS`, `ALLOWED_TAGS`, `sanitiseProductTags`, `mergeWithReservedTags`, `ProductTypeTag`, `AllowedTag`. Expected: zero matches in `src/`.

If any match surfaces, fix the call site before proceeding.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/products/TagCheckboxGroup.tsx
git rm src/lib/products/tags.ts
```

The spec §8.3 allows keeping `tags.ts` as a one-function file with `sanitiseTagName`, but that helper already lives in `src/lib/products/tag-catalog.ts`. Deleting the file avoids a redundant module.

- [ ] **Step 3: Type-check + lint + build**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run build`
Expected: all three clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(products): remove closed-vocab tag module and TagCheckboxGroup"
```

---

## Task 17: Full end-to-end verification

**Files:** (none — this is a verification pass)

- [ ] **Step 1: Run the full verification checklist from the spec**

Per [spec §9](docs/superpowers/specs/2026-04-20-staff-portal-products-channels-and-tags-migration.md#9-verification), with the dev server running (`npm run dev`):

- [ ] Re-run both SQL files (004 + 005) against staging; confirm row counts unchanged from first run.
- [ ] Confirm no uniforms row has any of `workwear`/`preorder`/`b2b` in `tags` (SQL from Task 2 Step 3).
- [ ] Existing list page filters still work: search, brand, category, garment family, shopify-live, active. None regressed.
- [ ] New sidebar sub-nav: All Products / Workwear / Pre-order / B2B each navigate correctly and narrow the list to matching rows.
- [ ] Editor ChannelControlRow: for one product, toggle all 9 state combinations across the three channels, reload the page, and confirm state persists.
- [ ] ChannelsCell on list rows renders:
  - both channels active → `Workwear · B2B`
  - one active one paused → `Workwear · B2B (paused)`
  - single paused → `Pre-order (paused)`
  - no channels → `—`
- [ ] Tag picker: existing tag autocompletes; typing a fresh new tag creates it on Save and it reappears in autocomplete on the next edit session.
- [ ] Removing a tag from a product removes it from `products.tags` but leaves the catalog row in place (check via the autocomplete still offering it).
- [ ] List page Tags filter narrows to products that have all selected tags.
- [ ] Permission gate: sign in as a staff user without `products` permission and confirm the new endpoints all return 403:
  - `PUT /api/products/<id>/channels/workwear`
  - `GET /api/products/tags`

- [ ] **Step 2: Final build**

Run: `npm run build`
Expected: clean build with no errors.

- [ ] **Step 3: Ship**

This plan is scoped as a single PR. At this point open the PR using the commit list produced by Tasks 1–16. Body should reference the spec and call out:

- Migration files to run manually via Supabase SQL editor (they are not auto-applied).
- Rollback window ≈ 1 hour per spec §5.3.

---

## Rollback

Per spec §5.3, if the deploy misbehaves within ~1 hour:

```sql
begin;
drop table if exists product_type_activations;
drop table if exists product_tag_catalog;
-- Restoring stripped channel values into products.tags is only possible if
-- no staff edit has saved tags since the deploy; otherwise the state is too
-- mixed to mechanically reverse. Prefer forward-fix beyond the ~1h window.
commit;
```

Also revert the application PR.
