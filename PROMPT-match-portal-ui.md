# Task: Match staff portal UI to the customer portal design system

The staff portal (`print-room-staff-portal`) needs to visually match the customer portal (`print-room-portal`). Both apps serve The Print Room brand and should feel like the same product family. The customer portal is the source of truth for the design system.

Read every file referenced below in BOTH projects before making any changes.

## Reference files (read these first)

**Customer portal (source of truth):**
- `C:\Users\MSI\Documents\Projects\print-room-portal\app\globals.css` — Full design system: color tokens, button classes, card classes, badge classes, input classes, modal classes, sidebar classes, animation keyframes
- `C:\Users\MSI\Documents\Projects\print-room-portal\tailwind.config.ts` — Theme extensions: pr-charcoal, pr-blue, pr-yellow, pr-surface colors, spring easing, clean shadows, DM Sans font
- `C:\Users\MSI\Documents\Projects\print-room-portal\components\layout\Sidebar.tsx` — Sidebar component with collapsible desktop + mobile drawer, glass background, pill nav links
- `C:\Users\MSI\Documents\Projects\print-room-portal\app\layout.tsx` — Root layout with DM Sans font setup

**Staff portal (files to modify):**
- `src/app/globals.css` — Current CSS with HSL tokens and `.staff-sidebar` classes
- `src/components/ui/button.tsx` — CVA button with generic variants
- `src/components/ui/card.tsx` — Basic card component
- `src/components/ui/input.tsx` — Basic input
- `src/components/ui/badge.tsx` — Basic badge variants
- `src/components/ui/textarea.tsx` — Basic textarea
- `src/components/layout/Sidebar.tsx` — Dark charcoal sidebar with section expansion
- `src/app/layout.tsx` — Root layout
- `src/app/(auth)/sign-in/page.tsx` — Sign-in page

## What to change

### 1. `src/app/globals.css` — Port the full design system

Port ALL component-layer classes from the customer portal's globals.css into the staff portal's globals.css. The staff portal uses Tailwind v4 (`@import "tailwindcss"` + `@theme inline`), so adapt accordingly — keep the `@theme inline` block but add the missing design tokens and all the component classes.

Specifically port:
- **Color tokens**: `--color-primary: 30 35 38`, `--color-brand-blue: 43 57 144`, `--color-brand-yellow: 241 255 165`, `--color-surface: 248 250 244`
- **Shadow system**: `--shadow-sm` through `--shadow-xl`
- **All button classes**: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-accent`, `.btn-danger`, `.btn-hero` (pill-shaped, spring easing `cubic-bezier(0.16, 1, 0.3, 1)`, border-based hover fills)
- **All card classes**: `.card`, `.card-interactive`, `.card-elevated`, `.card-solid`
- **All badge classes**: `.glass-badge-green`, `.glass-badge-blue`, `.glass-badge-yellow`, `.glass-badge-red`, `.glass-badge-gray`, `.glass-badge-purple`, `.glass-badge-orange`, `.glass-badge-cyan`
- **Input classes**: `.input-glass` (pill-shaped, bg-gray-50), `.select-glass`, `.textarea-glass`
- **Sidebar classes**: `.glass-sidebar` (bg-#ECFCCB, backdrop-blur), `.sidebar-link` (pill-shaped), `.sidebar-link-active` (white bg, shadow)
- **Modal classes**: `.glass-modal`, `.glass-modal-backdrop`
- **Step/progress classes**: `.glass-step-circle`, active/completed/pending variants
- **Info boxes**: `.glass-info-box`, `.glass-success-box`, `.glass-error-box`
- **Animation**: `fadeSlideIn` keyframe, spring easing on all interactive elements

Remove the `.staff-sidebar` dark theme classes — we're switching to the lime glass sidebar style.

Keep the existing `@theme inline` block but ensure it includes `--color-primary`, `--color-brand-blue`, `--color-brand-yellow`, `--color-surface`, the shadow vars, and `--font-dm-sans`. Also add `transitionTimingFunction.spring: cubic-bezier(0.16, 1, 0.3, 1)` and the `pr-charcoal`, `pr-blue`, `pr-yellow`, `pr-surface` color shortcuts to the theme.

### 2. `src/components/layout/Sidebar.tsx` — Match the customer portal sidebar

Rewrite the Sidebar to match the customer portal's visual design while keeping the staff navigation structure (7 sections with permission filtering).

Key visual changes:
- **Background**: Switch from dark charcoal to `glass-sidebar` class (lime #ECFCCB with backdrop blur)
- **Links**: Use `sidebar-link` and `sidebar-link-active` classes (pill-shaped, white active bg)
- **Text colors**: Dark text on light background instead of light text on dark
- **Section labels**: Match customer portal label styling (small, uppercase, muted)
- **Logo badge**: White rounded-2xl badge with shadow, matching customer portal
- **Collapsible desktop**: Add collapse/expand toggle that persists to localStorage (256px full, 80px collapsed), matching the customer portal behavior
- **Mobile drawer**: Keep the slide-in drawer with dark backdrop (bg-black/40)
- **Dividers**: `bg-pr-blue/30` between sections
- **Spring easing**: All transitions use `transition-all duration-300 ease-spring`

Keep: Permission-based nav filtering, section expansion (ChevronDown/Right), all 7 navigation sections, admin-only Settings section, sign-out button.

### 3. `src/components/ui/button.tsx` — Add portal button variants

Keep the CVA structure but add variants that map to the portal's button classes:
- `portal` → uses `.btn-primary` styling (blue outline pill, fills on hover)
- `portalSecondary` → uses `.btn-secondary` styling (white pill, gray border)
- `portalGhost` → uses `.btn-ghost` styling
- `portalAccent` → uses `.btn-accent` styling (solid blue)
- `portalDanger` → uses `.btn-danger` styling

Or alternatively, just ensure the existing variants visually match the customer portal's rounded-full pill shape, spring transitions, and color scheme. The CVA variants should produce the same visual result as the customer portal's button classes.

### 4. `src/components/ui/card.tsx` — Match portal card styling

Update to use `rounded-2xl border border-gray-100 shadow-sm` base (matching `.card` class). Add variant support for `interactive`, `elevated`, `solid`.

### 5. `src/components/ui/input.tsx` — Match portal input styling

Update to pill-shaped: `rounded-full bg-gray-50 border-gray-200 px-5 py-2.5`. Focus ring: `0 0 0 3px rgba(0, 0, 0, 0.06)` with `border-gray-400 bg-gray-100`.

### 6. `src/components/ui/badge.tsx` — Add portal badge variants

Add variants matching the 8 glass-badge colors: green, blue, yellow, red, gray, purple, orange, cyan. All `rounded-full`.

### 7. `src/components/ui/textarea.tsx` — Match portal styling

Update to `rounded-2xl bg-gray-50 border-gray-200 px-5 py-3 resize-none`.

### 8. `src/app/(auth)/sign-in/page.tsx` — Polish the sign-in page

Apply the portal design system: card with `rounded-2xl shadow-lg`, pill-shaped inputs (`.input-glass`), primary button (`.btn-primary` or `.btn-accent`), proper spacing and brand colors. Add the PR logo at the top.

## Important constraints

- Staff portal uses **Tailwind CSS v4** (no tailwind.config.ts — uses `@theme inline` in globals.css). Port the design tokens into the `@theme inline` block, not a config file.
- Keep all existing functionality intact — permissions, navigation structure, auth flow.
- The `cn()` utility in `src/lib/utils.ts` already exists, use it.
- Icons come from `lucide-react` — keep using those.
- Don't add new dependencies.
- Don't touch auth files, context files, API routes, or middleware.
- Read the customer portal's actual files to get exact values — don't guess hex codes or spacing.
