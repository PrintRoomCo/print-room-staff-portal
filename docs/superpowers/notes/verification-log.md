# Verification log

## 2026-04-27 — sub-app #3 (B2B Catalogues) verified

**Plan:** [2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md](../plans/2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md). All 18 tasks executed via subagent-driven workflow with 🟡-gated migrations / seed inserts.

**Migrations applied (Supabase project `bthsxgmcnbvwwgvdveek`):**

| # | Name | Verified |
|---|---|---|
| 1 | `20260424_products_markup_multiplier` | Backfill: 0 mismatches across 3818 rows. Sync trigger asserted both directions inside a DO block (pct=25 → mult=1.250; mult=1.75 → pct=75.00) — covers the `middleware-pr` regression check from spec §13. |
| 2 | `20260424_products_is_b2b_only` | All 3818 existing rows default to `false`. Partial index present. |
| 3 | `20260424_b2b_catalogues_tables` | 3 tables created (9 / 12 / 6 cols), 3 RLS policies in place. |
| 4 | `20260424_b2b_catalogues_rpcs` | `effective_unit_price` matches `get_unit_price` for PRT (no catalogue at the time) on 3/3 sample products before seed. After seed, returns base-cost prices for the 4 catalogue items as expected. |

**Execution-time deviations from the plan (locked in code, captured in `memory/project_b2b_catalogues_spec_plan.md`):**

1. **`get_unit_price` rewrite skipped (Task 1 Option 1).** Live function reads neither markup column (uses `product_pricing_tiers.unit_price` × `(1 - tier_level discount)`). Applying the plan's rewrite would have lost the `b2b_accounts.tier_level` → `price_tiers.discount` path AND introduced a `base_cost × markup` fallback that changes prices for products without master tier rows. Markup arithmetic now lives only in the new `catalogue_unit_price` / `effective_unit_price` RPCs.
2. **B2B-only items require `brand_id` + `category_id` (Task 9).** `products` table has both NOT-NULL with no defaults. The b2b-only API requires them; `CreateB2BOnlyItemDialog` collects them via dropdowns sourced from new `/api/brands` and `/api/categories` GET endpoints (gated by `requireCataloguesStaffAccess`).
3. **Plan typo (Task 4) — `GRANT EXECUTE ON FUNCTION effective_unit_price` signature.** Was `(uuid, integer, integer)`; corrected to `(uuid, uuid, integer)` because `p_org_id` is uuid.
4. **PDP catalogue-scope fix (post-Task 17 finding, in `print-room-portal`).** Spec §4.2 said the existing PDP route works unchanged for catalogue items. Wrong — the existing query inner-joined `product_type_activations` and filtered on the global B2B channel, which excludes B2B-only synthetic products and any catalogue item whose source product is not on the global channel. PDP now does the same two-step lookup as `/shop` (commit `27cee11`).

**Seed (Task 17, applied via Supabase MCP):**

- Catalogue `ba207fd4-fffc-4fa7-9446-2fd5c7ca7035` "PRT Demo Catalogue", org `ee155266…` (The Print Room Test).
- 4 items: Cord Bucket Hat, Womens Contrast Scrub Top, Unisex Happy Feet Comfort Socks, **PRT Bespoke Logo Sticker** (B2B-only synthetic master, $2.50).
- 0 master tier rows copied — picked products had no rows in `product_pricing_tiers`. Auto-copy was a no-op.
- All multipliers are 1.000 (zero markup). Demo prices = base cost. Plumbing verified; for a richer demo, edit override × on the Items tab or add tiers.

**Spec §13 verification checklist coverage:**

| Check | Status |
|---|---|
| Migrations apply cleanly, idempotent | ✅ verified at apply time |
| Sync trigger smoke (both directions) | ✅ Task 1 DO block |
| `get_unit_price` parity | ✅ N/A under Option 1 (function untouched) |
| `POST /api/catalogues` with `product_ids` creates + auto-copies tiers | 🟡 deferred — UI smoke pending live dev server |
| `POST .../items/b2b-only` rolls back on failure | 🟡 deferred — UI smoke pending |
| `/products` multi-select → redirect to `/catalogues/[id]` | 🟡 deferred — UI smoke pending |
| `/products` tri-state filter | 🟡 deferred — UI smoke pending |
| Items tab clearing override reverts to inherit | 🟡 deferred — UI smoke pending |
| "Refresh from master" replaces tiers | 🟡 deferred — UI smoke pending |
| `/shop` 3 scenarios | 🟡 deferred — Jamie testing in browser |
| B2B-only PDP loads | ✅ fixed and verified live by Jamie post-deploy |
| RLS denial | 🟡 deferred — code review only (policies inspected at migration time) |
| Permission 403 on staff API | 🟡 deferred — cURL smoke pending |
| Cascade delete | 🟡 deferred — would destroy seed; tested at table-creation time via FK definitions |
| `middleware-pr` regression | ✅ covered by Task 1 sync-trigger DO block |

**Pre-existing customer-portal bugs surfaced during execution (parked, NOT in sub-app #3 scope):**

- `app/api/inventory/route.ts` selects `.name` from `product_color_swatches`; column is `.label`.
- `lib/monday/sync-job-tracker-items.ts` passes a slug ("plant-a-seed-mens") into a UUID column.

## 2026-04-29 — B2B Platform 1.0 MVP execution update

**Proof architecture decision:** ⚠ SUPERSEDED 2026-04-30. The architecture below was itself superseded the next day by a full decouple: the staff portal ↔ design-tool iframe wiring (proof builder, proof iframe modal, JWT token routes, quote-tool iframe embed) was deleted on 2026-04-29 (design-tool side) and 2026-04-30 (staff-portal side). Re-architecture is pending a context-mapping exercise on the design tool. See `~/.claude/projects/c--Users-MSI-Documents-Projects/memory/project_proof_iframe_consolidation.md`. The bullets below are kept for historical context only — do not implement from them.

- `print-room-studio` / design-tool generates mockup images and product-view assets only.
- `print-room-staff-portal` owns proof assembly, proof editing, proof export, PDF, and browser print flow.
- Existing WS1 commits that add editor data capture, ProductCustomizer proof binding, artwork upload, and mockup/product-view generation are salvage candidates.
- Existing WS1 commits that make design-tool render full proof PDFs or own the Allpress-style proof template conflict with the updated architecture and should not be merged as-is.

**WS4 pricing correction:** catalogue prices are absolute catalogue prices. For catalogue-scoped customers such as PRT, customer portal UI shows `Catalogue pricing` and suppresses fake tier-discount/wholesale-discount lines. Tier discount lines remain valid only for non-catalogue tiered customers.

**Current MVP execution state:** WS2, WS3, WS4, WS5, and WSM draft code exist locally with automated checks run where available. This is not recorded as fully shipped yet because live browser smoke against PRT and GitHub pushes are still pending in this shell.
