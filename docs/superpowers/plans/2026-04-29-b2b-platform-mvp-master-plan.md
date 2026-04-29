# B2B Platform 1.0 MVP — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute the per-workstream plans linked below. This master plan is the coordination layer; each workstream has its own design spec + (forthcoming) detailed task plan.

**Goal:** Ship 1.0 of the B2B platform within 2 weeks (29 Apr – 11 May 2026). Lets us invite 5 hand-picked customers to use catalogues + place orders. Premium polish, working proofs, marketing-site landing post-Friday gate.

**Source one-pager:** `print-room-staff-portal/docs/superpowers/notes/2026-04-29-b2b-platform-1-launch-one-pager.md` (committed `1bf35b9`).

**Phased rollout:** MVP (this plan) → v1.1 (per-catalogue editor + multi-user/store admin + Phase B request-access, weeks 3-4) → v1.2 (Phase C self-serve, week 5+).

---

## Five workstreams

| # | Workstream | Spec | Estimate | Repos touched |
|---|---|---|---|---|
| WS1 | Proofs fix to "actually works" | `2026-04-29-proofs-phase-1-5-fix-design.md` | 5-7 days | `print-room-studio/apps/design-tool` |
| WS2 | Staff-portal polish — consistency to UI primitives | (mechanical, see §WS2 below) | 2-3 days | `print-room-staff-portal` |
| WS3 | Customer-portal premium polish | `2026-04-29-customer-portal-premium-polish-design.md` | 3-4 days | `print-room-portal` |
| WS4 | Customer-visible pricing breakdown | `2026-04-29-customer-pricing-visibility-design.md` | 1.5-2 days | `print-room-portal` (+ minor staff-portal) |
| WS5 | Phase A onboarding + welcome page | `2026-04-29-phase-a-invite-onboarding-design.md` | 1.5 days | `print-room-staff-portal` (invite UI) + `print-room-portal` (welcome page) |
| WSM | Marketing site landing + Loom (week 2) | inline §WSM below | 2 days | `print-room-no-design-tool` (Shopify theme) |

**Total raw estimate:** 15-20 days. Compressed into 10 working days via parallel subagent dispatch (see §Sequencing).

---

## Sequencing

```
Week 1 (29 Apr Tue → 4 May Mon)                            Week 2 (5 May → 11 May)
─────────────────────────────────────────────────────────  ────────────────────────────────────
Day 1  WS1 kickoff (Vercel puppeteer swap)                 Day 6  WS3 finish + WS5 onboarding
       WS2 kickoff (staff polish — 4 components)                  WSM kickoff: Shopify draft theme
       WS4 spike (pricing visibility decisions)            Day 7  WS3 finish; WSM draft theme
Day 2  WS1: ProductCustomizer integration in builder       Day 8  Loom recording (Jamie + optional Chris)
       WS2: catalogues editor inline cells refactor                Smoke testing across all surfaces
       WS4: cart/checkout breakdown UI                     Day 9  Bug fixes + final polish
Day 3  WS1: PDF template fidelity to Allpress              Day 10 Theme deploy (POST-FRIDAY GATE)
       WS2: b2b-accounts forms + override flags                   First 5 invites sent
       WS4: PDP card pricing breakdown                            Monitor + iterate
Day 4  WS1: mockup pre-rendering pipeline                  
       WS3 kickoff (customer-portal hero/skeleton)         
       WS4: complete                                       
Day 5  WS1: end-to-end smoke + final fixes                 
       WS3: PDP gallery motion + branded states            
       WS5 kickoff (invite + welcome shell)                
```

### Parallelization map

- **Subagent A** owns WS1 (proofs) for the full 5 days. Single threaded — too coupled to split.
- **Subagent B** owns WS2 (staff polish) days 1-3. Mechanical refactor, low-risk.
- **Subagent C** owns WS4 (pricing) days 1-4 in shorter bursts. Wraps before WS3 starts so customer-portal polish includes the new pricing UI.
- **Subagent D** owns WS3 (customer-portal polish) days 4-7.
- **Subagent E** owns WS5 (onboarding) days 5-6. Stitch-up workstream — depends on welcome page targeting being clear.
- **Jamie + optional Chris** own WSM (marketing) + Loom — days 6-10.

Each subagent dispatched fresh per task per the existing pattern. Two-stage review between tasks. 🟡 SQL gates pause for Jamie's 🟢.

---

## WS2 — Staff-portal polish (mechanical, no spec)

Refactor targets, file-by-file. Pattern: replace raw `<button>` / `<input>` / `<select>` with the existing `@/components/ui/` primitives. Add proper empty/loading/error states. Match the standard set by `src/app/(portal)/proofs/page.tsx`.

| File | Issues | Replace with |
|---|---|---|
| `src/components/catalogues/CatalogueItemsTable.tsx` | Raw `<input type="number">`, `<select>`, `<input type="checkbox">` styled with Tailwind | `Input`, `Select` (or shadcn Select), `Checkbox` from `@/components/ui/`. Header row uses `Card` wrapper. Empty state uses centered `FileX` icon + CTA. |
| `src/components/b2b-accounts/AccountTermsCard.tsx` | Raw `<select>` for tier/payment/deposit; raw checkboxes | Same — UI primitives. Form layout in `Card` instead of bare `<section>`. |
| `src/components/b2b-accounts/StoresPanel.tsx` | Raw inline edit form, raw inputs | UI primitives + `Card` per row in expanded view. |
| `src/components/b2b-accounts/AddStoreDialog.tsx` | Custom modal div (`fixed inset-0 z-40 ...`) | Replace with `Modal` / `Dialog` from `@/components/ui/`. |
| `src/components/products/ProductsSelectionBar.tsx` | (verify) Sticky bar styling | Probably already on UI primitives; quick audit + fix. |
| `src/components/catalogues/CreateCatalogueDialog.tsx` | Custom modal div | Replace with `Modal` / `Dialog`. |
| `src/components/catalogues/AddFromMasterDialog.tsx` | Custom modal div | Same. |
| `src/components/catalogues/CreateB2BOnlyItemDialog.tsx` | Custom modal div | Same. |
| `src/components/catalogues/OverrideFlag.tsx` | Tooltip via native `title=` | Stays as-is (good enough for v1.1 polish later). |

**Test pattern:** existing typecheck + manual smoke per surface against PRT seed. No new tests required (UI refactor, behaviour unchanged).

**Commit per file** with message `refactor(<surface>): consistent UI primitives + states`.

---

## WSM — Marketing site landing + Loom (week 2)

**Scope:** the Shopify theme at `print-room-no-design-tool`.

**Tasks:**
1. Create draft theme (Shopify admin → Themes → Customize draft)
2. Add `/pages/customer-portal` page with:
   - Hero section (title + subtitle + Loom embed)
   - 3-column "what you get" section (catalogues / orders / proofs)
   - Sign-in CTA → `https://portal.theprint-room.co.nz/sign-in`
   - "Want access? Contact us" mailto: + future request-access form spot
3. Add header link "Customer Portal" (top primary nav, alongside Shop / About / Contact)
4. Record 2-3 min Loom walkthrough (Jamie):
   - Sign in → /shop catalogue → product detail with stock → add to cart → checkout → order-tracker
   - Optional 30s Chris intro recorded separately, edited together
5. Embed Loom on landing page
6. Smoke test on draft theme preview
7. **POST-FRIDAY:** publish draft theme

**No new code in print-room-portal or staff-portal for WSM.** Pure Shopify Liquid + theme settings work.

---

## 🟡 SQL gates summary (all need explicit 🟢 before apply)

| Workstream | Migration | When |
|---|---|---|
| WS1 (proofs fix) | None expected — fix is code-side (puppeteer-core swap + builder integration). Verify against existing schema | Day 1 sanity check |
| WS3 (customer polish) | None | — |
| WS4 (pricing visibility) | None — existing schema sufficient | — |
| WS5 (onboarding) | None — Supabase magic-link uses existing auth.users | — |

**Net: zero migrations expected for MVP.** All schema work for proofs landed in Phase 1; sub-app #3 covered catalogues; sub-app #4 covered orders. WSM is theme-only. Surprise migrations should be flagged early — if a workstream surfaces one, pause and 🟡-gate.

---

## Per-workstream definition of done

### WS1 — Proofs fix
- Vercel preview build of design-tool succeeds with `puppeteer-core` + `@sparticuz/chromium-min`
- Render-pdf route works in production environment
- Builder integrates real ProductCustomizer canvas (artwork upload, print-area placement, method picker, dimensions, Pantones)
- HTML proof template renders with mockups + per-design pages matching Allpress reference fidelity
- End-to-end smoke against PRT: create proof → save snapshot → render → matches sample proof structure

### WS2 — Staff polish
- All listed files refactored to UI primitives
- Typecheck clean on staff-portal
- Manual smoke: every refactored surface visually consistent with `/proofs/page.tsx` standard
- No regressions in existing flows

### WS3 — Customer-portal polish
- `/shop` has branded skeleton + empty state + filter polish
- PDP gallery has motion on image switch + polished add-to-cart
- `/cart` and `/checkout` have brand colour states + confidence copy
- `/order-tracker` has visual production timeline
- Welcome page hero + signature touch
- All routes feel cohesive (single brand identity)

### WS4 — Pricing visibility
- `/shop` cards show effective unit price + tier discount badge
- PDP shows base / decoration breakdown + tier discount line + final
- `/cart` line items show: unit × qty / decoration line / subtotal / tier discount line / total
- `/checkout` review shows the same breakdown
- Decoration pricing pulls through from master to cart correctly

### WS5 — Phase A onboarding
- "Send invite" button on staff-portal `/b2b-accounts/[orgId]`
- Supabase magic-link email lands in invitee's inbox
- Magic-link redirects to customer-portal `/welcome` page on first sign-in
- Welcome page has hero + account manager name + "Continue to shop" CTA
- After welcome, user lands on `/shop` with their org's catalogue scope

### WSM — Marketing site (week 2)
- Draft theme ready for review (private preview link)
- Loom recorded + embedded
- Header link works on draft preview
- Theme published POST-FRIDAY only

---

## Risks (and mitigations)

| Risk | Mitigation |
|---|---|
| WS1 (proofs) blows the 5-7 day estimate | Cut: ship MVP with proofs as "Coming soon" badge in customer portal; fix in v1.1. Surface to Jamie if WS1 is at day 6 with no end in sight |
| Subagent dispatch overlaps cause merge conflicts | Each WS owns distinct file paths (per WS table above); cross-WS edits flagged in plan |
| Marketing site theme deploys before invitees validate | Hard rule: no live theme push until Friday smoke complete; draft preview only beforehand |
| Loom recording feels unprofessional | Practice run + 1 retake max; if not satisfied, defer to v1.1 with screenshots-only on landing |
| Chris flips Q1/Q3 of one-pager | One-pager has only 4 questions — most likely flips are non-blocking. If Q1 (pull request-access into MVP), insert WS6 task list. If Q3 (jump per-cat editor up), 3-4 day insert + cut WS3 polish scope |

---

## Self-review notes

After writing the master + 4 specs, I checked:
- One-pager → master plan: every locked decision has a workstream
- v1.1 deferral list (one-pager): no v1.1 item bleeds into MVP scope
- Spec coverage: WS1/3/4/5 each have their own spec; WS2 is checklist-only (mechanical); WSM is inline (theme-only)
- Subagent parallelization: no two workstreams write to the same file
- 🟡 gates: WS1 may surface a Vercel-config gate; document early if it does

Open question for Jamie before WS dispatch:
- WS1 builder integration: integrate the existing `ProductCustomizer` directly (couples proof flow to customer flow's component lifecycle), or fork into a `ProofProductCustomizer` (clean separation, more code)? Default in spec: integrate directly with proof-context prop.
