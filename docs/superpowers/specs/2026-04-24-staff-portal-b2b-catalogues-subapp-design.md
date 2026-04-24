# Sub-app #3 — B2B Catalogues — Design Spec

**Date:** 2026-04-24
**Status:** Draft (awaiting Jamie + Jon review)
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)
**Source meeting:** Fireflies — "Web + Tech – Week ahead review" 2026-04-24 (Jon Thom, Chris, Jamie, Anna, John)

## 1. Context

The Print Room is moving B2B/workwear customers off Shopify onto an own-built platform. Architecture is two Next.js apps sharing one Supabase backend: `print-room-staff-portal` (internal) and `print-room-portal` (customer-facing B2B). The four staff-portal sub-apps build in order **Products → Inventory → B2B catalogues & companies → B2B order entry (CSR)**. Sub-app #1 (Products) shipped 2026-04-20; sub-app #2 (Inventory) shipped 2026-04-20. This spec covers sub-app #3.

Today the customer portal's `/shop` page filters on a **global** B2B channel: products with a row in `product_type_activations` where `product_type='b2b' AND is_active=true` are visible to every B2B customer. This was the v1 behaviour deliberately chosen in the [customer-b2b-checkout-mvp-design](../../../../print-room-portal/docs/superpowers/specs/2026-04-20-customer-b2b-checkout-mvp-design.md) spec §3 ("Per-company catalogues — v1 filters by the B2B channel activation..."). Per-company catalogues were always the v1.1 item. This spec delivers them.

Per Chris's meeting direction (§20:00), a B2B catalogue is created by **duplicating** master products into a company-specific catalogue with overrideable markup/decoration/shipping and optional per-item tier pricing. Base cost stays locked (inherited from the master product). A catalogue-level discount applies across all items.

## 2. Goals

- First-class `b2b_catalogues` entity — named, reusable, editable as a unit.
- Staff multi-select flow on `/products`: tick N rows → "Create B2B catalogue from selected" → prompts for organization + catalogue name → creates the catalogue in one round-trip.
- Per-catalogue-item overrides: `markup_pct`, `decoration_type`, `decoration_price`, `shipping_cost`, `metafields` (JSONB).
- Catalogue-level `discount_pct` applied on top.
- Per-catalogue-item pricing tiers (min/max/unit_price) that override master tiers.
- Customer-portal `/shop` query switches to catalogue-scoped visibility with **fallback to the current global B2B channel when the org has no assigned catalogues** (Option A — safest migration; see §11).
- B2B-only products: a catalogue item may have a NULL `source_product_id` and carry its own name/base_cost/images — not visible on the master `/products` list.
- Customer portal gains no UX change in this spec; only the server query extends. Sidebar rename to "Catalog" + cart-context isolation lands in a sibling customer-portal spec.

## 3. Non-goals (out of scope)

- **Category-driven markup rules** (Chris §10:51, §14:36). A separate spec will cover branch/channel-wide markup multipliers per category. This spec *consumes* whatever markup value lands on the master product; it does not itself build the rule engine.
- **Visual override flags** (Chris §18:01 — green/red/orange colour coding on the five pricing columns). Data support lands here (override columns are NULL when inherited); the UI visualisation is a sibling spec.
- **Metafield framework expansion** (Chris §36:31). This spec uses a permissive `metafields jsonb` bag; a later spec locks the vocabulary (gender, fabric, safety_standard, features).
- **Customer-portal sidebar rename** (`Shop` → `Catalog`) and B2B-context-only cart chip (Chris §43:00-44:10). Customer-portal spec.
- **Inventory tab separation** (Chris §28:45). Inventory sub-app concern.
- **Reorder UI refinement** (Chris §46:00-49:00). Customer-portal spec.
- **Workwear front-end landing/contact pages** (Chris §32:37). Separate workstream.
- **Editing master products from inside a catalogue.** Catalogue items are an overlay; to change name/base_cost you go to the master product.

## 4. Architecture

### 4.1 Route structure (staff portal)

```
src/app/(portal)/products/
  page.tsx                          (existing) — extend with row checkboxes + sticky action bar
src/app/(portal)/catalogues/
  page.tsx                          List: all catalogues, filter by org, search by name
  new/page.tsx                      Optional direct-create (no pre-selection)
  [id]/page.tsx                     Tabbed editor: Items / Pricing tiers / Assignment / Settings
src/app/(portal)/b2b-accounts/
  [orgId]/page.tsx                  (existing or new — if not yet built, add catalogues panel stub)
src/app/api/catalogues/
  route.ts                          GET list, POST create-from-selection { org_id, name, product_ids[], discount_pct }
  [id]/route.ts                     GET one, PATCH (name/description/discount_pct/is_active), DELETE
  [id]/items/route.ts               GET items, POST add item (by source_product_id or empty for b2b-only)
  [id]/items/[itemId]/route.ts      GET / PATCH (overrides) / DELETE
  [id]/items/[itemId]/tiers/route.ts            GET tiers, POST add tier
  [id]/items/[itemId]/tiers/[tierId]/route.ts   PATCH / DELETE
  by-org/[orgId]/route.ts           GET catalogues for one org (used by b2b-accounts detail page + customer /shop)
```

### 4.2 Route structure (customer portal — consumed contract)

**This spec modifies** [print-room-portal/app/(portal)/shop/page.tsx](../../../../print-room-portal/app/(portal)/shop/page.tsx) **only**. The existing file uses:

```ts
admin.from('products')
  .select('... _channel:product_type_activations!inner(product_type,is_active)')
  .eq('_channel.product_type', 'b2b')
  .eq('_channel.is_active', true)
```

It becomes a two-step lookup (see §7). No route path changes. No component changes. No cart/checkout impact — catalogue item IDs are **not** used on the customer side; the customer still references `product_id + variant_id` on quote-request/checkout lines. Catalogue membership is a visibility filter, not an order-line identity.

### 4.3 Data layer

New API routes use `src/lib/supabase-server.ts` (service-role, staff auth gated by existing `(portal)` middleware). RLS is **required** for the `/by-org/[orgId]` endpoint on the customer side (see §8).

Catalogues editor uses server components for the list/detail initial render, client components for the items tab's inline edit rows (mirrors sub-app #1 Products Tabs pattern).

## 5. Data model

### 5.1 New tables

```sql
-- 006_b2b_catalogues.sql
begin;

create table if not exists b2b_catalogues (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  description         text,
  discount_pct        numeric(5,2) not null default 0,  -- 0..100
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by_user_id  uuid references auth.users(id),
  updated_at          timestamptz not null default now(),
  constraint b2b_catalogues_discount_range check (discount_pct >= 0 and discount_pct <= 100)
);

create index if not exists b2b_catalogues_org_active_idx
  on b2b_catalogues (organization_id) where is_active;

create table if not exists b2b_catalogue_items (
  id                        uuid primary key default gen_random_uuid(),
  catalogue_id              uuid not null references b2b_catalogues(id) on delete cascade,
  source_product_id         uuid references products(id) on delete set null,  -- nullable for B2B-only items
  -- Snapshot fields used when source_product_id is NULL (B2B-only items)
  name                      text,          -- required when source_product_id is null
  base_cost_snapshot        numeric(10,2), -- required when source_product_id is null
  image_url_snapshot        text,
  -- Override surface (NULL = inherit from source product; always NULL when source_product_id is null)
  markup_pct_override       numeric(6,2),
  decoration_type_override  text,
  decoration_price_override numeric(10,2),
  shipping_cost_override    numeric(10,2),
  metafields                jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  sort_order                integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint b2b_catalogue_items_source_or_snapshot check (
    source_product_id is not null
    or (name is not null and base_cost_snapshot is not null)
  ),
  constraint b2b_catalogue_items_unique_product
    unique (catalogue_id, source_product_id)  -- prevents double-adding the same master product
);

create index if not exists b2b_catalogue_items_catalogue_idx
  on b2b_catalogue_items (catalogue_id) where is_active;

create index if not exists b2b_catalogue_items_source_product_idx
  on b2b_catalogue_items (source_product_id) where source_product_id is not null;

create table if not exists b2b_catalogue_item_pricing_tiers (
  id                  uuid primary key default gen_random_uuid(),
  catalogue_item_id   uuid not null references b2b_catalogue_items(id) on delete cascade,
  min_quantity             integer not null,
  max_quantity             integer,              -- null = open-ended (e.g. "100+")
  unit_price          numeric(10,2) not null,
  created_at          timestamptz not null default now(),
  constraint b2b_catalogue_item_pricing_tiers_qty_range
    check (min_quantity > 0 and (max_quantity is null or max_quantity >= min_quantity)),
  constraint b2b_catalogue_item_pricing_tiers_unique_min
    unique (catalogue_item_id, min_quantity)
);

commit;
```

Save as `sql/006_b2b_catalogues.sql`. No data backfill on 006 — the zero-catalogue state is the intended day-1 fallback (see §7.3).

### 5.2 Existing table references (not modified)

| Table | Role here |
|---|---|
| `products` | Master catalogue. `source_product_id` FK into this. When an item's source is set, `products.base_cost`, `products.markup_pct`, `products.image_url`, `products.product_pricing_tiers` etc. are the inherited defaults. |
| `product_type_activations` | Still used for the **global B2B channel fallback** — orgs with zero assigned catalogues fall back to the current global behaviour (Option A, §7.3). Untouched by this spec. |
| `organizations` | Catalogue FK target. |
| `b2b_accounts` | Per-org B2B profile. Not FK'd by catalogues directly; relationship goes via `organization_id` which both share. The staff `/b2b-accounts/[orgId]` page reads catalogues by org. |
| `user_organizations` | Customer → organization link. Customer /shop derives `organization_id` from this, then looks up catalogues. Unchanged. |

### 5.3 Price computation contract

A single source-of-truth function `catalogue_unit_price(catalogue_item_id, qty)` computes the effective price. Wherever the customer portal today calls `get_unit_price(p_product_id, p_org_id, p_qty)`, it will now first look up the org's catalogue item for that product; if found, call `catalogue_unit_price`. Sequence:

```
1. Find catalogue_item where catalogue.organization_id = :org_id
                         and catalogue.is_active
                         and item.source_product_id = :product_id
                         and item.is_active
2. If found:
     tier = first b2b_catalogue_item_pricing_tiers row for :qty (by min_quantity asc)
     if tier: base = tier.unit_price
     else:    base = source.base_cost * (1 + (item.markup_pct_override
                                              ?? source.markup_pct) / 100)
     return round( base * (1 - catalogue.discount_pct / 100), 2 )
3. If not found:
     return existing get_unit_price(:product_id, :org_id, :qty)   -- today's behaviour
```

Implementation in §7.2 as a Postgres RPC `catalogue_unit_price`. The existing `get_unit_price` signature does not change — a new wrapper `effective_unit_price(product_id, org_id, qty)` applies the above sequence so both the customer portal shop page and the CSR quote builder pick it up by swapping one RPC name.

## 6. Staff UI

### 6.1 Multi-select on `/products`

Extend [src/app/(portal)/products/page.tsx](src/app/(portal)/products/page.tsx):

- Add a checkbox column as the first `<th>`.
- Row checkbox toggles selection in client state (URL param `selected` optional; for v1 selection lives in React state only and resets on navigation).
- A sticky bottom bar appears when `selection.size > 0`:
  - "N selected"
  - Button: **Create B2B catalogue from selected**
  - Button: Clear
- Clicking the button opens `CreateCatalogueDialog` (modal): organization dropdown (all `organizations`), name input, discount % input (default 0), description textarea (optional). Submit POSTs `/api/catalogues` (see §6.4), redirects to `/catalogues/[id]` on success.

### 6.2 `/catalogues` list

Server component. Columns: Name, Organization, # items, Discount %, Active, Created. Filters: org dropdown, search-by-name, active tri-state. 25/page pagination (matches Products list).

"New catalogue" button in the header opens `CreateCatalogueDialog` with no pre-selected products (direct-create path).

### 6.3 `/catalogues/[id]` tabbed editor

Top tabs: **Items / Pricing tiers / Assignment / Settings**.

**Items tab** — table of catalogue items. Columns:

| Column | Source | Editable? |
|---|---|---|
| Image | `image_url_snapshot ?? source.image_url` | — |
| Name | `name ?? source.name` | inline when `source_product_id is null` |
| Base cost | `base_cost_snapshot ?? source.base_cost` | **locked** (greyed) when `source_product_id is not null` |
| Markup % | `markup_pct_override ?? source.markup_pct` | inline; clearing reverts to inherit |
| Decoration type | `decoration_type_override ?? source.decoration_type_default` | inline dropdown: N/A / Screen print / Heat press / Super colour |
| Decoration price | `decoration_price_override ?? source.decoration_price` | inline |
| Shipping | `shipping_cost_override` (no master equivalent today) | inline |
| Active | `is_active` | toggle |
| Actions | — | Tiers / Remove |

Footer: **Add item** button → modal: "Pick from master products" (search) OR "Create B2B-only item" (inline form with name + base_cost + optional image_url).

**Pricing tiers tab** — per-item tiers grouped by item. Each group is collapsible. Quick-add row: min_quantity, max_quantity (blank = +), unit_price. Delete inline. Sort by min_quantity asc. "Copy tiers from master product" action available when item has a `source_product_id` — copies `product_pricing_tiers` rows into `b2b_catalogue_item_pricing_tiers`.

**Assignment tab** — in v1 a catalogue belongs to exactly one org (FK on `b2b_catalogues.organization_id`). This tab just shows the owning org and a link to `/b2b-accounts/[orgId]`. Keeping the tab as a named stub leaves room for v1.1 M:N assignment without structural churn.

**Settings tab** — name, description, discount_pct, is_active toggle, "Delete catalogue" with confirmation (cascades to items + tiers).

### 6.4 API shapes

```ts
// POST /api/catalogues
type CreateCatalogueBody = {
  organization_id: string
  name: string
  description?: string
  discount_pct?: number          // default 0
  product_ids?: string[]         // optional; when present, server creates catalogue items for each
}
// -> 201 { id }

// POST /api/catalogues/[id]/items
type AddCatalogueItemBody =
  | { source_product_id: string }                               // from master
  | { name: string; base_cost_snapshot: number; image_url?: string }  // b2b-only
// -> 201 { id }

// PATCH /api/catalogues/[id]/items/[itemId]
type UpdateCatalogueItemBody = Partial<{
  name: string                      // b2b-only items only
  markup_pct_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
}>
// -> 200 { ok: true }
```

### 6.5 Component primitives

All UI built from `src/components/ui/` (`Button`, `Card`, `Input`, `Textarea`, `Badge`, `Checkbox`). New components in `src/components/catalogues/`: `CreateCatalogueDialog.tsx`, `CataloguesTable.tsx`, `CatalogueItemsTable.tsx`, `CatalogueItemPricingTiers.tsx`, `ProductsSelectionBar.tsx` (goes in `src/components/products/`). No new deps. Tab nav matches sub-app #1's pattern (custom tab list, active underline).

## 7. Customer portal `/shop` query extension

### 7.1 Semantic — Option A (locked)

- Org has ≥1 active catalogue → sees **only** items from those catalogues.
- Org has 0 active catalogues → **falls back** to today's global B2B channel filter (unchanged behaviour).

Rationale: PRT test tenant and every existing customer keep working day-one with zero migration work. A "Default B2B" catalogue can be seeded later per-org to tighten into Option B/C semantics.

### 7.2 Updated query (server-side, in `print-room-portal/app/(portal)/shop/page.tsx`)

```ts
// Step 1: does this org have any active catalogue items?
const { data: catItems } = await admin
  .from('b2b_catalogue_items')
  .select('id, source_product_id, b2b_catalogues!inner(organization_id, is_active, discount_pct)')
  .eq('b2b_catalogues.organization_id', context.organizationId)
  .eq('b2b_catalogues.is_active', true)
  .eq('is_active', true)

if (catItems && catItems.length > 0) {
  // Step 2a (catalogue scope): list products whose ids appear as source in this org's active items,
  // union with b2b-only items (source_product_id IS NULL).
  const sourceIds = catItems.map(r => r.source_product_id).filter(Boolean)
  const b2bOnlyItemIds = catItems.filter(r => r.source_product_id === null).map(r => r.id)
  // Render master-product cards for sourceIds, plus B2B-only cards derived from catalogue_items.
} else {
  // Step 2b (fallback): existing global B2B channel query. No change.
  let q = admin.from('products')
    .select('... _channel:product_type_activations!inner(product_type,is_active)', { count: 'exact' })
    .eq('is_active', true)
    .eq('_channel.product_type', 'b2b')
    .eq('_channel.is_active', true)
    .order('name')
    .range(offset, offset + limit - 1)
  // ...
}
```

Pricing preview on each card switches from `get_unit_price` → `effective_unit_price` (new RPC wrapper, §5.3). Single call site change; same signature.

### 7.3 B2B-only items on the customer side

When a catalogue item has `source_product_id IS NULL`, the customer sees a product card generated from the snapshot columns (`name`, `base_cost_snapshot`, `image_url_snapshot`). The PDP route `/shop/[productId]` must accept a **catalogue-item id** as well as a product id. Design: introduce a prefix-less lookup — attempt `products.id` first, then `b2b_catalogue_items.id` if not found. Quote-request and checkout line identity uses `product_id` where available; B2B-only items use `catalogue_item_id` in the same column with a discriminator — but **this is out of scope for this spec** because it ripples into quote-requests. For v1 of this spec, B2B-only items are admissible in the data model but the customer PDP/cart/checkout path assumes `source_product_id IS NOT NULL`; listing UI can optionally hide B2B-only items until the sibling customer-portal spec extends PDP support. See §12.

### 7.4 Caching

- `/shop` is `dynamic = 'force-dynamic'` today — no cache. Keep it.
- No CDN cache on B2B catalogue lookups (per-org, authenticated).
- React cache via `cache()` from `react` is safe for within-render de-duplication (same org looked up twice in one RSC pass) but not cross-request. No eviction infra required.

### 7.5 Performance

- Catalogue-items-for-org query returns typically ≤ 50 rows. Covered by `b2b_catalogue_items_catalogue_idx` + join on `b2b_catalogues_org_active_idx`. No N+1 — one round trip to get catalogue items, one round trip to get master products by `in ('id', sourceIds)`.
- `effective_unit_price` RPC is called once per card; measured against `get_unit_price` today (same one-per-card pattern). No regression.

## 8. Auth, permissions, RLS

- Staff `(portal)` middleware already gates `/catalogues/**` and `/api/catalogues/**`. Unchanged.
- Permission key: `catalogues:write`. Access rule: `role in ('admin','super_admin') or permissions @> '["catalogues:write"]'`. Mirrors `products:write` pattern from sub-app #1.
- Sidebar nav: "Catalogues" entry visible only to users with the permission. Goes under the Products section, as per sub-app #3 in the original build order.
- RLS:
  ```sql
  alter table b2b_catalogues enable row level security;
  alter table b2b_catalogue_items enable row level security;
  alter table b2b_catalogue_item_pricing_tiers enable row level security;

  -- Customer-portal read: user can read catalogues/items/tiers for orgs they belong to.
  create policy b2b_catalogues_customer_read on b2b_catalogues
    for select to authenticated
    using (organization_id in (
      select organization_id from user_organizations where user_id = auth.uid()
    ));

  create policy b2b_catalogue_items_customer_read on b2b_catalogue_items
    for select to authenticated
    using (catalogue_id in (
      select id from b2b_catalogues
      where organization_id in (
        select organization_id from user_organizations where user_id = auth.uid()
      )
    ));

  create policy b2b_catalogue_item_pricing_tiers_customer_read on b2b_catalogue_item_pricing_tiers
    for select to authenticated
    using (catalogue_item_id in (
      select id from b2b_catalogue_items
      where catalogue_id in (
        select id from b2b_catalogues
        where organization_id in (
          select organization_id from user_organizations where user_id = auth.uid()
        )
      )
    ));
  ```
- Staff writes happen via service-role on API routes — RLS does not apply. The staff API guards via `catalogues:write` permission check in a helper `src/lib/auth/can.ts` (extended).

## 9. Seed + migration plan

1. Apply `sql/006_b2b_catalogues.sql` to Supabase project `bthsxgmcnbvwwgvdveek`. Show SQL to Jamie first, then run (🟡 per-write approval). No backfill — zero-catalogue state is the correct day-1 fallback.
2. Seed one demo catalogue for the PRT test tenant (`organization_id = ee155266-200c-4b73-8dbd-be385db3e5b0`):
   ```sql
   insert into b2b_catalogues (organization_id, name, discount_pct, created_by_user_id)
   values ('ee155266-200c-4b73-8dbd-be385db3e5b0', 'PRT Demo Catalogue', 0,
           (select id from auth.users where email = 'hello@theprint-room.co.nz'));
   ```
   Then insert a handful of catalogue items from existing `platform='uniforms'` products (Jamie chooses which). PRT's `/shop` view switches from global-channel fallback to catalogue-scope with this seed.
3. Smoke: log in as a PRT user, hit `/shop`, verify seeded items render. Delete the seeded catalogue to return PRT to global-channel fallback.
4. Announce sub-app #3 to staff. `middleware-pr` is untouched by this change.

## 10. 4-axis stack rationale ("why this stack")

- **Rendering** — Server components for catalogue list + detail initial render (matches sub-app #1/#2; Next.js 16 RSC). Client components for inline edit rows in Items tab (interactivity-per-row demands client state). `/shop` stays `dynamic = 'force-dynamic'` — per-request auth + per-org scope means caching buys nothing and risks leak.
- **Caching** — No CDN cache for any authenticated surface. React `cache()` for in-render de-dup inside `/shop`. Catalogue-items-for-org lookup is cheap (single indexed query) so memoisation isn't performance-critical; correctness-first.
- **Performance** — Two indexed round-trips on `/shop` with catalogue scope (catalogue-items + master products by `in (sourceIds)`). Bound by master product fetch, not catalogue lookup. Staff catalogue editor does per-tab local state to avoid re-fetching items when switching tabs.
- **Ecommerce pattern** — Catalogue-as-duplication (Chris's Shopify mental model) implemented as references-with-overrides (normalised). Override columns NULL = inherit; non-NULL = catalogue-specific. Catalogue-level discount is the outermost multiplier so a master-product price change still flows through unless explicitly overridden. B2B-only items are snapshot rows (denormalised) because they have no master to inherit from. Customer identity on order lines stays `product_id + variant_id` — catalogue membership is a visibility filter, not an order-line identity.

## 11. Decisions made (with defaults applied per auto-mode)

| # | Decision | Default chosen | Override needed? |
|---|---|---|---|
| 1 | Customer /shop semantic | **A** — catalogue scope if assigned, fallback to global B2B channel if none | Tell me to switch to B (AND) or C (strict — no fallback) |
| 2 | Catalogue ↔ org cardinality | 1 catalogue : 1 org (FK on `b2b_catalogues.organization_id`); many catalogues per org allowed; no UNIQUE constraint | Tell me if you want M:N (one catalogue usable for many orgs) or 1:1 enforced |
| 3 | Base-cost override at catalogue level | **Not allowed** — locked; always inherits from master product | Tell me if you want a `base_cost_override` column |
| 4 | Markup value type | `numeric(6,2)` percentage (consistent with existing `products.markup_pct`) | Tell me to switch to multiplier (1.5) — requires rename on master too |
| 5 | B2B-only items — customer PDP/cart support | **Data admissible, customer-side consumption deferred** to sibling customer-portal spec | Tell me if customer PDP/cart must support them in this spec |
| 6 | Visual override flags (green/red/orange) | **Data support only** (override cols NULL = inherited); UI visualisation deferred to sibling spec | Tell me to include the UI work in this spec |
| 7 | Images on B2B-only items | `image_url_snapshot` single URL (no tab) | Tell me if you want a per-item image gallery like master products |
| 8 | Metafields on items | `jsonb` bag; no vocabulary lock | Tell me to ship a typed metafield column set |
| 9 | Permission key | `catalogues:write` | Tell me if a different key is preferred |
| 10 | Seed | PRT Demo Catalogue seeded post-migration; removable | Tell me if PRT should stay on the global channel at launch |
| 11 | `product_pricing_tiers` copy-on-create | Not automatic; staff clicks "Copy tiers from master" per item | Tell me to auto-copy on catalogue-item creation |
| 12 | Catalogue deletion | Hard delete (cascades to items + tiers) | Tell me to soft-delete via `is_active=false` instead |

## 12. Dependencies & follow-ups (not in this spec)

**Sibling specs that should follow this one:**

- **Category-driven markup rules** — bulk edit markup per category per channel (Chris §10:51). Master-product markup inheritance in this spec is a stand-in until the rule engine lands.
- **Visual override flags** — colour-coded pricing cells (Chris §18:01). Data support is here; UI binding in the sibling spec.
- **Customer-portal Catalog sidebar rename + cart context isolation** — the customer-portal's `/shop` sidebar label is updated to "Catalog" and the cart chip scopes to catalogue routes (aligns with the memory note [Cart Chip Top-Right, Not Sidebar](../../../../memory/feedback_cart_chip_top_right.md)).
- **B2B-only customer-side PDP + cart + checkout** — allows `b2b_catalogue_items.id` as a line identity in quote-requests and orders.
- **Metafield vocabulary lock** — typed columns or a strict JSON schema for gender/fabric/safety.
- **Inventory tab separation in the product editor** (sub-app #1 amendment).
- **Reorder UI simplification** (customer-portal spec).
- **Workwear front-end landing page** (standalone).

**Consumed contracts (already shipped):**

- `organizations`, `user_organizations`, `b2b_accounts`, `products`, `product_type_activations`, `product_pricing_tiers` — all from earlier sub-apps.
- `get_unit_price` RPC — wrapped, not replaced.

**Supersedes:**

- [customer-b2b-checkout-mvp-design §3](../../../../print-room-portal/docs/superpowers/specs/2026-04-20-customer-b2b-checkout-mvp-design.md) "Per-company catalogues — v1.1" item. This spec delivers it.

## 13. Verification

- Migration `006_b2b_catalogues.sql` applies cleanly on a fresh shadow DB; re-running is a no-op.
- Staff API: `POST /api/catalogues` with `product_ids` creates catalogue + N items in one round-trip; without `product_ids` creates empty catalogue.
- Staff UI: ticking ≥1 product on `/products` reveals the sticky action bar; clicking "Create B2B catalogue" opens the modal; submitting redirects to `/catalogues/[id]` with all selected items pre-populated.
- Catalogue editor Items tab: clearing an override field reverts the displayed value to the inherited master value on next render.
- Pricing-tiers tab: "Copy tiers from master" copies the exact rows from `product_pricing_tiers` and they become independently editable.
- Customer `/shop`:
  - Org with no catalogue → identical product list to today's global-channel query.
  - Org with an active catalogue holding 3 source-products → exactly those 3 products render.
  - Org with a mix of source-products + 1 B2B-only item → source-products render; B2B-only cards are hidden (deferred per §7.3) or render a placeholder linking to "contact sales" per the sibling-spec handoff.
- `effective_unit_price` RPC: for an org-product in a catalogue, returns `base * (1 + markup/100) * (1 - discount/100)` rounded to cents; for an org-product outside any catalogue, returns the same value as `get_unit_price`.
- RLS: an authenticated user from org A cannot select catalogues or items from org B (Supabase SQL `set request.jwt.claim.sub = '<other-org-user>'` test).
- Permission: staff user without `catalogues:write` gets 403 on `POST /api/catalogues`.
- Delete catalogue: cascades correctly — items and tiers are also gone; no orphaned rows.
- PRT seed catalogue round-trip: create, add items, view as PRT customer on `/shop`, delete, verify PRT returns to global-channel fallback.

---

**Open questions for Jamie / Jon before plan execution:**

1. Decision #2 (cardinality) — do you want to enforce 1-catalogue-per-org with a UNIQUE(organization_id) constraint, or allow multiple from day 1?
2. Decision #4 (markup type) — Chris said "multiplier, not percentage" at §16:01. Do we rename `markup_pct` to `markup_multiplier` (breaking existing products editor) or keep % internally and display as multiplier (1.5×) in the new catalogue UI?
3. Decision #11 (auto-copy master tiers) — does ticking 10 major-order products imply their tiers should automatically flow into the catalogue, or should staff opt in per item?
4. §7.3 B2B-only customer PDP — ship as part of this spec (expands scope ~25%), or strictly defer?
