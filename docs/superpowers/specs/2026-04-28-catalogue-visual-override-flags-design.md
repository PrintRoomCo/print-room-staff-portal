# Catalogue Editor — Visual Override Flags — Design Spec

**Date:** 2026-04-28
**Status:** Draft (design approved, awaiting team copy review per Q1)
**Owner:** Jon (jon@theprint-room.co.nz)
**Repo:** `print-room-staff-portal` (Next.js 16, Tailwind v4)
**Source:** Chris's 2026-04-24 meeting §18:01 (visual override colour coding); deferred from sub-app #3 spec §3 (non-goals) and §12 (sibling spec).

## 1. Context

Sub-app #3 (B2B Catalogues) shipped 2026-04-27 with override columns on `b2b_catalogue_items` (`markup_multiplier_override`, `decoration_type_override`, `decoration_price_override`, `shipping_cost_override`). NULL = inherit from master; non-NULL = per-catalogue override. The data shape is correct; the UI today does not surface inherited vs. overridden state — staff have to read the underlying value and the master to know which is which.

Chris flagged this in the 2026-04-24 meeting (§18:01). Sub-app #3 spec §3 deferred the visualisation to a sibling spec. This is that spec.

## 2. Goals

- One-glance visual signal on every pricing column in the catalogue editor (`CatalogueItemsTable`) showing inherited / overridden / locked.
- Tooltip on hover showing the master value (when applicable) so staff don't need to navigate to the master product to compare.
- Zero schema or API change — pure UI on data already exposed.

## 3. Non-goals

- Colour-blind alternative (icons + colour). Tracked as follow-up; v1 ships dots only.
- Tooltip library (Radix, Floating UI). v1 uses native `title` attribute.
- Bulk-revert UI ("clear all overrides on this row"). Future enhancement.
- Indicators on the Pricing Tiers tab. v1 covers the Items tab only — tier rows have a different override semantic (auto-copied snapshot, "Refresh from master" already exists).
- Indicators on the read-only customer surfaces (`/shop`, PDP). Customers don't see overrides; flags are a staff-facing affordance.

## 4. Architecture

Single new presentational component:

```
src/components/catalogues/OverrideFlag.tsx
```

Consumed by `src/components/catalogues/CatalogueItemsTable.tsx`. No route changes, no API changes, no schema changes.

## 5. Colour semantics (locked)

| State | Colour | Trigger |
|---|---|---|
| Inherited | 🟢 green (`bg-green-500`) | override is `null` AND master has a non-null value |
| Overridden | 🟠 orange (`bg-orange-500`) | override is non-`null` |
| Locked | 🔴 red (`bg-red-500`) | column is structurally non-overridable (base cost) |
| (no flag) | — | no override AND no master value (empty cell) |

**Rule:** the dot is a flag *about a value*. If there is no value (empty cell), there is nothing to flag — render no dot. Reduces noise on rows where decoration / shipping aren't applicable.

## 6. Component contract

```tsx
type OverrideFlagState = 'inherited' | 'overridden' | 'locked'

interface OverrideFlagProps {
  state: OverrideFlagState
  /** Master value to surface in the tooltip when state is 'overridden'. */
  masterValue?: string | number | null
}
```

Render:

```tsx
<span
  className={cn(
    'inline-block h-2 w-2 rounded-full shrink-0',
    state === 'inherited' && 'bg-green-500',
    state === 'overridden' && 'bg-orange-500',
    state === 'locked' && 'bg-red-500',
  )}
  title={tooltipFor(state, masterValue)}
  aria-label={tooltipFor(state, masterValue)}
/>
```

Tooltip copy (see §7) is computed by `tooltipFor`. Native `title=` is sufficient for v1 — staff dwell on rows long enough that the browser delay is acceptable.

## 7. Tooltip copy

Copy is **draft pending team confirmation** (see §11). Initial values:

| State | Tooltip |
|---|---|
| Inherited | `"Inherited from master. Edit to override."` |
| Overridden | `"Overridden — clear field to revert to master ($1.50)."` (master value substituted; if master is null, falls back to `"Overridden. No master value."`) |
| Locked | `"Locked. Edit on the master product."` |

Master-value formatting:
- Markup: `1.500` (3dp, matches input).
- Decoration type: string label (e.g. `Screen print`).
- Decoration price / shipping: `$X.XX` (2dp, currency prefix).

## 8. Per-column flag rules

| Column | Inherited dot | Overridden dot | Locked dot | No-dot case |
|---|---|---|---|---|
| Image | — | — | — | (no flag — image is from master) |
| Name | — | — | — | (no flag — name is from master) |
| Base cost | — | — | always 🔴 | — |
| Markup × | `markup_multiplier_override is null` (master always non-null, default 1.0) | override set | — | — |
| Decoration type | override null AND master non-null | override set | — | both null |
| Decoration price | override null AND master non-null | override set | — | both null |
| Shipping | — (no master equivalent) | override set | — | override null |
| Active | — | — | — | (toggle, not a value) |

The Decoration type select already shows an explicit `"— inherit —"` option when override is null. The dot reinforces that signal but does not replace the select option.

## 9. UI integration

`CatalogueItemsTable.tsx` row body:

```tsx
<td className="px-2 py-2">
  <div className="flex items-center gap-2">
    <OverrideFlag state="inherited" masterValue={it.source.markup_multiplier} />
    <input … />
  </div>
</td>
```

Flag computation lives inline next to each cell to avoid a single bloated `flagState(item, column)` switch. Five sites to update; each ~3 lines.

## 10. 4-axis stack rationale

- **Rendering** — staff page, server shell + client island (existing pattern). Flag is a pure presentational `<span>` rendered as part of the client island. No new client state.
- **Caching** — n/a, authenticated staff route, `dynamic = 'force-dynamic'` already.
- **Performance** — one extra `<span>` per cell across 5 columns × N items. Sub-millisecond. No re-render cost over today.
- **Ecommerce pattern** — n/a (internal tooling).

## 11. Open questions (non-blocking)

- **Q1 — tooltip copy.** Wording in §7 is the draft I'd ship. Chris/Jon review pending; deltas land as a follow-up commit.
- **Q2 — colour-blind affordance.** Icon-in-dot or icon-after-dot. Defer to v1.1 unless team flags as blocking.

## 12. Verification

- Add 1 master product to PRT Demo Catalogue (`ba207fd4-fffc-4fa7-9446-2fd5c7ca7035`), no overrides → markup / dec-type / dec-price all 🟢; base cost 🔴; shipping no dot.
- Override markup → cell flips 🟢 → 🟠; tooltip text contains master value formatted to 3dp.
- Clear markup override (set input empty) → flips back 🟢.
- Set shipping override → 🟠 (never green); clear → no dot.
- Decoration type/price on a non-decoration item (master null) → no dot when override null.
- B2B-only synthetic-master product: behaves identically to a master-sourced item (the synthetic row IS the master). No special-case rendering needed.

## 13. Dependencies

- Consumes existing `b2b_catalogue_items` shape (`*_override` columns + `source` join). No new contracts.
- Pairs with sub-app #3's locked decision §11 row 6 — "data support only; UI visualisation deferred to sibling spec." This spec satisfies that follow-up.
