# Products sub-app — cutover checklist (1-week side-by-side run)

Per spec §9, both `middleware-pr` and the new staff-portal Products sub-app run
side-by-side for at least 1 week. Tick these items as the week progresses.

## Day 0 (announcement)
- [ ] Email/Slack staff who use middleware-pr with the new URL.
- [ ] Confirm at least one admin and one staff user have the `products` permission.
- [ ] Verify URL: `https://<staff-portal-host>/products`.

## During the week
- [ ] Spot-check 5 random products in both tools — fields match.
- [ ] Pick one product, edit in new tool, verify middleware-pr reflects.
- [ ] Pick one product, edit in middleware-pr, verify new tool reflects.
- [ ] Add/remove a tag in new tool — confirm reserved tags survive.
- [ ] Add a swatch, size, image, pricing tier in each — confirm round-trip.

## Day 7+
- [ ] No parity gaps reported.
- [ ] Pause middleware-pr Replit deployment.
- [ ] Calendar reminder for Day 37 to archive middleware-pr GitHub repo.

## v1.1 follow-ups (capture as you go)
- [ ] Add Postgres CHECK constraint on `products.tags` (commented in `sql/003_products_permission.sql`).
- [ ] Drop hard-coded `platform = 'uniforms'` filter; surface as user-selectable.
- [ ] Reconcile `products` vs `products:write` permission keys.
- [ ] Debounce per-keystroke saves on Swatches and Images tabs if staff feedback warrants.
