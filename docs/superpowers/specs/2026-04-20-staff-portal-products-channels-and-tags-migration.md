# Products sub-app — Channels + Staff Tags migration

**Date:** 2026-04-20
**Status:** Proposed
**Owner:** Jon (<jon@theprint-room.co.nz>)
**Repo:** `print-room-staff-portal`
**Relates to:** `docs/superpowers/specs/2026-04-20-staff-portal-products-subapp-design.md` (v1 — implemented)

## 1. Context

Products v1 shipped on 2026-04-20 using `products.tags text[]` as the store for both product-type channels (`workwear` / `preorder` / `b2b`) and historical reserved tags (`leavers` / `design-tool`). That conflated two concepts that have now diverged:

- **Channels** control customer-facing publication and need per-channel state. Staff want to keep a product visible to Workwear customers while hiding it from B2B — `products.is_active` (master kill switch) is too blunt and `tags[]` can only express binary presence.
- **Tags** are open-vocabulary organisational labels staff create ad hoc ("Summer 2026", "Clearance", "New suppliers"). A closed allowlist blocks this; `tags[]` is the right home for it once channels move out.

middleware-pr's last commit was 2026-04-07 and the editor has been retired in favour of the staff portal — the junction table can become the single writer for channel state from day one, with no external-writer coordination needed.

## 2. Goals

- Per-channel 3-state publication control (Off / Active / Inactive) via a new `product_type_activations` junction table.
- Sidebar sub-nav for channel-filtered list views: All / Workwear / Pre-order / B2B.
- Structural prep for upcoming sub-apps (B2B catalogues, preorder campaigns) to reference channel rows via FK.
- Open-vocabulary staff tag system with a shared catalog for autocomplete, living on the freed `products.tags` column.
- Clean cut: one coordinated PR ends the period where `tags[]` and the junction can drift.

## 3. Non-goals

- Extending channel writes to `platform = 'print-room'` products. Scope stays uniforms-only, matching `withUniformsScope`. Schema is platform-agnostic; print-room rows can be written later without further migration.
- Modifying `preorder_campaigns`, `b2b_catalogue_*`, or any sub-app-2/3/4 table. This spec only prepares the FK target.
- Reviving middleware-pr. It is retired; no coexistence required.
- Customer-facing tag surfaces. Tags are staff-internal.

## 4. Data model

### 4.1 New — `product_type_activations`

```sql
create table product_type_activations (
  product_id    uuid not null references products(id) on delete cascade,
  product_type  text not null check (product_type in ('workwear','preorder','b2b')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (product_id, product_type)
);

create index product_type_activations_product_type_idx
  on product_type_activations (product_type) where is_active;
```

Semantics:

- Row exists ⇒ product is published to that channel.
- `is_active = true` ⇒ live to customers on that channel.
- `is_active = false` ⇒ paused on that channel (visible to staff, not to customers).
- Row absent ⇒ product is not in that channel at all.
- `products.is_active = false` ⇒ master kill switch; overrides every per-channel state.

No RLS needed; access is gated by middleware + permission check as in v1.

### 4.2 New — `product_tag_catalog`

```sql
create table product_tag_catalog (
  name        text primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references staff_users(id) on delete set null
);
```

The autocomplete source for the tag picker. Rows are created lazily: when staff save a product with a tag name that isn't yet in the catalog, the API upserts it. No separate "admin tags" screen in v1 — creation flows through normal product editing.

### 4.3 Reuse — `products.tags text[]`

Keeps its existing shape. Post-migration it carries only open-vocabulary staff tags. The channel values (`workwear`, `preorder`, `b2b`) are stripped out during the migration. Historical values like `leavers` and `design-tool` stay in place (they were always organisational, not channels).

No Postgres CHECK constraint — tags are open-vocabulary by design.

## 5. Migration plan

### 5.1 Sequencing (one PR, one merge window)

1. Migration SQL creates `product_type_activations` and `product_tag_catalog`, runs the backfill, then strips channel values from `products.tags`. All in one transaction so rollback is atomic.
2. App code switches reads and writes for channel state to the junction table and drops the closed tag allowlist on the same deploy.
3. No dual-write window. Because middleware-pr is retired and the staff portal is the sole writer, the risk that dual-write is meant to cover (external systems disagreeing) doesn't exist.

### 5.2 Backfill SQL (idempotent)

```sql
-- Seed junction from existing channel tags, uniforms only.
insert into product_type_activations (product_id, product_type, is_active)
select p.id, t.tag, true
from products p
cross join lateral unnest(p.tags) as t(tag)
where p.platform = 'uniforms'
  and t.tag in ('workwear','preorder','b2b')
on conflict (product_id, product_type) do nothing;

-- Strip channel values from tags[] so the column is free for staff tags.
update products
set tags = array(
  select t from unnest(tags) as t
  where t not in ('workwear','preorder','b2b')
)
where platform = 'uniforms'
  and tags && array['workwear','preorder','b2b'];

-- Seed catalog with any remaining (historical) tag values so the
-- picker autocompletes on day one.
insert into product_tag_catalog (name)
select distinct t
from products, unnest(tags) as t
where platform = 'uniforms'
on conflict (name) do nothing;
```

Backfill is re-runnable: each statement uses `on conflict do nothing` or is filter-guarded. All backfilled channel rows default to `is_active = true`; the existing `products.is_active` continues to act as the global master switch and is not copied into the per-channel `is_active` (the new per-channel pause capability begins from the migration onward, not retroactively).

Backfill scope is `platform = 'uniforms'` only (~1,863 rows). The ~1,955 `platform = 'print-room'` rows never enter the junction; their tags stay untouched.

### 5.3 Rollback

If the migration deploy misbehaves:

- `drop table product_type_activations;`
- `drop table product_tag_catalog;`
- Restore channel tags: `update products set tags = tags || <original> where ...` — only possible if the deploy is rolled back before any new staff edit is saved; otherwise the state is too mixed to mechanically reverse.

Practical rollback window: ~1 hour post-deploy. Beyond that the forward-fix path (patch the bug, redeploy) is cheaper than unwinding.

## 6. UX changes

### 6.1 Sidebar sub-nav

The Products entry expands to four child links, each preserving the permission gate:

```text
Products
├─ All Products    /products
├─ Workwear        /products?channel=workwear
├─ Pre-order       /products?channel=preorder
└─ B2B             /products?channel=b2b
```

Query param, not path segment — keeps the `[id]` dynamic route clean. `parseListSearchParams` picks up `channel` with a single-line addition.

### 6.2 Editor — Details tab

The current Type checkbox group is **removed**. In its place, two new controls near the top of the Details form:

**Channels** (replaces `TagCheckboxGroup`):

```text
Channels
  Workwear:   [ Off ]  ( Active )  [ Inactive ]
  Pre-order:  ( Off )  [ Active ]  [ Inactive ]
  B2B:        [ Off ]  [ Active ]  ( Inactive )
```

Three segmented-pill rows, one per channel. Each selection calls `PUT /api/products/[id]/channels/[channel]` with the new state. "Off" deletes the junction row; "Active" / "Inactive" upserts with the corresponding `is_active`. Optimistic UI, no Save button — each click commits.

**Tags** (new, separate from Channels):

A combobox with "Type a tag name or select existing." Autocomplete is populated from `product_tag_catalog`. Typing a name that isn't in the catalog is allowed; on save, the API upserts it into the catalog. Existing tags on the product show as removable chips.

### 6.3 List page

Replace the "Type tags" filter row with two items:

- **Channel filter**: reads `?channel=` from the sidebar or a list-page select. Joins `product_type_activations` on the filtered channel; shows Active/Inactive products in that channel depending on the existing Active filter. Empty = no channel filter.
- **Tags filter**: multi-select combobox reading `product_tag_catalog`. AND semantics (product must have all selected tags).

### 6.4 List row — Channels column

A single "Channels" column between Category and the active toggle. Human-readable, stacked mini-labels:

```text
Workwear · B2B (paused)
```

Rules:

- Active channels are listed by label, comma-separated with middle-dot separators.
- Inactive channels show the label followed by `(paused)`.
- Absent channels are omitted.
- A product with no channel rows renders as `—` (em dash).

Example states:

- Junction: `workwear active, b2b active` → `Workwear · B2B`
- Junction: `workwear active, b2b inactive` → `Workwear · B2B (paused)`
- Junction: `preorder inactive` → `Pre-order (paused)`
- Junction: empty → `—`

Width behaviour: column min-width sized for the two longest labels ("Pre-order (paused)"), wrap allowed on narrow viewports.

## 7. API changes

### 7.1 New endpoints

- `PUT /api/products/[id]/channels/[channel]` — body `{ state: 'off' | 'active' | 'inactive' }`. `off` deletes the row; `active`/`inactive` upsert with `is_active` set. Returns the updated channels map for the product.
- `GET /api/products/tags` — returns `product_tag_catalog` rows, optionally filtered by `?q=` prefix for autocomplete. Paginated only if the catalog grows past ~500.

### 7.2 Modified endpoints

- `GET /api/products` (list) — `buildListQuery` grows a join on `product_type_activations` when `?channel=` is present. When absent, list returns all products in scope with channels pre-hydrated (see §7.3).
- `GET /api/products/[id]` — response hydrates `channels` alongside existing fields. Shape is a partial map: `{ workwear?: 'active' | 'inactive', preorder?: 'active' | 'inactive', b2b?: 'active' | 'inactive' }`. Absent keys mean "off" (no junction row). Clients treat missing keys as `'off'`; the editor's `ChannelControlRow` renders all three channels regardless.
- `POST /api/products` (create) — accepts optional `channels` body field; creates matching junction rows.
- `PATCH /api/products/[id]` — no longer reads/writes channel values in `tags[]`. Continues to accept `tags` as open-vocabulary; on save, upserts new tag names into `product_tag_catalog`.

### 7.3 List hydration

`buildListQuery` returns a single-query result using a lateral subquery or `to_jsonb` aggregation so each row carries its `channels` map. Avoids N+1 hits on the list view. Concrete shape:

```sql
select p.*,
  (select jsonb_object_agg(pta.product_type,
           case when pta.is_active then 'active' else 'inactive' end)
   from product_type_activations pta
   where pta.product_id = p.id) as channels
from products p
where p.platform = 'uniforms'
  -- other filters here
```

## 8. Code changes

### 8.1 New files

```text
sql/004_product_type_activations.sql           -- §4.1 + §5.2 backfill
sql/005_product_tag_catalog.sql                -- §4.2
src/lib/products/channels.ts                   -- CHANNELS const, types, server helpers
src/lib/products/tag-catalog.ts                -- catalog read/upsert helpers
src/components/products/ChannelControlRow.tsx  -- 3-pill control per channel
src/components/products/TagPicker.tsx          -- combobox with autocomplete + create
src/components/products/ChannelsCell.tsx       -- list-row display of the channels column
src/app/api/products/[id]/channels/[channel]/route.ts
src/app/api/products/tags/route.ts
```

### 8.2 Modified files

- `src/components/layout/Sidebar.tsx` — Products section gets 3 child entries (§6.1).
- `src/components/products/ProductFilters.tsx` — remove `TagCheckboxGroup` usage; add channel + tag-catalog filters.
- `src/components/products/ProductRow.tsx` — add Channels column (§6.4).
- `src/components/products/ProductList.tsx` — header row matches new column.
- `src/components/products/tabs/DetailsTab.tsx` — remove type-tag checkbox; add `<ChannelControlRow>` and `<TagPicker>`.
- `src/lib/products/query.ts` — `parseListSearchParams` accepts `channel`; `buildListQuery` adds channel join + hydration (§7.3).
- `src/lib/products/schema.ts` — normalisers stop emitting channel values into `tags`; tag sanitiser becomes open-vocabulary (trim, lowercase, slug-safe character guard).
- `src/types/products.ts` — add `Channel`, `ChannelState`, `ChannelsMap` types; extend `ProductSummary` and `ProductDetail` with `channels`.

### 8.3 Removed / gutted

- `src/components/products/TagCheckboxGroup.tsx` — deleted; channels no longer use checkboxes.
- `src/lib/products/tags.ts`:
  - `PRODUCT_TYPE_TAGS`, `PRODUCT_TYPE_TAG_LABELS`, `RESERVED_TAGS`, `ALLOWED_TAGS`, `sanitiseProductTags` (closed-vocab version), `mergeWithReservedTags` — removed.
  - File is either deleted entirely (if nothing else references it post-refactor) or reduced to a single open-vocab `sanitiseTagName` helper.
- `src/app/(portal)/products/(routes using TagCheckboxGroup)` — references updated per §8.2.

## 9. Verification

Pre-merge (local + staging):

- Backfill SQL run twice — second run is a no-op.
- After backfill, every uniforms product with a channel tag has a matching junction row; `products.tags` contains only non-channel values.
- Existing list page filters still work (search, brand, category, garment family, shopify-live, active).
- New sidebar sub-nav links navigate correctly and narrow the list.
- Editor ChannelControlRow toggles all 9 state combinations per channel and persists across reload.
- ChannelsCell renders all state combinations correctly, including `—` for no rows and `(paused)` for inactive-only channels.
- Tag picker: existing tags autocomplete; creating a new tag upserts to the catalog; removing a tag removes it from `products.tags` but keeps the catalog row.
- List page "tags" filter narrows to products containing all selected tags.
- Permission gate on new endpoints: 403 for users without `products` permission.

## 10. Decisions applied per auto-mode

| # | Decision | Default chosen | Override by |
| --- | --- | --- | --- |
| 1 | Migration phasing | Clean cut, one PR, no dual-write | Ask for phased if rollback horizon > 1 hour is needed |
| 2 | Channel backfill `is_active` | `true` for all backfilled rows | Edit §5.2 to inherit `products.is_active` instead |
| 3 | Scope | uniforms only | Edit §5.2 filter to include other platforms |
| 4 | Tag vocabulary enforcement | Open (no CHECK, no allowlist) | Add CHECK + per-tenant allowlist later if abuse surfaces |
| 5 | Tag catalog admin UI | None — lazy upsert on product save | Add dedicated admin screen in a follow-up spec |
| 6 | Channel API shape | Per-channel `PUT` (not batch) | Batch endpoint can be added later without breaking per-channel callers |
| 7 | List-row channel display | Single "Channels" column, stacked labels with "(paused)" | Swap for pill-badges if column feels too long in production |

## 11. Follow-ups (out of this spec)

- Tag admin screen for renaming / merging / deleting catalog entries (only needed if the catalog gets messy).
- `products.is_active = false` propagation to per-channel rows (currently master-switch only).
- Extend channels to `platform = 'print-room'` when that editor is built.
- FK from `preorder_campaigns.product_id` to `products.id` (separate when that sub-app lands).
- B2B catalogue membership: a separate table, not a new channel. Keeps `b2b` as "eligible for B2B at all," with catalogue-level scoping orthogonal.
