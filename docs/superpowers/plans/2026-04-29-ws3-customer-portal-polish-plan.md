# WS3 - Customer Portal Premium Polish Plan

**Date:** 2026-04-29
**Repos touched:** `print-room-portal`
**Branch context:** continue from `feat/ws4-pricing-visibility`; WS4 pricing primitives are the baseline.

## Goal

Polish the existing customer portal surfaces without changing schema, APIs, pricing math, or introducing animation libraries. Catalogue-scoped customers must see catalogue pricing language. Tiered non-catalogue customers may see tier labels and discount lines through the WS4 primitives.

## Scope

- `/shop`: stronger header, account-pricing context, branded empty/loading/error states, product-card polish.
- PDP: image panel polish, variant/quantity controls, CSS-only add-to-cart feedback, preserve WS4 `PriceBreakdown`.
- `/cart`: empty state, confidence copy, tidy pricing/terms panel, preserve cart math.
- `/checkout`: step framing, clearer shipping/review sections, same breakdown as cart.
- `/order-tracker`: polished loading/empty/filter states and clearer project framing.
- `/proofs`: add MVP placeholder surface. Staff portal remains proof owner; customer archive is not built in MVP.
- Shared UI: local, dependency-free primitives only where useful (`PortalEmptyState`, `PortalSkeleton`).

## Non-Goals

- No migrations.
- No new API contracts.
- No new animation packages.
- No changes to WS4 `pricingMode`, gross/catalogue correction, or checkout submit pricing.
- No Phase B request-access flow.
- No customer proof approval/archive implementation.

## Implementation Tasks

- [ ] Add `components/ui/PortalEmptyState.tsx` and `components/ui/PortalSkeleton.tsx`.
- [ ] Polish `/shop` using existing server data and pass `pricingMode` into product cards unchanged.
- [ ] Polish `ProductCard` and `ProductDetailClient` with CSS transitions only.
- [ ] Polish `CartClient`, `CartTable`, and checkout review layout while preserving `computeOrderBreakdown` inputs.
- [ ] Polish `/order-tracker` loading, empty, and filtered-empty states.
- [ ] Add `/proofs` placeholder route and sidebar nav item gated to company users.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Manual smoke PRT paths: `/shop`, PDP, `/cart`, `/checkout`, `/order-tracker`, `/proofs`.

## Verification Notes

- PRT catalogue users show `Catalogue pricing` and no fake wholesale discount line.
- Cart and checkout render the same breakdown values for the same cart lines.
- Motion is CSS-only and respects reduced-motion where added.
- Empty/error/loading states do not block existing order placement.
