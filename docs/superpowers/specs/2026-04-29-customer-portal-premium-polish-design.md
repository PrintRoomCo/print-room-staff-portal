# Customer Portal — Premium Polish — Design Spec

**Date:** 2026-04-29
**Status:** Draft (locked direction per MVP one-pager Axis 3 = C — premium polish on customer surfaces)
**Owner:** Jon
**Repo:** `print-room-portal`

## 1. Context

The customer-portal's `/shop`, PDP, `/cart`, `/checkout`, `/order-tracker` and `/proofs` surfaces shipped functionally over the last two weeks but visually feel like a stitched-together internal tool. Account managers will invite 5 hand-picked customers in MVP launch; first impressions of the portal determine whether those customers stay engaged after the trial.

The bar for "premium" is set by the rebuilt `print-room-staff-portal/src/app/(portal)/proofs/page.tsx` shipped today: proper `Header`, `Card`, `Badge`, `Button` primitives, brand colour tokens via `rgb(var(--color-brand-blue))`, considered empty/loading states, generous spacing, clear typography hierarchy. The customer portal needs to hit that bar AND go beyond — branded loading skeletons, motion on key interactions, hero-quality empty states.

## 2. Goals

- `/shop`, PDP, `/cart`, `/checkout`, `/order-tracker`, `/proofs`, welcome page all feel like one cohesive product
- Loading states use branded skeletons (not generic spinners)
- Empty states use illustration + clear next-step CTA (not centered "no items" text)
- Key interactions have polished micro-motion (PDP image switch, add-to-cart, cart drawer, checkout step transition)
- Brand colour tokens used consistently — no hardcoded hex
- Header / footer / nav consistent across all routes
- Mobile-responsive (B2B customers approve orders on phones)

## 3. Non-goals

- **Visual identity rework / new branding** — use existing brand tokens; don't propose a refresh
- **Designer-led illustration commissions** — use existing icon library + simple SVG illustrations
- **Marketing pages on customer portal** — those live on the Shopify marketing site (WSM)
- **Animations beyond micro-motion** — no parallax, no hero videos, no Lottie animations
- **A/B testing infrastructure** — single canonical experience
- **Localization / i18n** — English-NZ only
- **Accessibility audit beyond ARIA basics** — keep existing standards, don't aim for WCAG AAA

## 4. Architecture

No new routes, no new APIs, no schema changes. Pure UI work in `print-room-portal`.

Polish targets, by route:

### 4.1 `/shop` (catalogue browse)

- Branded loading skeleton (rounded card silhouettes with shimmer)
- Empty state: simple SVG illustration + "Your catalogue is being set up — your account manager will be in touch" copy
- Filter bar polish (chip-based filters, animated active state)
- Product card hover state: subtle elevation + image scale
- Brand-color "From $X.XX" pricing chip on each card
- Stock indicator chip (matches PDP)

### 4.2 PDP `/shop/[productId]`

- Image gallery with motion on swap (fade + slide)
- Variant picker chips with animated selected state
- Add-to-cart button: brand-color filled, animated success state ("Added to cart" → bounce → reset)
- Stock badge: green "In stock" / amber "Low" / grey "Made to order" (existing logic)
- Tier discount banner above price block (per WS4)

### 4.3 `/cart`

- Cart drawer pattern (also full-page) — branded close button, item rows with motion-in
- Quantity steppers: animated tick on change
- Tier discount line: visible chip "Your Tier 2 discount: −$23.40" (per WS4)
- Empty state: illustration + "Your cart is empty — start shopping →"
- Shipping summary: branded card with truck icon

### 4.4 `/checkout`

- Multi-step indicator with brand-color active state
- Form fields: branded focus state (brand-color outline ring)
- Confidence copy: "Charged to your account terms (Net 30)" near submit
- Order summary panel: brand-card aesthetic, subtotal/decoration/tier-discount/total breakdown (per WS4)
- Submit button: branded large button with motion on click

### 4.5 `/order-tracker`

- Visual production timeline: horizontal stepper with branded active node, completed checkmarks, pending greyed
- Tracker card: brand-card with status badge, estimated delivery banner
- Empty state: illustration + "No projects yet — your first order will appear here"
- Reorder button: branded secondary action

### 4.6 `/proofs` (customer archive — Phase 3, partial polish in MVP)

For MVP this surface is "Coming soon" placeholder if not yet built (likely scope cut to v1.1 since archive depends on Phase 2 customer approval flow). If shipped in MVP, polish to same standard as `/order-tracker`.

### 4.7 Welcome page `/welcome` (per WS5)

- Hero: large brand-color block, "Welcome, [first name]" + organisation name
- 3-column "Here's what you can do" cards (Browse / Order / Track)
- Account manager contact card
- "Continue to Shop" CTA — large branded button

### 4.8 Cross-cutting

- Cart chip (top-right per `feedback_cart_chip_top_right.md`) — branded count badge
- Loading skeletons throughout — replace generic spinners with shimmer cards
- Empty states throughout — pattern with SVG + heading + body + CTA
- Toast notifications for success/error — branded, animated slide-in
- Header/sidebar consistency — every route uses same layout

## 5. Design tokens

Existing tokens in customer-portal (verify):
- `--color-brand-blue`, `--color-brand-yellow`, `--color-primary` (per existing usage in `JobTrackerOrderCard.tsx`)
- Spacing scale (existing tailwind)
- Typography scale (existing tailwind)

If any tokens missing, add to `app/globals.css` with brand-aligned values. No designer-led tokens — use existing brand identity.

## 6. UI primitives

The customer-portal does NOT share `@print-room-studio/ui` (it's outside the studio monorepo). It has its own local `components/ui/`. Polish work uses these local primitives. Where a primitive is missing (e.g., shimmer skeleton, branded toast), add to `components/ui/`.

Suggested new primitives to add:
- `components/ui/skeleton.tsx` — shimmer skeleton primitive
- `components/ui/empty-state.tsx` — empty-state pattern (icon/illustration + heading + body + CTA)
- `components/ui/timeline.tsx` — horizontal stepper for order tracker
- `components/ui/toast.tsx` — branded toast (or wire `react-hot-toast` if simpler)

## 7. Motion principles

- **Subtle, not flashy** — 200ms transitions, ease-out
- **Functional motion only** — confirm an action (add-to-cart bounce), guide attention (cart drawer slide), or transition state (image gallery fade)
- **No surprise animation on first paint** — content arrives without animation; subsequent state changes animate
- **Respect prefers-reduced-motion** — disable non-functional motion when user prefers reduced

## 8. Mobile responsive

- All target routes work on 375px width minimum (iPhone SE)
- Cart drawer opens to bottom-sheet on mobile, side-drawer on desktop
- PDP gallery: vertical stack on mobile, side-by-side on desktop
- Checkout: single-column always; multi-step indicator stays at top
- Order-tracker timeline: horizontal scrolling on mobile, full-width on desktop

## 9. 4-axis stack rationale

- **Rendering:** existing — `dynamic = 'force-dynamic'` on authenticated routes. Skeletons SSR-rendered with proper `<Suspense>` boundaries where data fetches block initial paint
- **Caching:** unchanged. Per-customer auth means CDN cache stays disabled
- **Performance:** motion is CSS-driven (no JS animation libs added). Skeleton paints in <100ms. Total bundle size impact: <10KB gzipped from new primitives
- **Ecommerce pattern:** B2B with custom pricing — every interaction shows the customer their terms transparently (not "trust us, this is the right price"). Tier discount banner is the most explicit instance

## 10. Decisions locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | Brand tokens | Use existing — no rebrand |
| 2 | Illustrations | Lightweight SVG, no commissioned art |
| 3 | Animation library | None — CSS transitions only |
| 4 | New primitives | Add only as needed (skeleton / empty-state / timeline / toast) |
| 5 | Mobile breakpoint | 375px minimum |
| 6 | `/proofs` customer archive in MVP | Likely v1.1 — placeholder for MVP |
| 7 | Reduced-motion | Honored; all animations behind media query |

## 11. Verification

- Browse `/shop` on mobile + desktop → consistent, branded, no generic spinners
- PDP image switch shows motion → smooth fade + slide → feels intentional
- Add-to-cart triggers bounce → cart count updates with animation → no layout shift
- Cart drawer (mobile) → bottom-sheet, smooth open
- Checkout submit → branded confidence copy visible → submit button motion → success state
- Order-tracker shows visual timeline → completed/active/pending nodes clear
- Welcome page on first sign-in → hero + cards + CTA
- All routes feel cohesive — no surface stands out as "different"
- prefers-reduced-motion: animations disabled → core flow still works

## 12. Dependencies

- Pairs with WS4 (pricing visibility) — many of the polish targets surface tier discount lines
- Pairs with WS5 (welcome page) — built as part of polish pass
- Independent of WS1 (proofs) — proofs UI lives in design-tool, not customer-portal
- Brand tokens must exist in `app/globals.css` — verify before WS3 dispatch

## 13. Open questions

- Q1 — illustration source: lucide-react icons + simple SVG, or grab from existing brand asset library? Default: lucide + SVG.
- Q2 — toast library: build local primitive or wire `react-hot-toast`? Default: local primitive (avoid new deps).
- Q3 — order-tracker timeline node icons: brand-color filled circles, or status-specific icons (e.g., scissors for "in production")? Default: status-specific icons for clarity.
