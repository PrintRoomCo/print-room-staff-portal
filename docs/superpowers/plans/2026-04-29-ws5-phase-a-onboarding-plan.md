# WS5 - Phase A Invite Onboarding Plan

**Date:** 2026-04-29
**Repos touched:** `print-room-staff-portal`, `print-room-portal`

## Goal

Implement invite-only MVP onboarding. Staff invite a customer from a B2B account page, Supabase sends a magic-link invite, the invited user is linked to the organization as `member`, and first sign-in lands on `/welcome`.

## Scope

### Staff Portal

- Add `InviteCustomerDialog` on `/b2b-accounts/[orgId]`.
- Add `POST /api/b2b-accounts/[orgId]/invite`.
- Use `requireB2BAccountsStaffAccess()`.
- Validate email/name input and default role to `member`.
- Use Supabase `auth.admin.inviteUserByEmail`.
- Insert `user_organizations(user_id, organization_id, role)`.
- Duplicate invite for the same email and org returns `409`.

### Customer Portal

- Add `/welcome` under the portal route group.
- Fetch current user and call `getCompanyAccess()`.
- Show organization name, account manager card, three feature cards, and WS4 `TierBadge`.
- Catalogue users see catalogue/dedicated catalogue pricing language.
- Add cookie-based `welcome_seen=true`, max-age one year.
- Continue button marks the cookie and sends the user to `/shop`.

## Non-Goals

- No migrations.
- No Phase B request-access form.
- No multi-user org admin UI.
- No interactive welcome tour.
- No custom Supabase email template.
- No resend/reinvite workflow beyond the duplicate guard.

## Implementation Tasks

- [ ] Staff: create `src/components/b2b-accounts/InviteCustomerDialog.tsx`.
- [ ] Staff: add invite dialog to `src/app/(portal)/b2b-accounts/[orgId]/page.tsx`.
- [ ] Staff: add `src/app/api/b2b-accounts/[orgId]/invite/route.ts`.
- [ ] Portal: add `app/(portal)/welcome/page.tsx`.
- [ ] Portal: add `components/welcome/WelcomeContinueButton.tsx`.
- [ ] Portal: update `proxy.ts` so authenticated portal users without `welcome_seen` are directed to `/welcome`, while `/welcome` itself is allowed.
- [ ] Run focused lint/typecheck/build for edited repos.
- [ ] Manual smoke: staff invite PRT/test org, duplicate invite 409, `/welcome` shows catalogue pricing language, continue sets cookie and reaches `/shop`.

## Verification Notes

- Invite endpoint must not create any schema assumptions beyond existing `auth.users` and `user_organizations`.
- For existing users, `inviteUserByEmail` may return a user; duplicate membership is still checked before insert.
- The welcome cookie is browser-scoped by design for MVP.
