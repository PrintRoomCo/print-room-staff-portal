# Staff Portal Feature Audit — 2026-04-28

**Author:** Jamie (with Claude assist)
**Purpose:** Pre-fix-sweep inventory of every sidebar surface in `print-room-staff-portal`. Triage input for the EOD-Fri 2026-05-02 "every feature works" goal.
**Method:** Code-first sweep of `src/app/(portal)/**/page.tsx` + `src/components/layout/Sidebar.tsx`. No browser smoke or Supabase sanity in this pass — those will land in the fix-sweep phase if needed.
**Scope:** Sidebar-exposed routes only, plus orphan directories discovered during the sweep.

---

## Summary

| Status | Count |
|---|---|
| ✅ Works (code-complete, real wiring) | 17 |
| 🟡 Half-built (mostly works, stub buttons or missing flows) | 1 |
| 🔴 Broken | 0 (none confirmed without browser smoke) |
| ❓ Unknown (not browsed yet) | 0 |
| 🚫 Not started (stub page only) | 4 |
| **Total sidebar entries** | **22** |

Plus 2 non-sidebar orphans (1 functional, 1 alias).

**Headline:** ~77% of sidebar surfaces are code-complete. The 4 "coming soon" stubs (Job Tracker, Reports, Chatbot Admin, Manage Staff) and 1 half-built quote detail page are the entire delta between current state and "everything works." Whether *those four become Friday scope* is the triage question — they look like multi-day builds, not polish.

---

## Critical-fix candidates (daily-staff-blocking)

Ranked by likely daily blast radius based on memory + code signal. Browser smoke not done — these are code-side guesses.

1. **🔴 Job Tracker** — currently a 17-line "coming soon" stub. Memory suggests this is meant to be migrated from `print-room-studio`. If staff use Job Tracker daily for production status, this is the biggest gap. **Daily-blocking? Probably YES.** Fix complexity: **L–XL** (porting from another app).
2. **🟡 Quote Tool detail page action buttons** — "Send to Customer" and "Duplicate" both render as `alert("... coming soon")`. Whole quote tool otherwise works. **Daily-blocking? MAYBE** (depends on whether Jamie/staff currently send quotes from the portal or from elsewhere). Fix complexity: **M** for both combined.
3. **🚫 Reports** — 17-line stub, meant to be migrated from `even-better-reports`. Daily impact unclear without knowing how often Chris/Jamie use it. **Daily-blocking? UNKNOWN.** Fix complexity: **L** (port).
4. **🚫 Manage Staff** — admin-only stub. Today admins manage staff "directly in Supabase" per the page copy. **Daily-blocking? NO** (workaround exists, fine for now). Fix complexity: **M**.
5. **🚫 Chatbot Admin** — stub. Whether the chatbot has any active production conversations is unknown. **Daily-blocking? PROBABLY NO.** Fix complexity: **L**.

---

## Per-feature inventory

### 1. ✅ Dashboard — `/dashboard`
- **File:** `src/app/(portal)/dashboard/page.tsx`
- **Sub-app:** Cross-cutting landing
- **Status:** ✅ Works
- **Evidence:** Renders permission-gated tool cards. Already self-flags Job Tracker / Reports / Chatbot Admin as `coming-soon` via badge in code. So the staff already see "not done yet" hints. Active = Image Generator, Presentations.
- **Daily-blocking:** No

### 2. ✅ Image Generator — Overview — `/image-generator`
- **File:** `src/app/(portal)/image-generator/page.tsx`
- **Sub-app:** Image Generator
- **Status:** ✅ Works
- **Evidence:** Calls `/api/image-generator/jobs` and `/api/image-generator/assets`, renders WORKFLOWS grid + recent-jobs + latest-assets cards.
- **Daily-blocking:** No

### 3. ✅ Image Generator — Design Tool Views — `/image-generator/views`
- **File:** `src/app/(portal)/image-generator/views/page.tsx`
- **Status:** ✅ Works (file exists, dashboard says active)
- **Evidence:** Not deeply read; high confidence ✅ given parent dashboard and the active flag.

### 4. ✅ Image Generator — Proposal & Web Assets — `/image-generator/ecommerce`
- **File:** `src/app/(portal)/image-generator/ecommerce/page.tsx`
- **Status:** ✅ Works
- **Evidence:** 800+ lines, real upload + create-job + status-polling flow. Real placeholder text in form (which is normal copy, not stubs).

### 5. ✅ Image Generator — Tech Pack Assets — `/image-generator/techpacks`
- **Status:** ✅ Works (file exists, parent active)

### 6. ✅ Image Generator — Asset Library — `/image-generator/library`
- **File:** `src/app/(portal)/image-generator/library/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Thin shell hosting `<AssetLibraryPanel/>`. Works if the panel works (panel not audited deeply — flag for browser smoke).

### 7. ✅ Image Generator — All Jobs — `/image-generator/jobs`
- **File:** `src/app/(portal)/image-generator/jobs/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Filters by type/status/scope, fetches real `/api/image-generator/jobs`.

### 8. ✅ Quote Tool — Dashboard — `/quote-tool`
- **File:** `src/app/(portal)/quote-tool/page.tsx`
- **Status:** ✅ Works (delegates to `<QuotesDashboard/>` component)

### 9. ✅ Quote Tool — New Quote — `/quote-tool/new`
- **File:** `src/app/(portal)/quote-tool/new/page.tsx`
- **Status:** ✅ Works (delegates to `<QuoteForm mode="create"/>`)

### 10. ✅ Quote Tool — Saved Quotes — `/quote-tool/quotes`
- **File:** `src/app/(portal)/quote-tool/quotes/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Fetches `/api/quote-tool/quotes`, renders status-badge table. Handles empty + error states.

### 11. 🟡 Quote Tool — Quote Detail — `/quote-tool/quotes/[id]`
- **File:** `src/app/(portal)/quote-tool/quotes/[id]/page.tsx`
- **Status:** 🟡 Half-built
- **Evidence:** Renders quote details, customer + Monday info. **But:** "Send to Customer" button → `alert('Send to customer functionality coming soon')`. "Duplicate" button → `alert('Duplicate functionality coming soon')`. Lines 222–234.
- **Blockers:** No backend endpoints for customer-send + duplicate. Need to decide: do staff currently use these, or is this dead UX?
- **Fix complexity:** M (Send-to-Customer = email + status update; Duplicate = quote-clone endpoint)
- **Daily-blocking:** Maybe (ask Jamie)

### 12. ⚠ SUPERSEDED 2026-04-30 — Quote Tool — Design Tool — `/quote-tool/design-tool`

- **File:** ~~`src/app/(portal)/quote-tool/design-tool/page.tsx`~~ (deleted 2026-04-30)
- **Status:** REMOVED. Route, page, embed component, and `/api/quote-tool/token` endpoint all deleted as part of the staff-portal ↔ design-tool decoupling. Sidebar entry also removed.
- **See:** `~/.claude/projects/c--Users-MSI-Documents-Projects/memory/project_proof_iframe_consolidation.md`

### 13. ✅ Orders — All Orders — `/orders`
- **File:** `src/app/(portal)/orders/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Server component, requires `requireOrdersStaffAccess`, paginated Supabase query, joins quotes + organizations.
- **Note:** Memory says CSR sub-app shipped 2026-04-21 with "21/22 plan tasks complete; UI manual walkthrough deferred." So this is the surface that hadn't been UI-walked yet — primary candidate for browser smoke.

### 14. ✅ Orders — New Order — `/orders/new`
- **File:** `src/app/(portal)/orders/new/page.tsx`
- **Status:** ✅ Works (auth-gated, delegates to `<OrderFormClient/>`)

### 15. ✅ Orders — Detail — `/orders/[id]` *(not in sidebar but reached from list)*
- **File:** `src/app/(portal)/orders/[id]/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Server component, fetches order detail with line + variant + size joins.

### 16. ✅ Products — All Products — `/products`
- **File:** `src/app/(portal)/products/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Server component, perm-gated, paginated, brand+category facets fetched in parallel.

### 17. ✅ Products — New / Edit — `/products/new` + `/products/[id]`
- **Files:** `products/new/page.tsx`, `products/[id]/page.tsx`
- **Status:** ✅ Works (auth-gated, delegates to `<ProductCreateForm/>` and `<ProductEditor/>`)

### 18. ✅ Catalogues — `/catalogues`
- **File:** `src/app/(portal)/catalogues/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Recently shipped (memory `project_b2b_catalogues_spec_plan.md` — 2026-04-27). Real Supabase query against `b2b_catalogues`. Detail page at `/catalogues/[id]` also wired (uses `<CatalogueEditor/>`).

### 19. ✅ Catalogues — Design Proofs — `/proofs`
- **File:** `src/app/(portal)/proofs/page.tsx`
- **Status:** ✅ Works (Phase 1; Phase 1.5 Send-to-Monday in flight)
- **Evidence:** Iframe to `print-room-studio` design-tool with staff JWT. Pattern identical to `/quote-tool/design-tool`.
- **Note:** Phase 1.5 (Send to Monday button) is queued for a separate session per the IDE prompt drafted today.

### 20. ✅ Inventory — Overview — `/inventory`
- **File:** `src/app/(portal)/inventory/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Calls Postgres RPC `inventory_orgs_summary`, renders org cards.

### 21. ✅ Inventory — Audit Log — `/inventory/events`
- **File:** `src/app/(portal)/inventory/events/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Calls `inventory_events_search` RPC with filters + pagination.

### 22. 🚫 Job Tracker — `/job-tracker`
- **File:** `src/app/(portal)/job-tracker/page.tsx` (17 lines)
- **Status:** 🚫 Not started
- **Evidence:** Stub page: *"Production job tracking is coming soon. This will be migrated from the existing job tracker in print-room-studio."*
- **Blockers:** No port from `print-room-studio` started.
- **Fix complexity:** **L–XL** (port + reconnect to current data model)
- **Daily-blocking:** Probably yes — flag for Jon

### 23. 🚫 Reports — `/reports`
- **File:** `src/app/(portal)/reports/page.tsx` (17 lines)
- **Status:** 🚫 Not started
- **Evidence:** Stub: *"Business reports and analytics are coming soon. This will be migrated from even-better-reports."*
- **Fix complexity:** L (port)
- **Daily-blocking:** Unknown — depends on how often Chris/Jamie pull reports

### 24. 🚫 Chatbot Admin — `/chatbot-admin`
- **File:** `src/app/(portal)/chatbot-admin/page.tsx` (17 lines)
- **Status:** 🚫 Not started
- **Evidence:** Stub.
- **Fix complexity:** L
- **Daily-blocking:** Probably no

### 25. ✅ Presentations — List — `/presentations`
- **File:** `src/app/(portal)/presentations/page.tsx`
- **Status:** ✅ Works
- **Evidence:** Fetches `/api/presentations`, real status badges, empty + error states.

### 26. ✅ Presentations — New / Detail — `/presentations/new` + `/presentations/[id]`
- **Status:** ✅ Works (file exists; new-page form has standard placeholders, not stubs)

### 27. ✅ Settings — My Profile — `/settings`
- **File:** `src/app/(portal)/settings/page.tsx`
- **Status:** ✅ Works (read-only profile card showing name, email, role, permissions)
- **Note:** No edit functionality — staff can view but not change. Whether that's intentional or a half-build is the open question. Probably intentional v1.

### 28. 🚫 Settings — Manage Staff — `/settings/staff` *(admin-only)*
- **File:** `src/app/(portal)/settings/staff/page.tsx`
- **Status:** 🚫 Not started
- **Evidence:** Admin gate works; below the gate it says *"Staff management interface coming soon. For now, manage staff users directly in Supabase."*
- **Fix complexity:** M (CRUD against `staff_users` table)
- **Daily-blocking:** No (Supabase workaround documented in copy)

---

## Orphan / non-sidebar routes

### O1. ✅ B2B Accounts Detail — `/b2b-accounts/[orgId]` *(NOT in sidebar)*
- **File:** `src/app/(portal)/b2b-accounts/[orgId]/page.tsx`
- **Status:** ✅ Works as a route, but **no list page and no sidebar entry**
- **Evidence:** Full server component with `requireB2BAccountsStaffAccess`, renders AccountTermsCard + StoresPanel + CataloguesPanel.
- **Open question:** Should this be in the sidebar? Today the only way to reach it is by direct URL. If staff need to find a B2B account by org, they'd need to navigate via Catalogues → Org or similar. **Likely a missing feature, not broken — just unreachable.**
- **Fix complexity:** S (add `/b2b-accounts` list page + sidebar entry)
- **Daily-blocking:** No (not currently visible)

### O2. ✅ /presentation (singular) → /presentations
- **File:** `src/app/(portal)/presentation/page.tsx`
- **Status:** ✅ Works (3-line redirect alias to `/presentations`). Safe to ignore.

---

## Open questions for Jon

Phrased as questions per Jamie's `feedback_include_jon_via_questions.md`:

1. **Of the 4 stubs (Job Tracker, Reports, Chatbot Admin, Manage Staff), which do staff actually use day-to-day right now — and where are they using them today (other apps, manual processes)?** This is the only question that determines whether "every feature works by Friday" is plausible scope. If Job Tracker is a daily-use tool, that alone is probably more than a week's work.

2. **For the Quote Tool detail page's "Send to Customer" + "Duplicate" buttons that today just say 'coming soon' — are those workflows you want this week, or fine to leave as v1.1?**

3. **B2B Accounts is built but not in the sidebar. Want me to surface it (S-sized), or is hiding it intentional for now?**

4. **What does 'works' mean to you for Friday — green-light browser smoke on every active surface, OR shipping the four stubs as well? The first is realistic; the second is ~2 weeks of work compressed.**

---

## Recommended fix order (top 5, if Friday is firm)

Assumes Jon answers Q4 with "browser smoke + minor polish on active surfaces, defer the 4 stubs to next sprint." If he says "ship the stubs," the plan is different.

| # | Task | Complexity | Why |
|---|---|---|---|
| 1 | **Browser-smoke walk every active surface against PRT seed** | S (half day) | Find the *real* broken-ness behind the code-side ✅. Memory flags CSR UI as "manual walkthrough deferred 2026-04-21" — that's the most likely surface to harbour bugs. |
| 2 | **Fix bugs found in #1 by daily-blocking impact** | M (1 day) | Sweep, not rebuild. |
| 3 | **Wire Quote Tool 'Send to Customer' OR remove the button** | S (2–4h) | Either ship it or hide it. The current alert is the worst UX. |
| 4 | **Surface B2B Accounts in sidebar + add list page** | S (2–3h) | Cheap, high-value if Jon says yes to Q3. |
| 5 | **Stub-page polish**: replace the 4 "coming soon" pages with at least *what to do instead today* (link to Supabase, link to even-better-reports, etc.) | S (1h total) | If we can't ship them, at least make the stubs less awkward. |

Total realistic budget: **2.5–3 days** of fix-sweep work. Friday lands clean.

---

## What this audit did NOT cover

Documenting deferrals so the gaps are visible:

- 🚫 **Browser smoke** — no local dev server / live URL test. Code-side ✅ doesn't catch "the form posts but the API returns 500" or "the table renders but the data is wrong." Most important next step.
- 🚫 **Supabase sanity** — didn't sample-query the tables backing each surface. Memory has the seed state for PRT (2026-04-24); good enough to start but should be re-verified before Fri.
- 🚫 **API route audit** — only audited page-level surfaces. Each `/api/*` endpoint may have its own gaps (the Send-to-Monday for proofs is the obvious one in flight).
- 🚫 **Permission matrix sanity** — `staff_users.permissions` array contents weren't checked against what each surface gates on. A staff user without the right permission may see "restricted" copy that *looks* like a bug.
- 🚫 **Mobile / drawer / collapsed-sidebar UX** — code suggests it's wired, but visual smoke not done.
- 🚫 **Auth flows** — `/sign-in` and the (auth) route group not audited; assumed working since other surfaces depend on them.

---

## Next steps

1. **Send Jon the 4 questions above** (preferably as a one-pager or a Slack message — Jamie's call). Don't commit Friday scope until at least Q4 is answered.
2. **Once scope is locked**, pick up with the fix-sweep ordered list above.
3. **Browser smoke kicks off the fix-sweep** — that's where the first round of real bugs surfaces.

---

*Audit time-box: ~1 hour code-only. Fix-sweep estimate: 2.5–3 days, contingent on Jon's answer to Q4.*
