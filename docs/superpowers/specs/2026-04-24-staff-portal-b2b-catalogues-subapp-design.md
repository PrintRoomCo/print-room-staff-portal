# Sub-app #3 — B2B Catalogues — Design Spec

**Date:** 2026-04-24 (rev 2 — locked decisions applied)
**Status:** Draft (awaiting Jamie + Jon approval to execute)
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4, Supabase Auth)
**Source meeting:** Fireflies — "Web + Tech – Week ahead review" 2026-04-24 (Jon Thom, Chris, Jamie, Anna, John)

## 1. Context

The Print Room is moving B2B/workwear customers off Shopify onto an own-built platform. Architecture is two Next.js apps sharing one Supabase backend: `print-room-staff-portal` (internal) and `print-room-portal` (customer-facing B2B). The four staff-portal sub-apps build in order **Products → Inventory → B2B catalogues & companies → B2B order entry (CSR)**. Sub-apps #1 (Products) and #2 (Inventory) shipped 2026-04-20. This spec covers sub-app #3.

Today the customer portal's `/shop` page filters on a **global** B2B channel: products with a row in `product_type_activations` where `product_type='b2b' AND is_active=true` are visible to every B2B customer. This was the v1 behaviour deliberately chosen in the [customer-b2b-checkout-mvp-design](../../../../print-room-portal/docs/superpowers/specs/2026-04-20-customer-b2b-checkout-mvp-design.md) spec §3 ("Per-company catalogues — v1 filters by the B2B channel activation..."). Per-company catalogues were always the v1.1 item. This spec delivers them.

Per Chris's meeting direction (§20:00), a B2B catalogue is created by **duplicating** master products into a company-specific catalogue with overrideable markup/decoration/shipping and optional per-item tier pricing. Base cost stays locked (inherited from the master product). A catalogue-level discount applies across all items.

Per Chris's meeting direction (§16:01) markup is also **renamed** from a percentage (`markup_pct = 50.00`) to a multiplier (`markup_multiplier = 1.5`) on the master `products` table — the rename ships in this spec via a dual-column sync trigger so `middleware-pr` (Replit-hosted, still writing the old column during the side-by-side parity period from sub-app #1 §9) keeps working unchanged.

## 2. Goals

- First-class `b2b_catalogues` entity — named, reusable per organization, editable as a unit. Many catalogues per org allowed (e.g. seasonal catalogues for the same customer).
- Staff multi-select flow on `/products`: tick N rows → "Create B2B catalogue from selected" → prompts for organization + catalogue name → creates the catalogue and **auto-copies each product's master pricing tiers** in one round-trip.
- Per-catalogue-item overrides: `markup_multiplier`, `decoration_type`, `decoration_price`, `shipping_cost`, `metafields` (JSONB).
- Catalogue-level `discount_pct` applied on top.
- Per-catalogue-item pricing tiers (min/max/unit_price). Auto-seeded from master on item creation; account managers can edit independently afterwards.
- Customer-portal `/shop` query switches to catalogue-scoped visibility with **fallback to the current global B2B channel when the org has no assigned catalogues** (Option A — safest migration; see §11).
- B2B-only products — for niche items only one customer needs (Chris's "made-to-order builders pencils" example, §26:10) — created via a "+ B2B-only item" button on the catalogue editor that inserts a row into the master `products` table with `is_b2b_only=true` AND a `b2b_catalogue_items` row pointing at it, in one transaction. **Synthetic-master approach**: B2B-only items are real products under the hood, so cart/checkout/quote-items/PDP have zero schema impact.
- Customer PDP (`/shop/[productId]`) needs **no route changes** — B2B-only items have a `products.id` and render through the existing route.
- Master `products.markup_pct` renamed to `products.markup_multiplier` with a dual-column sync trigger for backward compat with `middleware-pr`.

## 3. Non-goals (out of scope)

- **Category-driven markup rules** (Chris §10:51, §14:36). A separate spec will cover branch/channel-wide markup multipliers per category. This spec *consumes* whatever markup value lands on the master product; it does not itself build the rule engine.
- **Visual override flags** (Chris §18:01 — green/red/orange colour coding on the five pricing columns). Data support lands here (override columns are NULL when inherited); the UI visualisation is a sibling spec.
- **Metafield framework expansion** (Chris §36:31). This spec uses a permissive `metafields jsonb` bag; a later spec locks the vocabulary (gender, fabric, safety_standard, features).
- **Customer-portal sidebar rename** (`Shop` → `Catalog`) and B2B-context-only cart chip (Chris §43:00-44:10). Customer-portal spec.
- **Inventory tab separation** (Chris §28:45). Inventory sub-app concern.
- **Reorder UI refinement** (Chris §46:00-49:00). Customer-portal spec.
- **Workwear front-end landing/contact pages** (Chris §32:37). Separate workstream.
- **Per-catalogue-item image overrides** (account-specific design proofs uploaded by account managers — see §12). Defers because it overlaps with the design-proof / reorder workstream.
- **`product_pricing_tiers` schema rename** — the new `b2b_catalogue_item_pricing_tiers` table reuses the master's column names (`min_quantity`, `max_quantity`, `unit_price`) so no rename is needed.
- **Editing master products from inside a catalogue.** Catalogue items are an overlay; to change name/base_cost you go to the master product editor.
- **Dropping `products.markup_pct`** — kept indefinitely during this spec for `middleware-pr` compat. Drop ships once `middleware-pr` is decommissioned (sub-app #1 §9 — 1-month side-by-side window followed by Replit pause).

## 4. Architecture

### 4.1 Route structure (staff portal)

```
src/app/(portal)/products/
  page.tsx                          (existing) — extend with row checkboxes + sticky action bar + B2B-only filter
src/app/(portal)/catalogues/
  page.tsx                          List: all catalogues, filter by org, search by name
  [id]/page.tsx                     Tabbed editor: Items / Pricing tiers / Assignment / Settings
src/app/(portal)/b2b-accounts/
  [orgId]/page.tsx                  (does not exist yet — sibling spec) Catalogues panel will live here
src/app/api/catalogues/
  route.ts                          GET list, POST create-from-selection { org_id, name, product_ids[], discount_pct }
  [id]/route.ts                     GET one, PATCH (name/description/discount_pct/is_active), DELETE
  [id]/items/route.ts               GET items, POST add-from-master { source_product_id }
  [id]/items/b2b-only/route.ts      POST create-b2b-only-item { name, base_cost, decoration_eligible?, image_url? }
  [id]/items/[itemId]/route.ts      GET / PATCH (overrides) / DELETE
  [id]/items/[itemId]/tiers/route.ts            GET tiers, POST add tier
  [id]/items/[itemId]/tiers/[tierId]/route.ts   PATCH / DELETE
  [id]/items/[itemId]/refresh-tiers/route.ts    POST (replace this item's tiers with current master tiers)
  by-org/[orgId]/route.ts           GET catalogues for one org (used by future b2b-accounts page + customer /shop)
src/app/api/organizations/route.ts  GET (created if missing — used by CreateCatalogueDialog)
```

### 4.2 Route structure (customer portal — consumed contract)

**This spec modifies** [print-room-portal/app/(portal)/shop/page.tsx](../../../../print-room-portal/app/(portal)/shop/page.tsx) **only**. The existing file uses:

```ts
admin.from('products')
  .select('... _channel:product_type_activations!inner(product_type,is_active)')
  .eq('_channel.product_type', 'b2b')
  .eq('_channel.is_active', true)
```

It becomes a two-step lookup (see §7). No route path changes. No component changes. **No cart / checkout / quote-items changes** — every catalogue item references a `products.id` (B2B-only items are real `products` rows with `is_b2b_only=true`), so existing line identity (`product_id + variant_id`) is uniform.

### 4.3 Data layer

New API routes use `src/lib/supabase-server.ts` (`getSupabaseAdmin` for service-role, `getSupabaseServer` for cookie-based auth) — same pattern as sub-app #2. RLS is **required** on the customer-readable tables (see §8).

Catalogues editor uses server components for the list/detail initial render, client components for the items tab's inline edit rows (mirrors sub-app #1 Products Tabs pattern).

## 5. Data model

### 5.1 Master `products` rename: `markup_pct` → `markup_multiplier`

Numeric semantics change: a 50% markup (`markup_pct = 50.00`) becomes a 1.5× multiplier (`markup_multiplier = 1.5`). Conversion: `multiplier = 1 + pct / 100`.

```sql
-- Migration: 20260424_products_markup_multiplier
alter table products
  add column if not exists markup_multiplier numeric(6,3);

update products
   set markup_multiplier = round(1 + coalesce(markup_pct, 0) / 100.0, 3)
 where markup_multiplier is null;

alter table products alter column markup_multiplier set default 1.0;
alter table products alter column markup_multiplier set not null;

-- Bidirectional sync trigger so middleware-pr (writes markup_pct) and new code
-- (writes markup_multiplier) stay in lockstep until middleware-pr is decommissioned.
create or replace function sync_products_markup() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT')
     or (new.markup_pct is distinct from old.markup_pct
         and new.markup_multiplier is not distinct from old.markup_multiplier) then
    new.markup_multiplier := round(1 + coalesce(new.markup_pct, 0) / 100.0, 3);
  end if;
  if (tg_op = 'INSERT')
     or (new.markup_multiplier is distinct from old.markup_multiplier
         and new.markup_pct is not distinct from old.markup_pct) then
    new.markup_pct := round((coalesce(new.markup_multiplier, 1) - 1) * 100.0, 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_products_markup on products;
create trigger trg_sync_products_markup
  before insert or update of markup_pct, markup_multiplier on products
  for each row execute function sync_products_markup();
```

The trigger's distinct-from guards stop it firing in a sync-loop when the staff editor saves both columns at once (one column "drives" per write). `markup_pct` is **not** dropped in this spec — it stays for `middleware-pr` compatibility until that tool is decommissioned per sub-app #1 §9.

`get_unit_price` RPC — read `markup_multiplier` instead of computing from `markup_pct`. New formula: `base_cost * markup_multiplier`. (See §5.4.)

### 5.2 New `products` flag — `is_b2b_only`

```sql
alter table products
  add column if not exists is_b2b_only boolean not null default false;

create index if not exists products_is_b2b_only_idx
  on products (is_b2b_only) where is_b2b_only;
```

Default `/products` list filter hides `is_b2b_only=true` rows so the master view stays clean. Filter UI gains a tri-state: **All / Master only (default) / B2B-only only**.

`product_type_activations` is **not** auto-populated for B2B-only products — they're invisible to the global B2B channel by design. They're only visible via catalogue scope.

### 5.3 New tables

```sql
-- Migration: 20260424_b2b_catalogues_tables
create table if not exists b2b_catalogues (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  description         text,
  discount_pct        numeric(5,2) not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by_user_id  uuid references auth.users(id),
  updated_at          timestamptz not null default now(),
  constraint b2b_catalogues_discount_range check (discount_pct >= 0 and discount_pct <= 100)
);

create index if not exists b2b_catalogues_org_active_idx
  on b2b_catalogues (organization_id) where is_active;

create table if not exists b2b_catalogue_items (
  id                            uuid primary key default gen_random_uuid(),
  catalogue_id                  uuid not null references b2b_catalogues(id) on delete cascade,
  source_product_id             uuid not null references products(id) on delete cascade,
  -- Override surface (NULL = inherit from source product)
  markup_multiplier_override    numeric(6,3),
  decoration_type_override      text,
  decoration_price_override     numeric(10,2),
  shipping_cost_override        numeric(10,2),
  metafields                    jsonb not null default '{}'::jsonb,
  is_active                     boolean not null default true,
  sort_order                    integer,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint b2b_catalogue_items_unique_product unique (catalogue_id, source_product_id)
);

create index if not exists b2b_catalogue_items_catalogue_idx
  on b2b_catalogue_items (catalogue_id) where is_active;
create index if not exists b2b_catalogue_items_source_product_idx
  on b2b_catalogue_items (source_product_id);

create table if not exists b2b_catalogue_item_pricing_tiers (
  id                  uuid primary key default gen_random_uuid(),
  catalogue_item_id   uuid not null references b2b_catalogue_items(id) on delete cascade,
  min_quantity        integer not null,
  max_quantity        integer,
  unit_price          numeric(10,2) not null,
  created_at          timestamptz not null default now(),
  constraint b2b_catalogue_item_pricing_tiers_qty_range
    check (min_quantity > 0 and (max_quantity is null or max_quantity >= min_quantity)),
  constraint b2b_catalogue_item_pricing_tiers_unique_min
    unique (catalogue_item_id, min_quantity)
);
```

No `name` / `base_cost_snapshot` / `image_url_snapshot` columns. Every catalogue item resolves through `source_product_id` — for B2B-only items, that points at a synthetic `products` row with `is_b2b_only=true`.

### 5.4 Existing table references

| Table | Role here |
|---|---|
| `products` | Master catalogue. `source_product_id` FK into this. **Now also hosts B2B-only items** (`is_b2b_only=true`). New column `markup_multiplier` replaces read access to `markup_pct`. |
| `product_type_activations` | Used for the **global B2B channel fallback** — orgs with zero assigned catalogues fall back to today's global behaviour (Option A, §7.3). Untouched by this spec. B2B-only products do not get a row here. |
| `product_pricing_tiers` | Master pricing tiers. **Auto-copied** into `b2b_catalogue_item_pricing_tiers` on catalogue-item creation. Master remains the source of truth for the master view; catalogue copies become independent after creation. |
| `product_variants`, `product_color_swatches`, `sizes`, `product_images` | All resolve through `source_product_id`. B2B-only products use these tables natively. |
| `organizations` | Catalogue FK target. |
| `b2b_accounts` | Per-org B2B profile. Not FK'd by catalogues directly; relationship goes via `organization_id` which both share. |
| `user_organizations` | Customer → organization link. Customer `/shop` derives `organization_id` from this, then looks up catalogues. Unchanged. |

### 5.5 Price computation contract

`catalogue_unit_price(p_catalogue_item_id, p_qty)`:

```
1. tier = first b2b_catalogue_item_pricing_tiers row for p_qty (max min_quantity ≤ p_qty)
2. if tier:  base = tier.unit_price
   else:     base = source_product.base_cost
                  * coalesce(item.markup_multiplier_override, source_product.markup_multiplier, 1.0)
3. return round( base * (1 - catalogue.discount_pct / 100), 2 )
```

`effective_unit_price(p_product_id, p_org_id, p_qty)`:

```
1. catalogue_item_id = first b2b_catalogue_items row where catalogue.organization_id = p_org_id
                                                       and catalogue.is_active
                                                       and item.source_product_id = p_product_id
                                                       and item.is_active
2. if catalogue_item_id: return catalogue_unit_price(catalogue_item_id, p_qty)
3. else:                 return get_unit_price(p_product_id, p_org_id, p_qty)
```

`get_unit_price` is updated in this spec to read `markup_multiplier` instead of `markup_pct`. Its signature does not change. Existing consumers (CSR quote builder, Reorder helper) pick up the new arithmetic transparently.

## 6. Staff UI

### 6.1 `/products` extensions

- **Row checkboxes** in the first cell. Selection lives in client React state (resets on navigation; URL persistence is v1.1).
- **Sticky bottom bar** when `selection.size > 0`:
  - "N selected"
  - **Create B2B catalogue from selected** — opens `CreateCatalogueDialog`
  - Clear
- **B2B-only filter** — new tri-state filter:
  - **Master only** (default) — `where is_b2b_only = false`
  - **Both** — no filter
  - **B2B-only** — `where is_b2b_only = true`

The default keeps the master view clean for staff browsing the regular catalogue.

### 6.2 `/catalogues` list

Server component. Columns: Name, Organization, # items, Discount %, Active, Created. Filters: org dropdown, search-by-name, active tri-state. 25/page pagination (matches Products list).

"New catalogue" button in the header opens `CreateCatalogueDialog` with no pre-selected products (direct-create path).

### 6.3 `/catalogues/[id]` tabbed editor

Top tabs: **Items / Pricing tiers / Assignment / Settings**.

**Items tab** — table of catalogue items. Columns:

| Column | Source | Editable? |
|---|---|---|
| Image | `source.image_url` (or first `product_images` row) | — |
| Name | `source.name` | — (edit on master) |
| Base cost | `source.base_cost` | **locked** (greyed; tooltip: "Edit on master product") |
| Markup × | `markup_multiplier_override ?? source.markup_multiplier` | inline; clearing reverts to inherit |
| Decoration type | `decoration_type_override ?? source.decoration_type_default` | inline dropdown: N/A / Screen print / Heat press / Super colour |
| Decoration price | `decoration_price_override ?? source.decoration_price` | inline |
| Shipping | `shipping_cost_override` (no master equivalent today) | inline |
| Active | `is_active` | toggle |
| Actions | — | Tiers / Remove |

Footer: **+ Add from master** button → modal: search + select master products to add. Auto-copies their pricing tiers. Footer: **+ Create B2B-only item** button → modal: name, base_cost, decoration_eligible, optional image_url. Creates a `products` row with `is_b2b_only=true` and a catalogue-item referencing it, in one transaction.

**Pricing tiers tab** — per-item tiers grouped by item. Each group is collapsible. Quick-add row: min_quantity, max_quantity (blank = +), unit_price. Delete inline. Sort by min_quantity asc. Each item group shows a **Refresh from master** action that replaces the catalogue-item's tiers with the current master tiers (destroys local edits).

**Assignment tab** — shows the owning org name + a link to `/b2b-accounts/[orgId]` (route to be built in a sibling spec; 404 is the intended wayfinder for now). Many catalogues per org are allowed; this catalogue's relationship to its org is shown but not editable here (use Settings to change `organization_id` if needed — TODO in sibling spec; for v1, catalogues stay with their original org).

**Settings tab** — name, description, discount_pct, is_active toggle, "Delete catalogue" with confirmation (cascades to items + tiers).

### 6.4 API shapes

```ts
// POST /api/catalogues
type CreateCatalogueBody = {
  organization_id: string
  name: string
  description?: string
  discount_pct?: number          // default 0
  product_ids?: string[]         // optional; when present, server creates catalogue items + auto-copies their master tiers
}
// -> 201 { id }

// POST /api/catalogues/[id]/items
type AddCatalogueItemBody = { source_product_id: string }
// -> 201 { id }   (also auto-copies master tiers)

// POST /api/catalogues/[id]/items/b2b-only
type CreateB2BOnlyItemBody = {
  name: string
  base_cost: number
  decoration_eligible?: boolean
  decoration_price?: number
  image_url?: string
  category_id?: string           // optional; defaults to "Accessories" or "Gadgets" per Chris §27:44
  brand_id?: string              // optional
}
// -> 201 { catalogue_item_id, product_id }

// PATCH /api/catalogues/[id]/items/[itemId]
type UpdateCatalogueItemBody = Partial<{
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
  sort_order: number
}>
// -> 200 { ok: true }
```

### 6.5 Component primitives

All UI built from `src/components/ui/` (`Button`, `Card`, `Input`, `Textarea`, `Badge`, `Checkbox`). New components in `src/components/catalogues/`: `CreateCatalogueDialog.tsx`, `CataloguesTable.tsx`, `CatalogueItemsTable.tsx`, `CatalogueItemPricingTiers.tsx`, `AddFromMasterDialog.tsx`, `CreateB2BOnlyItemDialog.tsx`, `CatalogueSettingsForm.tsx`. Also new: `src/components/products/ProductsSelectionBar.tsx` and `src/components/products/B2BOnlyFilter.tsx`. No new deps. Tab nav matches sub-app #1's pattern.

## 7. Customer portal `/shop` query extension

### 7.1 Semantic — Option A (locked)

- Org has ≥1 active catalogue → sees **only** items from those catalogues (master products and B2B-only synthetic-master products both render through the same code path).
- Org has 0 active catalogues → **falls back** to today's global B2B channel filter (unchanged behaviour).

Rationale: PRT test tenant and every existing customer keep working day-one with zero migration work. Per-org seeding can tighten into Option B/C semantics later.

### 7.2 Updated query (server-side, in `print-room-portal/app/(portal)/shop/page.tsx`)

```ts
// Step 1: collect product ids from this org's active catalogue items.
const { data: catItems } = await admin
  .from('b2b_catalogue_items')
  .select('source_product_id, b2b_catalogues!inner(is_active)')
  .eq('b2b_catalogues.organization_id', context.organizationId)
  .eq('b2b_catalogues.is_active', true)
  .eq('is_active', true)

const scopedProductIds = Array.from(
  new Set((catItems ?? []).map((r) => r.source_product_id as string)),
)
const hasCatalogueScope = scopedProductIds.length > 0

let q = admin.from('products')
  .select('id, name, sku, image_url, brand_id, category_id, moq', { count: 'exact' })
  .eq('is_active', true)
  .order('name')
  .range(offset, offset + limit - 1)

if (hasCatalogueScope) {
  q = q.in('id', scopedProductIds)
} else {
  q = q
    .select('id, name, sku, image_url, brand_id, category_id, moq, ' +
            '_channel:product_type_activations!inner(product_type,is_active)',
            { count: 'exact' })
    .eq('_channel.product_type', 'b2b')
    .eq('_channel.is_active', true)
}
```

Pricing preview on each card switches from `get_unit_price` → `effective_unit_price` (single call site change; same signature).

### 7.3 B2B-only items on the customer side

Because B2B-only items are real `products` rows (`is_b2b_only=true`), they render through the existing `/shop/[productId]` PDP, the existing cart, the existing checkout, and the existing quote-request submit path. **No customer-side schema or route changes.** The only differentiator is they only appear in `/shop` when the viewing org has a catalogue containing them.

### 7.4 Caching

- `/shop` is `dynamic = 'force-dynamic'` today — no cache. Keep it.
- No CDN cache on B2B catalogue lookups (per-org, authenticated).
- React `cache()` for in-render de-dup is safe but not required.

### 7.5 Performance

- Catalogue-items-for-org query returns typically ≤ 50 rows. Covered by `b2b_catalogue_items_catalogue_idx` + the index on `b2b_catalogues.organization_id` (via `b2b_catalogues_org_active_idx`).
- Product fetch is a single `.in('id', scopedProductIds)` — bound by the size of the catalogue, not the master catalogue.
- `effective_unit_price` RPC is one call per card; no regression vs today's `get_unit_price` pattern.

## 8. Auth, permissions, RLS

- Staff `(portal)` middleware already gates `/catalogues/**` and `/api/catalogues/**`. Unchanged.
- Permission key: `catalogues:write`. Access rule: `role in ('admin','super_admin') or permissions @> '["catalogues:write"]' or permissions @> '["catalogues"]'`. Mirrors sub-app #2 pattern.
- Sidebar nav: "Catalogues" entry visible only to users with the permission.
- RLS:
  ```sql
  alter table b2b_catalogues enable row level security;
  alter table b2b_catalogue_items enable row level security;
  alter table b2b_catalogue_item_pricing_tiers enable row level security;

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
- Staff writes happen via service-role on API routes — RLS does not apply. The staff API guards via `requireCataloguesStaffAccess` (mirrors `requireInventoryStaffAccess`).

## 9. Seed + migration plan

1. Apply `20260424_products_markup_multiplier` migration first (rename + sync trigger). Verify a sample row: `select markup_pct, markup_multiplier from products limit 5` — multipliers should equal `1 + pct/100` rounded to 3dp.
2. Apply `20260424_products_is_b2b_only` migration (column + index).
3. Apply `20260424_b2b_catalogues_tables` (three new tables + RLS).
4. Apply `20260424_b2b_catalogues_rpcs` (`catalogue_unit_price`, `effective_unit_price`, plus the `get_unit_price` rewrite to use `markup_multiplier`).
5. Seed one demo catalogue for PRT (`organization_id = ee155266-200c-4b73-8dbd-be385db3e5b0`):
   ```sql
   insert into b2b_catalogues (organization_id, name, discount_pct, created_by_user_id)
   values ('ee155266-200c-4b73-8dbd-be385db3e5b0', 'PRT Demo Catalogue', 0,
           (select id from auth.users where email = 'hello@theprint-room.co.nz'));
   ```
   Then add 3 catalogue items via the staff UI (auto-copies master tiers). PRT's `/shop` view switches from global-channel fallback to catalogue-scope after seeding.
6. Smoke: log in as a PRT user, hit `/shop`, verify seeded items render and prices match `effective_unit_price` × `discount_pct`.
7. Announce sub-app #3 to staff. `middleware-pr` is unaffected — the markup sync trigger keeps it writing to `markup_pct` while new code reads `markup_multiplier`.

All Supabase writes are 🟡 — staff present SQL to Jamie before applying.

## 10. 4-axis stack rationale ("why this stack")

- **Rendering** — Server components for catalogue list + detail initial render (matches sub-app #1/#2). Client components for inline edit rows in Items tab. `/shop` stays `dynamic = 'force-dynamic'` — per-request auth + per-org scope means caching buys nothing and risks leak.
- **Caching** — No CDN cache for any authenticated surface. React `cache()` for in-render de-dup. Catalogue-items-for-org lookup is cheap (single indexed query) so memoisation isn't performance-critical.
- **Performance** — Two indexed round-trips on `/shop` with catalogue scope (catalogue-items + master products by `in (sourceIds)`). Bound by master product fetch, not catalogue lookup. The dual-column markup sync trigger fires once per row write; impact is sub-millisecond.
- **Ecommerce pattern** — Catalogue-as-duplication (Chris's Shopify mental model) implemented as references-with-overrides (normalised). Override columns NULL = inherit. Catalogue-level discount is the outermost multiplier so master-product price changes flow through unless explicitly overridden. **B2B-only items live in the master `products` table with `is_b2b_only=true`** — synthetic-master approach keeps cart/checkout/quote-items identity uniform (`product_id + variant_id`) with zero schema ripple.

## 11. Decisions made (locked 2026-04-24)

| # | Decision | Locked answer |
|---|---|---|
| 1 | Customer /shop semantic | **A** — catalogue scope if assigned, fallback to global B2B channel if none |
| 2 | Catalogue ↔ org cardinality | **Many catalogues per org allowed** (no UNIQUE on `organization_id`) — supports seasonal catalogues per Jamie 2026-04-24 |
| 3 | Base-cost override at catalogue level | **Not allowed** — locked; always inherits from master product |
| 4 | Markup value type on master | **`markup_multiplier numeric(6,3)`** added with sync trigger to existing `markup_pct`. Both columns coexist during `middleware-pr` parity period |
| 5 | B2B-only items on customer side | **Synthetic-master approach** — B2B-only items are real `products` rows (`is_b2b_only=true`). Full PDP/cart/checkout support inherited from master path |
| 6 | Visual override flags (green/red/orange) | **Data support only** — UI visualisation deferred to sibling spec |
| 7 | Catalogue-item images for custom designs | **Deferred** — see §12. Likely follow-up table `b2b_catalogue_item_images` |
| 8 | Metafields on items | `jsonb` bag; vocabulary lock deferred |
| 9 | Permission key | `catalogues:write` |
| 10 | Seed | PRT Demo Catalogue seeded post-migration via UI (3 items, auto-copied master tiers) |
| 11 | `product_pricing_tiers` copy-on-create | **Auto-copy on catalogue-item creation**. "Refresh from master" action available on the Tiers tab to re-pull |
| 12 | Catalogue deletion | Hard delete (cascades to items + tiers) |

## 12. Dependencies & follow-ups (not in this spec)

**Sibling specs that should follow this one:**

- **Category-driven markup rules** — bulk edit markup per category per channel (Chris §10:51). Master-product markup inheritance in this spec is a stand-in until the rule engine lands.
- **Visual override flags** — colour-coded pricing cells (Chris §18:01). Data support is here; UI binding in the sibling spec.
- **Customer-portal Catalog sidebar rename + cart context isolation** — the customer-portal's `/shop` sidebar label updates to "Catalog" and the cart chip scopes to catalogue routes (aligns with the memory note [Cart Chip Top-Right, Not Sidebar](../../../../memory/feedback_cart_chip_top_right.md)).
- **Per-catalogue-item image overrides** — `b2b_catalogue_item_images(catalogue_item_id, image_url, view_type, sort_order, is_primary)`. Customer PDP gallery resolves: catalogue-item images first (account-specific designs uploaded by account managers), fall back to master product images. Pairs with the design-proof / reorder workstream Chris flagged in §46-49.
- **Metafield vocabulary lock** — typed columns or strict JSON schema for gender/fabric/safety.
- **Inventory tab separation in the product editor** (sub-app #1 amendment).
- **Reorder UI simplification** (customer-portal spec).
- **Workwear front-end landing page** (standalone).
- **`b2b-accounts/[orgId]` staff page** — currently does not exist. Will host the catalogues panel that consumes `/api/catalogues/by-org/[orgId]`.
- **`markup_pct` column drop** — when `middleware-pr` is decommissioned (sub-app #1 §9), drop the trigger and the legacy column.
- **`/products` UI swap to multiplier display** — sub-app #1's product editor's Pricing & Costs row currently shows `Markup %`. After this spec, the column rename has happened but the editor UI continues to write `markup_pct` (which the sync trigger forwards). A follow-up sub-app #1 amendment swaps the editor to read/write `markup_multiplier` directly so the displayed unit matches the stored unit.

**Consumed contracts (already shipped):**

- `organizations`, `user_organizations`, `b2b_accounts`, `products`, `product_type_activations`, `product_pricing_tiers`, `product_variants`, `product_color_swatches`, `sizes`, `product_images` — all from earlier sub-apps.
- `get_unit_price` RPC — body rewritten to read `markup_multiplier`; signature unchanged so existing callers (CSR quote builder, customer reorder helper) require no changes.

**Supersedes:**

- [customer-b2b-checkout-mvp-design §3](../../../../print-room-portal/docs/superpowers/specs/2026-04-20-customer-b2b-checkout-mvp-design.md) "Per-company catalogues — v1.1" item.

## 13. Verification

- All four migrations apply cleanly on a fresh shadow DB; re-running each is a no-op.
- Sync trigger smoke: `update products set markup_pct = 25 where id = '<x>'` — `markup_multiplier` reads `1.250` after. Reverse: `update products set markup_multiplier = 1.75 where id = '<x>'` — `markup_pct` reads `75.00`.
- `get_unit_price` returns the same value before and after the migration for a sample of existing products (within 1 cent rounding).
- Staff API: `POST /api/catalogues` with `product_ids` creates catalogue + N items + N copies of each item's master tiers in one round-trip; without `product_ids` creates empty catalogue.
- Staff API: `POST /api/catalogues/[id]/items/b2b-only` creates one `products` row (`is_b2b_only=true`) and one `b2b_catalogue_items` row in a single transaction; rollback on either failure.
- Staff UI: ticking ≥1 product on `/products` reveals the sticky action bar; submitting redirects to `/catalogues/[id]` with all selected items pre-populated and their tiers visible on the Tiers tab.
- `/products` filter: default view hides `is_b2b_only=true` rows; "B2B-only" filter shows them.
- Catalogue editor Items tab: clearing `markup_multiplier_override` reverts the displayed × value to the inherited master value on next render.
- Pricing-tiers tab: "Refresh from master" replaces the catalogue item's tiers with the current master tiers (destroys local edits with confirmation prompt).
- Customer `/shop`:
  - Org with no catalogue → identical product list to today's global-channel query.
  - Org with an active catalogue holding 3 source-products + 1 B2B-only item → exactly those 4 products render. PDP for the B2B-only item works through `/shop/[productId]`. Adding to cart works.
  - Catalogue deactivated → org returns to global-channel fallback within one render.
- `effective_unit_price`: for an org-product in a catalogue, returns `base * markup_multiplier * (1 - discount_pct/100)`; for an org-product outside any catalogue, equals `get_unit_price`.
- RLS: an authenticated user from org A cannot select catalogues or items from org B (Supabase test: `set local request.jwt.claim.sub = '<other-org-user>'`).
- Permission: staff user without `catalogues:write` gets 403 on `POST /api/catalogues`.
- `middleware-pr` regression: edit a uniforms product's markup in `middleware-pr`'s editor → `markup_multiplier` reflects the new value within the same transaction (sync trigger). `effective_unit_price` returns the same value as if a `markup_multiplier` write had landed directly.
- PRT seed catalogue round-trip: create, add items (auto-copy tiers visible on Tiers tab), view as PRT customer, delete catalogue, verify PRT returns to global-channel fallback.

---

**Status:** decisions locked, awaiting Jamie's go-ahead to execute the implementation plan.
