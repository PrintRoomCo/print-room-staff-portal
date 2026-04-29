# Phase A — Invite-Only Onboarding + Welcome Page — Design Spec

**Date:** 2026-04-29
**Status:** Draft (locked direction per MVP one-pager Axis 1: Phase A → B → C roadmap; A is MVP scope)
**Owner:** Jon
**Repos:** `print-room-staff-portal` (invite UI + API) + `print-room-portal` (welcome page + auth callback handling)

## 1. Context

Today the only way a customer signs in to the customer portal is if a Supabase auth user exists for them in `auth.users` AND a `user_organizations` row links them to an org. This was set up manually for PRT — there's no UI flow to invite a new customer.

For Phase A MVP launch we hand-pick 5 customers, send them magic-link invites, and they land on a branded welcome page on first sign-in. This is the minimum viable onboarding — it doesn't replace future Phase B (request-access) or Phase C (open self-serve), but it does establish the data shape those phases extend.

## 2. Goals

- Staff can invite a new customer from `/b2b-accounts/[orgId]` with one click
- Magic-link email lands in invitee's inbox via Supabase auth
- Magic-link redirects to customer portal welcome page on first sign-in
- Welcome page sets context (who you are / what this is / continue to shop) and hands off cleanly to `/shop`
- Subsequent sign-ins skip the welcome page (returning users go straight to `/shop` or last-visited)

## 3. Non-goals

- **Phase B request-access form** (public marketing-site form + admin queue) — v1.1
- **Phase C self-serve signup** — v1.2+
- **Multi-user invitations** (inviting teammates within an org) — v1.1 (`feat/multi-user-admin`)
- **Re-invite / resend flow** — defer; staff can manually re-trigger from Supabase admin if needed in MVP
- **Bulk invite (CSV import)** — v1.1+
- **Custom email branding/template** — use Supabase default magic-link email for MVP; brand template in v1.1
- **Onboarding survey** — v1.1
- **Welcome tour / interactive product walkthrough** — v1.1 per one-pager
- **Inviting users with specific roles** — Phase A defaults to `'member'` role; admin roles managed by Jamie via Supabase

## 4. Architecture

### 4.1 Invite trigger (staff side)

New endpoint + UI on `print-room-staff-portal/src/app/(portal)/b2b-accounts/[orgId]/page.tsx`:

```
+ "Invite customer" button on the b2b-accounts hub
  → opens InviteCustomerDialog
  → form: email + first name + last name + role (default: 'member')
  → POST /api/b2b-accounts/[orgId]/invite
  → server calls Supabase admin auth.admin.inviteUserByEmail(email, { redirectTo: <welcome page URL> })
  → server inserts user_organizations row linking the new user.id to the org with the chosen role
  → toast "Invite sent to email@..."
```

### 4.2 Magic-link flow

Supabase admin's `inviteUserByEmail` sends a magic-link email automatically. The link includes a JWT that auto-signs the user in on click. The `redirectTo` parameter sets the post-auth landing page.

We set `redirectTo = https://portal.theprint-room.co.nz/welcome`. Customer portal handles the auth callback:

1. Magic link clicked → Supabase auth handshake completes → redirect to `/welcome`
2. `/welcome` server component reads `auth.uid()` → fetches `getCompanyAccess()` → renders welcome content
3. Welcome page sets a cookie `welcome_seen=true` → user clicks "Continue to Shop" → redirect to `/shop`
4. Subsequent sign-ins: middleware checks `welcome_seen` cookie → if set, skip welcome and go straight to last-visited or `/shop`

### 4.3 Returning user UX

Welcome page is shown ONCE per browser per customer. Implementation: cookie-based gate (`welcome_seen=true`, max-age 1 year). Cookie clear or new browser → welcome shows again (acceptable v1 behaviour).

For visited-recently URL preservation: not implemented in MVP (always redirect to `/shop` after welcome). Bookmark-friendly URLs come in v1.1.

## 5. Data model

**No new tables. No schema changes.**

Existing:
- `auth.users` (Supabase) — populated by `inviteUserByEmail` automatically
- `user_organizations(user_id, organization_id, role)` — populated by invite endpoint after invite succeeds
- `b2b_accounts.organization_id` — already linked

The role field on `user_organizations` accepts `'admin' | 'manager' | 'member' | 'staff'`. Phase A invites default to `'member'`. Admin role for invitees comes in v1.1.

## 6. UI components

### 6.1 Staff portal

**New files:**
- `src/components/b2b-accounts/InviteCustomerDialog.tsx` — modal with email + name + role inputs
- `src/app/api/b2b-accounts/[orgId]/invite/route.ts` — POST handler

**Modified:**
- `src/app/(portal)/b2b-accounts/[orgId]/page.tsx` — adds "Invite customer" button in header alongside existing surfaces

### 6.2 Customer portal

**New files:**
- `app/(portal)/welcome/page.tsx` — server component, fetches access + renders welcome shell
- `components/welcome/WelcomeHero.tsx` — hero block with greeting + organisation name
- `components/welcome/WelcomeFeatureGrid.tsx` — 3 cards: Browse / Order / Track
- `components/welcome/AccountManagerCard.tsx` — staff contact info pulled from b2b_accounts (or org settings)
- `app/(portal)/welcome/welcome-mark-seen.tsx` — client component that calls a small route to set the cookie + redirect to /shop on click

**Modified:**
- `middleware.ts` (or equivalent existing auth middleware) — on first sign-in (no `welcome_seen` cookie), redirect to `/welcome`. On subsequent sign-ins, skip welcome.

## 7. API contracts

```ts
// POST /api/b2b-accounts/[orgId]/invite
type InviteBody = {
  email: string
  first_name: string
  last_name: string
  role?: 'admin' | 'manager' | 'member' | 'staff'  // default 'member'
}
// → 201 { user_id, email_sent: true }
// → 400 if email already exists in org
// → 409 if email already invited (duplicate)
// → 500 on Supabase admin failure
```

Auth via existing `requireB2BAccountsStaffAccess`. Server-side flow:

```ts
1. Verify staff access
2. Validate body (email format, names not empty, role in allowed set)
3. Check for existing user_organizations row for (email's user_id, orgId) — return 409 if duplicate
4. Call admin.auth.admin.inviteUserByEmail(email, {
     redirectTo: `${PORTAL_URL}/welcome`,
     data: { first_name, last_name, invited_org_id: orgId },
   })
5. Insert user_organizations row (user_id from invite response, organization_id, role)
6. Return 201 { user_id, email_sent: true }
```

Customer-portal needs no new API endpoints. The `/welcome` page server component does its own data fetch via `getCompanyAccess()`.

## 8. Welcome page content

Hero:
- "Welcome, [first_name]"
- Subtitle: "You're now connected to [org name] on The Print Room"
- Hero illustration / brand block

Tier badge (per WS4 pricing visibility):
- "You have [Tier Label] pricing"

Feature grid (3 cards):
- **Browse your catalogue** — "[Org name]'s curated selection, with your account's pricing" → links to `/shop`
- **Place an order** — "Add items to cart, ship to your store, paid against your account terms" → links to `/cart` (empty state)
- **Track your projects** — "See production status, get reorder reminders" → links to `/order-tracker`

Account manager card:
- "Your account manager is [name]" + email + phone (from `b2b_accounts` or `organizations.settings`)
- For Phase A MVP, manually populate this with Jamie/Chris contact

CTA:
- "Continue to shop" — large branded button → marks cookie + redirects to `/shop`

## 9. Auth, permissions, RLS

- New API requires `b2b_accounts:write` (existing helper). Staff-side concerns only.
- Customer portal welcome page is auth-gated — same as `/shop` etc.
- No new RLS policies required.

## 10. 4-axis stack rationale

- **Rendering:** welcome page is server component (need fresh tier + org data on first load). Welcome-mark-seen action is client component (cookie write must be browser-side)
- **Caching:** welcome page `dynamic = 'force-dynamic'` — first-load only, no value in caching
- **Performance:** welcome page makes 1 query (`getCompanyAccess`); illustrations are inline SVG. Sub-200ms TTFB
- **Ecommerce pattern:** invite-only with magic-link is the canonical low-friction B2B onboarding pattern. Mirrors how Slack, Notion, Figma onboard team members. No password setup; magic link is the only auth event in MVP

## 11. Decisions locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | Auth method | Supabase magic link via `inviteUserByEmail` |
| 2 | Email template | Default Supabase template (custom branded template = v1.1) |
| 3 | Default role | `'member'` (admin/manager invites = v1.1) |
| 4 | Welcome cookie | `welcome_seen=true`, max-age 1 year |
| 5 | Welcome content | Hero / tier badge / 3-card feature grid / account manager card / Continue CTA |
| 6 | Account manager source | `b2b_accounts` settings JSONB or `organizations.settings.account_manager` — manual populate for MVP |
| 7 | Re-invite | Not in MVP — staff use Supabase admin if needed |
| 8 | Multi-user / teammate invites | v1.1 (different scope; same data model extended) |

## 12. Verification

- Staff (admin or `b2b_accounts:write`) clicks "Invite customer" on `/b2b-accounts/[orgId]` → dialog opens
- Submit email + name → toast "Invite sent" → row appears in `auth.users` + `user_organizations`
- Invitee receives Supabase magic-link email → click → auto-signs in → lands on `/welcome`
- Welcome page shows greeting with first_name + org name + tier badge + 3 cards + account manager card
- Click "Continue to shop" → redirects to `/shop` with org's catalogue scope visible
- Sign out + sign in again → goes straight to `/shop`, skips welcome (cookie set)
- Clear cookies + sign in → welcome shows again (acceptable v1)
- Duplicate invite (same email + org) → 409 from API → user-friendly toast
- Non-staff trying the API → 403

## 13. Dependencies

- Existing `requireB2BAccountsStaffAccess` helper
- Existing `getCompanyAccess()` in customer portal
- Pairs with WS4 (pricing visibility) — tier badge on welcome page
- Pairs with WS3 (customer polish) — welcome page is one of the polish targets
- Independent of WS1 (proofs)

## 14. Open questions

- Q1 — when invite is sent, should staff get a confirmation email back? Default: no (toast in UI is sufficient for MVP)
- Q2 — does the magic link expire? Default: Supabase default 1 hour. If invitee waits, staff re-invites
- Q3 — what's the redirect URL on the welcome → /shop hop? Default: `/shop` (let customer browse). Could be `/cart` to nudge first-order. Going with `/shop` — first-impression should not feel pushy
