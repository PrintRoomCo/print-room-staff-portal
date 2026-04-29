# The Print Room — B2B Platform 1.0 Launch

**Author:** Jamie  |  **Date:** 2026-04-29  |  **For:** Chris

---

## Problem

We've shipped the B2B platform's core surfaces over the last two weeks (catalogues editor, customer-portal `/shop` + ordering, CSR order entry, b2b-accounts hub). The engineering exists but isn't yet visible to customers — we haven't decided how onboarding works, where the platform appears on the marketing site, or what "1.0" actually means. Without those decisions the build doesn't connect to commercial value, and we risk a silo-delivery surprise where features ship without a launch path.

## Goal

Within 2 weeks, launch a 1.0 of the B2B platform that:

- Lets us invite 5 hand-picked customers to start using catalogues + place real orders
- Looks and feels like a premium product, not a stitched-together internal tool
- Has a clear marketing-site entry point future prospects can find
- Sets the foundation for opening request-access (week 3-4, v1.1) and self-serve (week 5+, v1.2)

## Approach (locked direction)

| Axis | Decision | Alternatives considered |
|---|---|---|
| **Onboarding** | Phase A invite-only for MVP → Phase B request-access in v1.1 → Phase C open self-serve later | Open self-serve is faster growth but doesn't fit B2B tier pricing. Invite-only forces deliberate customer selection + tight feedback loops |
| **1.0 launch criteria** | Standard: catalogues + CSR + b2b-accounts + working proofs (5-7 day proof fix included) | Could ship with proofs as "Coming soon" but leaves the InDesign workflow gap unsolved. Worth the time to fix properly |
| **Polish bar** | Premium pass on both staff + customer surfaces (option C) | Internal could be functional-only, but consistency makes the platform feel like one product when account managers and customers both touch it |
| **Marketing site** | Header link + dedicated landing page on `print-room-no-design-tool`, deployed week 2 (post-Friday gate) | Header-only is faster but feels janky for invitees clicking magic links |
| **Sales evidence** | 2–3 min Loom walkthrough (Jamie records, optional Chris voiceover) embedded on landing page + invite emails. Welcome-page tour deferred to v1.1 | Static screenshots ship faster but don't convey workflow. Testimonials need post-MVP customer voices |

### Deferred to v1.1 (weeks 3-4, after MVP customer feedback)

- Per-catalogue-item editor + image upload (per-customer overrides of master images)
- Multi-user invitations per organisation
- Multi-store/location admin UI
- Welcome page tour inside the customer portal
- Phase B request-access flow (public form + admin approval queue)

## Recommendation

Ship the locked MVP scope above in 2 weeks. The deferred items get a 2-week v1.1 push immediately after, informed by what we learn from the first 5 invited customers. This is the better of (a) trying to ship everything in 2 weeks and arriving with a half-built product, or (b) trimming further and arriving with something invitees won't take seriously.

## Timeline

```
Week 1 (29 Apr – 4 May)              Week 2 (5 May – 11 May)               Weeks 3-4 (v1.1)
─────────────────────────             ─────────────────────────             ─────────────────
• Polish pass: staff +                • Marketing site: theme draft         • Per-catalogue
  customer surfaces                     → header + landing page                editor + images
• Pricing visibility on               • Loom recording + invite             • Multi-user admin
  customer end                          email template                      • Multi-store admin
• Phase A onboarding                  • Invite first 5 customers            • Welcome tour
  (invite + welcome)                  • Go live: theme deploy after Fri     • Request-access
• Proofs fix                          • Smoke + monitor                       (Phase B opens)
```

## What I need from you (Chris)

1. **Are you happy starting invite-only and growing toward request-access then self-serve?** Or do you want me to pull Phase B forward into MVP? (Adds ~3-4 days, pushes proofs fix or polish into v1.1)
2. **Who are our first 5 customers?** Want to walk through the list together this week so we can have invites going out by week 2?
3. **Is the v1.1 deferral list right?** Per-catalogue editor, multi-user admin, and multi-store admin pushed to weeks 3-4 — or should something jump up to MVP?
4. **Will you do a 30-second intro voiceover for the Loom?** Adds commercial credibility vs me solo. Or are you happy with me handling it solo and you reviewing the cut?

## Open questions (non-blocking)

- Loom is fine for MVP — should we move to Vimeo/YouTube once we have a polished version, or stay on Loom long-term?
- Anti-spam approach for the Phase B request-access form (v1.1)
- Customer-portal subdomain shape — `portal.theprint-room.co.nz` proposed; happy with that or want a different domain?
- Pricing tier names visible to customers (currently numeric `tier_level=1, 2, 3`) — should customers see "Tier 1" or a friendlier label like "Standard / Trade / Wholesale"?

---

*Lives at `print-room-staff-portal/docs/superpowers/notes/2026-04-29-b2b-platform-1-launch-one-pager.md` — happy to walk through any section.*
