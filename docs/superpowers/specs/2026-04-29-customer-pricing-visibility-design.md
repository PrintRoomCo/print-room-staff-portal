# Customer Pricing Visibility — Design Spec

**Date:** 2026-04-29
**Status:** Draft (locked direction per Chris's 2026-04-29 feedback + MVP one-pager Axis 3)
**Owner:** Jon
**Repo:** `print-room-portal` (+ minor `print-room-staff-portal` for tier label config)

## 1. Context

Today the customer-portal silently applies the tier discount via `effective_unit_price` (which calls `get_unit_price` for non-catalogue items, applying `b2b_accounts.tier_level → price_tiers.discount`). The customer sees the final discounted unit price but doesn't know their tier discount was applied. They also don't see how decoration pricing is broken out, how the catalogue scope affects them, or what their tier is named.

Chris's 2026-04-29 feedback: "the pricing associated with the products should be surfaced on the customer's end. there should be a way to apply the organisation's tier to the products pricing as there will be a global discount, rather than individually per product. prices being made from master will have decoration pricing associated with the product and will pull through to the product when being added."

This spec covers making pricing transparent and breaking it into base / decoration / tier discount / total — so customers can see exactly what they're paying and why.

## 2. Goals

- Customer sees their tier name (not just "Tier 2") on `/shop`, PDP, cart, checkout
- Customer sees tier discount as an explicit line item, not silently baked into prices
- Customer sees decoration price as a separate line when the product has decoration applied
- Customer can confidently answer "why is my total $X?" by reading the breakdown

## 3. Non-goals

- **Per-product manual override of tier discount** — tier is a global modifier, not per-product
- **Customer-facing tier upgrade flow** — tier changes are sales-driven, not self-service
- **Showing the catalogue markup_multiplier breakdown** — masters this complexity from the customer (they see the post-markup price as base)
- **Currency conversion** — NZD only
- **Tax breakdown beyond GST** — existing GST line continues unchanged
- **Promotional / coupon discounts** — out of scope; tier discount is the only discount

## 4. Architecture

No new tables, no new APIs, no schema changes. Pure surfacing of existing data.

### 4.1 Tier name mapping

Currently `b2b_accounts.tier_level` is `1 | 2 | 3`. `price_tiers.tier_id` is `'1' | '2' | '3'` with a `discount` numeric field.

Add a friendlier label on the customer side via a mapping config:

```ts
// print-room-portal/lib/pricing/tier-labels.ts
export const TIER_LABELS: Record<number, string> = {
  1: 'Wholesale',
  2: 'Trade',
  3: 'Standard',
}
```

Locked names per spec §11. If staff want different labels later, they can edit this file or it can be moved to a `tier_labels` settings table in v1.1.

### 4.2 Pricing context

A new `usePricingContext()` hook in `lib/pricing/usePricingContext.ts` exposes the customer's tier + discount + name to all surfaces. Pulls from existing `getCompanyAccess()` results — no new server query.

### 4.3 Where the breakdown surfaces

| Surface | What's added |
|---|---|
| `/shop` cards | Tier badge ("Trade pricing") + "from $X.XX" effective unit price |
| PDP price block | Base unit price → decoration line (if applicable) → tier discount line ("Trade −10%") → final |
| `/cart` line items | Per-item: unit × qty / decoration row / line subtotal |
| `/cart` totals | Subtotal / decoration total / tier discount line / GST / total |
| `/checkout` review | Same breakdown as cart, plus payment-terms-confidence copy |
| Welcome page | Tier badge as part of greeting ("Welcome — you have Trade pricing") |

### 4.4 The tier discount calculation

Currently `get_unit_price` applies the discount in SQL: `unit_price × (1 - discount)`. For UI display we need the math broken out:

```ts
const subtotalBeforeDiscount = lineItems.reduce(/* sum of (gross_unit_price × qty + decoration_price) */)
const tierDiscountAmount = subtotalBeforeDiscount × tierDiscount  // e.g. 0.10 for Trade
const subtotalAfterDiscount = subtotalBeforeDiscount - tierDiscountAmount
const gst = subtotalAfterDiscount × 0.15  // NZ GST
const total = subtotalAfterDiscount + gst
```

The DB returns the post-discount unit price (per `effective_unit_price`); for the UI we want the gross. Two options:

**A.** Add a `gross_unit_price()` SQL function that returns the pre-discount price (call alongside `effective_unit_price`)
**B.** Compute gross client-side: `gross = effective ÷ (1 - tier_discount)`

A is cleaner. B is simpler and avoids a new function. Going with **B** — a one-line client computation, no SQL surface increase.

## 5. Data model

**No changes.** Existing tables sufficient:
- `b2b_accounts.tier_level` (existing)
- `price_tiers.discount` (existing)
- `b2b_catalogue_items.decoration_price_override` + `products.decoration_price` (existing)
- `effective_unit_price` RPC (existing — canonical price function per `project_b2b_pricing_canonical.md`)

## 6. UI components added/modified

### 6.1 New primitives

- `components/pricing/TierBadge.tsx` — tier name as branded chip
- `components/pricing/PriceBreakdown.tsx` — base / decoration / tier discount / GST / total layout
- `components/pricing/DiscountLine.tsx` — single discount line with strikethrough effect

### 6.2 Modified surfaces

- `components/shop/ProductCard.tsx` — add `<TierBadge />` to top-right of card; "from $X.XX" uses `effective_unit_price`
- `components/shop/ProductDetailClient.tsx` — replace single price line with `<PriceBreakdown />`
- `components/cart/CartTable.tsx` — per-item: show decoration line if applicable
- `components/cart/CartTotals.tsx` — show full breakdown via `<PriceBreakdown />`
- `app/(portal)/checkout/CheckoutClient.tsx` — review section uses `<PriceBreakdown />`
- `app/(portal)/welcome/page.tsx` (per WS5) — TierBadge in greeting

## 7. API contracts

**No new API endpoints.** All existing data already returned by:
- `getCompanyAccess()` (returns tier_level + isCompanyUser)
- PDP page query (returns brackets + master decoration_price)
- Cart state (localStorage — existing)
- Checkout submit (existing)

The only addition is a small extension to `getCompanyAccess()` return shape: include `tierLabel` + `tierDiscount` from the existing `price_tiers` lookup.

```ts
interface B2BCustomerAccess {
  // existing fields...
  tier: string                    // existing — numeric tier_level as string
  tierLabel?: string              // NEW — friendly name from TIER_LABELS map
  tierDiscount?: number           // NEW — fractional discount (0.10 for 10%)
}
```

## 8. 4-axis stack rationale

- **Rendering:** server components for the static parts; client components for cart/checkout (existing pattern). Tier label config is a static import — no fetch
- **Caching:** unchanged
- **Performance:** zero new queries, zero new bundle (the small primitive components total <2KB gzipped)
- **Ecommerce pattern:** transparent pricing — every total visible to the customer is decomposable into known components (base, decoration, tier discount, GST). No "magic numbers"

## 9. Decisions locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | Tier label naming | Tier 1 = "Wholesale", Tier 2 = "Trade", Tier 3 = "Standard" |
| 2 | Where labels live | `lib/pricing/tier-labels.ts` config (move to DB in v1.1 if needed) |
| 3 | Gross-price source | Client-side compute (`effective ÷ (1 - tier_discount)`) — no new SQL function |
| 4 | Decoration line | Always shown when product has decoration applied (not toggleable) |
| 5 | Tier badge placement | Card top-right on `/shop`, near price block on PDP, in greeting on welcome page |
| 6 | Tier discount line copy | "Your [Tier Label] discount: −$X.XX (−N%)" |
| 7 | Empty-decoration state | If decoration_price is 0 or null, no line shown (don't render "$0.00 decoration") |

## 10. Verification

- Sign in as PRT customer (Tier 1 / Wholesale) → `/shop` shows "Wholesale pricing" badge on each card
- PDP for a product with decoration shows: Base $10.00 / Decoration $2.50 / Wholesale −15% −$1.88 / Total $10.62 (illustrative)
- Cart shows per-item breakdown + totals breakdown matching PDP math
- Checkout review shows identical breakdown
- Welcome page greeting: "Welcome — you have Wholesale pricing"
- Tier 2 customer sees "Trade" everywhere
- Customer with no `b2b_accounts` row falls back to Standard (Tier 3) gracefully
- Decoration-eligible product without applied decoration: no decoration line shown
- All breakdown numbers add up (sum of components = total)

## 11. Dependencies & follow-ups

- Pairs with WS3 (customer-portal premium polish) — primitives styled to match brand
- Independent of WS1 (proofs) and WS5 (onboarding)
- v1.1 follow-ups:
  - Tier label config in DB (allowing staff to customize without code changes)
  - Per-customer custom tier name override
  - Promo / coupon discount stacking
  - Tier comparison page ("Why upgrade to Trade")

## 12. Open questions

- Q1 — should the cart show the tier discount as a separate line, or strike through the original price next to each line item? Default: separate line for clarity (avoids cluttered per-item rows)
- Q2 — does the welcome page show the tier discount percentage, or just the tier name? Default: just the name (avoids price discussion at first impression)
- Q3 — what about customers with no b2b_account row (individuals)? Default: show no tier badge (just standard pricing); they wouldn't be invited to MVP anyway
