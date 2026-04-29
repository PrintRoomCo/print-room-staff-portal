# WS2 — Staff-Portal UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 8 staff-portal components to use consistent UI primitives, matching the visual standard set by `src/app/(portal)/proofs/page.tsx`. Zero behavior change.

**Architecture:** Mechanical replacement of raw `<input>`/`<select>`/`<input type="checkbox">`/custom modal divs with thin `@/components/ui/*` primitives. Three new primitives (`Select`, `Checkbox`, `Modal`) are added in Task 0 because the repo has no Radix/Headless/shadcn deps — they are styling-only wrappers around native elements that match the existing `Input`/`Textarea` aesthetic. No new logic, no new tests.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, CVA, lucide-react. No new dependencies.

**Reference:** `docs/superpowers/plans/2026-04-29-b2b-platform-mvp-master-plan.md` §"WS2 — Staff-portal polish" is the source of truth for the file list and target patterns. This plan does not duplicate that table — only references it.

**Branch:** `feat/ws2-staff-polish` (already checked out, off master). One commit per file. Do NOT push.

---

## Primitive gap (resolved in Task 0)

Master plan §WS2 references `Select`, `Checkbox`, and `Modal`/`Dialog` from `@/components/ui/`. Inventory confirms only `badge`, `button`, `card`, `input`, `textarea` exist. No Radix, Headless UI, or shadcn dependency in `package.json`.

**Decision:** Add 3 thin native-element wrappers (no new deps) styled to match `Input`/`Textarea`. Behavior is identical to native — focus rings, rounded fills, disabled states. The `Modal` is a fixed-position overlay matching the existing pattern in `AddStoreDialog`/`CreateCatalogueDialog`/etc, extracted into one place. No portals, no focus traps — same UX as today, just consolidated.

---

## File structure

**New files (Task 0):**
- `src/components/ui/select.tsx` — styled `<select>` wrapper
- `src/components/ui/checkbox.tsx` — styled `<input type="checkbox">` wrapper
- `src/components/ui/modal.tsx` — fixed-overlay container with title/footer slots

**Modified files (Tasks 1–8):**
- `src/components/catalogues/CatalogueItemsTable.tsx`
- `src/components/b2b-accounts/AccountTermsCard.tsx`
- `src/components/b2b-accounts/StoresPanel.tsx`
- `src/components/b2b-accounts/AddStoreDialog.tsx`
- `src/components/products/ProductsSelectionBar.tsx`
- `src/components/catalogues/CreateCatalogueDialog.tsx`
- `src/components/catalogues/AddFromMasterDialog.tsx`
- `src/components/catalogues/CreateB2BOnlyItemDialog.tsx`

**Out of scope (per master plan):**
- `src/components/catalogues/OverrideFlag.tsx` — leave as-is.

---

## Task 0: Add missing UI primitives (Select, Checkbox, Modal)

**Files:**
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/modal.tsx`

- [ ] **Step 1: Create `src/components/ui/select.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm text-foreground focus:outline-none focus:border-gray-400 focus:bg-gray-100 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
```

- [ ] **Step 2: Create `src/components/ui/checkbox.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-gray-300 bg-gray-50 text-[rgb(var(--color-brand-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-brand-blue))]/30 focus:ring-offset-1 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 accent-[rgb(var(--color-brand-blue))]',
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
```

- [ ] **Step 3: Create `src/components/ui/modal.tsx`**

```tsx
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full rounded-2xl bg-white p-6 shadow-xl',
          SIZE[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
        <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
        {footer && (
          <div className="mt-6 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/checkbox.tsx src/components/ui/modal.tsx
git commit -m "feat(ui): Select, Checkbox, Modal primitives for WS2 polish"
```

---

## Task 1: Refactor `CatalogueItemsTable.tsx`

**Files:**
- Modify: `src/components/catalogues/CatalogueItemsTable.tsx`

**Master plan target:** raw `<input type="number">`, `<select>`, `<input type="checkbox">` → `Input` / `Select` / `Checkbox`. Header row uses `Card` wrapper. Empty state uses centered `FileX` icon + CTA.

- [ ] **Step 1: Replace raw markup with primitives**

Replace the file contents with the version below. Behavior is unchanged: same `patchItem`, `removeItem`, `refetch`, same `onBlur`/`onChange` handlers, same `defaultValue` semantics.

Key changes:
- Imports: add `Input`, `Select`, `Checkbox`, `Card` from `@/components/ui/*`; add `FileX` from `lucide-react`.
- Header row: wrapped in `<Card>` block with the table inside.
- Empty state: replaced 1-cell colSpan placeholder with a centered FileX block (the table is hidden when empty).
- Input cells: `<input>` → `<Input className="w-20|w-24" ... />` (Input has rounded-full + focus styling matching proofs).
- Select cell: `<select>` → `<Select className="w-40" ...>`.
- Active checkbox: `<input type="checkbox">` → `<Checkbox ...>`.
- Remove button: `<button>` → `<Button variant="ghost" size="sm">` with red text.

Full file:

```tsx
'use client'

import { useState } from 'react'
import { FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AddFromMasterDialog } from './AddFromMasterDialog'
import { CreateB2BOnlyItemDialog } from './CreateB2BOnlyItemDialog'
import { OverrideFlag } from './OverrideFlag'
import type { CatalogueEditorItem } from './CatalogueEditor'

const DECORATION_TYPES = ['N/A', 'Screen print', 'Heat press', 'Super colour']

export function CatalogueItemsTable({
  catalogueId,
  items,
  onChange,
}: {
  catalogueId: string
  items: CatalogueEditorItem[]
  onChange: (items: CatalogueEditorItem[]) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [b2bOpen, setB2bOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const r = await fetch(`/api/catalogues/${catalogueId}/items`)
    if (!r.ok) {
      setError('Failed to load items')
      return
    }
    const d = (await r.json()) as { items?: CatalogueEditorItem[] }
    onChange(d.items ?? [])
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Update failed')
      return
    }
    await refetch()
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remove this item from the catalogue?')) return
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items/${itemId}`, {
      method: 'DELETE',
    })
    if (!r.ok && r.status !== 204) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Delete failed')
      return
    }
    await refetch()
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileX className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No items yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add items from master products or create a B2B-only item.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="accent" onClick={() => setAddOpen(true)}>
                + Add from master
              </Button>
              <Button variant="secondary" onClick={() => setB2bOpen(true)}>
                + Create B2B-only item
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2.5">Image</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Base cost</th>
                <th className="px-3 py-2.5">Markup ×</th>
                <th className="px-3 py-2.5">Decoration type</th>
                <th className="px-3 py-2.5">Decoration price</th>
                <th className="px-3 py-2.5">Shipping</th>
                <th className="px-3 py-2.5">Active</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    {it.source.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.source.image_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{it.source.name}</span>
                      {it.source.is_b2b_only && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                          B2B-only
                        </span>
                      )}
                    </div>
                    {it.source.sku && (
                      <div className="text-xs text-gray-500">{it.source.sku}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    <div className="flex items-center gap-2">
                      <OverrideFlag state="locked" />
                      <span>${Number(it.source.base_cost).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OverrideFlag
                        state={
                          it.markup_multiplier_override == null
                            ? 'inherited'
                            : 'overridden'
                        }
                        masterValueFormatted={Number(
                          it.source.markup_multiplier,
                        ).toFixed(3)}
                      />
                      <Input
                        aria-label="Markup multiplier"
                        type="number"
                        step="0.001"
                        defaultValue={
                          it.markup_multiplier_override ??
                          it.source.markup_multiplier
                        }
                        className="w-24"
                        onBlur={(e) => {
                          const v =
                            e.target.value === '' ? null : Number(e.target.value)
                          patchItem(it.id, { markup_multiplier_override: v })
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OverrideFlag
                        state={
                          it.decoration_type_override == null
                            ? 'inherited'
                            : 'overridden'
                        }
                      />
                      <Select
                        aria-label="Decoration type"
                        className="w-44"
                        value={it.decoration_type_override ?? ''}
                        onChange={(e) =>
                          patchItem(it.id, {
                            decoration_type_override: e.target.value || null,
                          })
                        }
                      >
                        <option value="">— inherit —</option>
                        {DECORATION_TYPES.map((dt) => (
                          <option key={dt} value={dt}>
                            {dt}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const masterDecPrice = it.source.decoration_price
                        const overrideSet = it.decoration_price_override != null
                        if (!overrideSet && masterDecPrice == null) return null
                        return (
                          <OverrideFlag
                            state={overrideSet ? 'overridden' : 'inherited'}
                            masterValueFormatted={
                              masterDecPrice != null
                                ? `$${Number(masterDecPrice).toFixed(2)}`
                                : undefined
                            }
                          />
                        )
                      })()}
                      <Input
                        aria-label="Decoration price"
                        type="number"
                        step="0.01"
                        defaultValue={
                          it.decoration_price_override ??
                          it.source.decoration_price ??
                          ''
                        }
                        className="w-28"
                        onBlur={(e) =>
                          patchItem(it.id, {
                            decoration_price_override:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {it.shipping_cost_override != null && (
                        <OverrideFlag state="overridden" />
                      )}
                      <Input
                        aria-label="Shipping cost"
                        type="number"
                        step="0.01"
                        defaultValue={it.shipping_cost_override ?? ''}
                        className="w-28"
                        onBlur={(e) =>
                          patchItem(it.id, {
                            shipping_cost_override:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Checkbox
                      aria-label="Item active"
                      defaultChecked={it.is_active}
                      onChange={(e) =>
                        patchItem(it.id, { is_active: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeItem(it.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex gap-2">
          <Button variant="accent" onClick={() => setAddOpen(true)}>
            + Add from master
          </Button>
          <Button variant="secondary" onClick={() => setB2bOpen(true)}>
            + Create B2B-only item
          </Button>
        </div>
      )}

      {addOpen && (
        <AddFromMasterDialog
          catalogueId={catalogueId}
          onClose={() => setAddOpen(false)}
          onAdded={async () => {
            setAddOpen(false)
            await refetch()
          }}
        />
      )}
      {b2bOpen && (
        <CreateB2BOnlyItemDialog
          catalogueId={catalogueId}
          onClose={() => setB2bOpen(false)}
          onAdded={async () => {
            setB2bOpen(false)
            await refetch()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalogues/CatalogueItemsTable.tsx
git commit -m "refactor(catalogue-items-table): consistent UI primitives + states"
```

---

## Task 2: Refactor `AccountTermsCard.tsx`

**Files:**
- Modify: `src/components/b2b-accounts/AccountTermsCard.tsx`

**Master plan target:** raw `<select>` for tier/payment/deposit + raw checkboxes → primitives. Form layout in `Card` instead of bare `<section>`.

- [ ] **Step 1: Replace raw markup**

Behavior unchanged: same `patchField`, `createDefaultAccount`, same handlers.

Key changes:
- Imports: add `Card`, `Select`, `Checkbox`, `Input`.
- `<section>` → `<Card>` (`p-6` for spacing).
- All `<select>` → `<Select className="w-32">` (width matches content).
- Two checkbox `<input>` → `<Checkbox>`.
- Credit-limit `<input type="number">` → `<Input type="number" className="w-32">`.
- Header keeps the inline "Saving…/Saved" status; replace bare `<h2>` with semantic h2 inside Card.

Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export interface AccountTerms {
  id: string
  organization_id: string
  tier_level: number | null
  payment_terms: string | null
  default_deposit_percent: number | null
  is_trusted: boolean | null
  credit_limit: number | null
  is_active: boolean | null
  platform: string | null
  created_at: string | null
}

const PAYMENT_TERMS = ['prepay', 'net20', 'net30'] as const
const DEPOSIT_PERCENTS = [0, 30, 40, 50, 100] as const

export function AccountTermsCard({
  organizationId,
  account,
}: {
  organizationId: string
  account: AccountTerms | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function patchField(patch: Partial<AccountTerms>) {
    if (!account) return
    setError(null)
    const res = await fetch(`/api/b2b-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Save failed')
      return
    }
    startTransition(() => router.refresh())
  }

  async function createDefaultAccount() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/b2b-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Create failed')
      return
    }
    startTransition(() => router.refresh())
  }

  if (!account) {
    return (
      <Card className="p-6">
        <h2 className="text-sm font-medium text-gray-700">Account terms</h2>
        <p className="mt-2 text-sm text-gray-500">
          No B2B account on file for this organization.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button
          type="button"
          variant="accent"
          className="mt-3"
          disabled={busy}
          onClick={createDefaultAccount}
        >
          {busy ? 'Creating…' : 'Create with default terms'}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-gray-700">Account terms</h2>
        <span className="text-xs text-gray-500">
          {account.platform ?? '—'} · {isPending ? 'Saving…' : 'Saved'}
        </span>
      </header>

      {error && (
        <p className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Tier">
          <Select
            aria-label="Tier level"
            className="w-32"
            defaultValue={account.tier_level ?? 3}
            onChange={(e) => patchField({ tier_level: Number(e.target.value) })}
          >
            {[1, 2, 3].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment terms">
          <Select
            aria-label="Payment terms"
            className="w-32"
            defaultValue={account.payment_terms ?? 'net30'}
            onChange={(e) => patchField({ payment_terms: e.target.value })}
          >
            {PAYMENT_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default deposit">
          <Select
            aria-label="Default deposit percent"
            className="w-32"
            defaultValue={account.default_deposit_percent ?? 0}
            onChange={(e) =>
              patchField({ default_deposit_percent: Number(e.target.value) })
            }
          >
            {DEPOSIT_PERCENTS.map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trusted">
          <Checkbox
            aria-label="Is trusted"
            defaultChecked={Boolean(account.is_trusted)}
            onChange={(e) => patchField({ is_trusted: e.target.checked })}
          />
        </Field>
        <Field label="Credit limit">
          <Input
            aria-label="Credit limit"
            type="number"
            step="0.01"
            className="w-32"
            defaultValue={account.credit_limit ?? ''}
            onBlur={(e) =>
              patchField({
                credit_limit:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Active">
          <Checkbox
            aria-label="Account active"
            defaultChecked={account.is_active !== false}
            onChange={(e) => patchField({ is_active: e.target.checked })}
          />
        </Field>
      </dl>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/b2b-accounts/AccountTermsCard.tsx
git commit -m "refactor(account-terms-card): consistent UI primitives + states"
```

---

## Task 3: Refactor `StoresPanel.tsx`

**Files:**
- Modify: `src/components/b2b-accounts/StoresPanel.tsx`

**Master plan target:** primitives + `Card` per row in expanded view. Outer `<section>` → `Card`.

- [ ] **Step 1: Replace raw markup**

Behavior unchanged: same `patchStore`, same expand/collapse, same `onBlur` semantics.

Key changes:
- Imports: add `Card`, `Input`.
- Outer `<section>` → outer `<Card className="p-6">`.
- Each expanded edit form wrapped in inner `<Card variant="solid" className="mt-3 p-4">` for visual grouping.
- Edit toggle text-button → `<Button variant="ghost" size="sm">`.
- Inputs → `<Input className="mt-1" ...>`.

Full file:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AddStoreDialog } from './AddStoreDialog'

export interface Store {
  id: string
  name: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  manager_name: string | null
}

const EDITABLE_FIELDS: Array<keyof Store> = [
  'name',
  'location',
  'address',
  'city',
  'state',
  'country',
  'postal_code',
  'phone',
  'email',
  'manager_name',
]

export function StoresPanel({
  organizationId,
  stores,
}: {
  organizationId: string
  stores: Store[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patchStore(id: string, patch: Partial<Store>) {
    setError(null)
    const res = await fetch(`/api/stores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Save failed')
      return
    }
    startTransition(() => router.refresh())
  }

  function oneLineAddress(s: Store) {
    return [s.address, s.city, s.state, s.postal_code, s.country]
      .filter(Boolean)
      .join(', ')
  }

  return (
    <Card className="p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          Stores ({stores.length})
        </h2>
        <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>
          + Add store
        </Button>
      </header>

      {error && (
        <p className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {stores.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No stores yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {stores.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{s.name ?? '(unnamed)'}</div>
                  <div className="text-xs text-gray-500">
                    {oneLineAddress(s) || 'No address on file'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  {openId === s.id ? 'Close' : 'Edit'}
                </Button>
              </div>

              {openId === s.id && (
                <Card variant="solid" className="mt-3 p-4">
                  <form
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setOpenId(null)
                    }}
                  >
                    {EDITABLE_FIELDS.map((field) => (
                      <label key={field} className="block text-xs text-gray-600">
                        {field.replace('_', ' ')}
                        <Input
                          aria-label={`Store ${field}`}
                          className="mt-1"
                          defaultValue={s[field] ?? ''}
                          onBlur={(e) => {
                            const next = e.target.value === '' ? null : e.target.value
                            if (next !== (s[field] ?? null)) {
                              patchStore(s.id, { [field]: next } as Partial<Store>)
                            }
                          }}
                        />
                      </label>
                    ))}
                  </form>
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <AddStoreDialog
          organizationId={organizationId}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/b2b-accounts/StoresPanel.tsx
git commit -m "refactor(stores-panel): consistent UI primitives + states"
```

---

## Task 4: Refactor `AddStoreDialog.tsx`

**Files:**
- Modify: `src/components/b2b-accounts/AddStoreDialog.tsx`

**Master plan target:** custom modal div → `Modal` primitive.

- [ ] **Step 1: Replace custom modal markup with `Modal`**

Behavior unchanged: same submit, same field set, same disabled rules.

Key changes:
- Import `Modal`.
- Replace outer `fixed inset-0 z-40 ...` div with `<Modal open onClose={onClose} title="Add store" footer={<>buttons</>}>`.
- Drop `<h2>` (now in `Modal`'s title slot).
- Drop the wrapping `<div className="mt-6 flex justify-end gap-2">` (now in footer slot).

Full file:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

export function AddStoreDialog({
  organizationId,
  onClose,
  onAdded,
}: {
  organizationId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('NZ')

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || undefined,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Create failed')
      return
    }
    onAdded()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add store"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={busy || !name.trim()}
          >
            {busy ? 'Creating…' : 'Create store'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Address
          <Input
            className="mt-1"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            City
            <Input
              className="mt-1"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Postal code
            <Input
              className="mt-1"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          Country
          <Input
            className="mt-1"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/b2b-accounts/AddStoreDialog.tsx
git commit -m "refactor(add-store-dialog): consistent UI primitives + states"
```

---

## Task 5: Audit `ProductsSelectionBar.tsx`

**Files:**
- Modify: `src/components/products/ProductsSelectionBar.tsx`

**Master plan target:** "Probably already on UI primitives; quick audit + fix."

**Audit result:** Already uses `Button` from `@/components/ui/button` for both action buttons. The sticky bar styling (`sticky bottom-0 left-0 right-0 z-30 ... bg-white shadow-lg`) is reasonable but the border-top is a thin gray line that could match the `Card` aesthetic better with a softer rounded-top edge. Minor polish only.

- [ ] **Step 1: Light polish — soften top edge to match Card aesthetic**

Behavior unchanged. Visual change: `border-t` stays, but switch from raw `border-t border-gray-200 bg-white` to a subtle rounded-top with `Card`-like shadow distribution. Keep the sticky positioning. The 1-line text count is fine as-is.

Full file:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateCatalogueDialog } from '@/components/catalogues/CreateCatalogueDialog'

export function ProductsSelectionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[]
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  if (selectedIds.length === 0) return null
  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)]">
        <span className="text-sm font-medium text-gray-700">
          {selectedIds.length} selected
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear
          </Button>
          <Button type="button" variant="accent" onClick={() => setOpen(true)}>
            Create B2B catalogue from selected
          </Button>
        </div>
      </div>
      {open && (
        <CreateCatalogueDialog
          productIds={selectedIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ProductsSelectionBar.tsx
git commit -m "refactor(products-selection-bar): consistent UI primitives + states"
```

---

## Task 6: Refactor `CreateCatalogueDialog.tsx`

**Files:**
- Modify: `src/components/catalogues/CreateCatalogueDialog.tsx`

**Master plan target:** custom modal div → `Modal` primitive.

- [ ] **Step 1: Replace custom modal + raw `<select>`**

Behavior unchanged: same orgs fetch, same submit logic, same disabled rules, same router.push redirect.

Key changes:
- Import `Modal`, `Select`.
- Replace fixed-inset wrapper with `<Modal open onClose={onClose} title="Create B2B catalogue" description={...} footer={...}>`.
- Replace inline-styled `<select>` with `<Select>`.

Full file:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Org = { id: string; name: string }

export function CreateCatalogueDialog({
  productIds,
  onClose,
  defaultOrgId,
}: {
  productIds: string[]
  onClose: () => void
  defaultOrgId?: string
}) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState(defaultOrgId ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations ?? []))
      .catch(() => setOrgs([]))
  }, [])

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/catalogues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        name,
        description: description || undefined,
        product_ids: productIds.length > 0 ? productIds : undefined,
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Create failed')
      setBusy(false)
      return
    }
    const { id } = (await res.json()) as { id: string }
    router.push(`/catalogues/${id}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create B2B catalogue"
      description={
        productIds.length === 0
          ? 'Empty catalogue — add items after creating.'
          : `${productIds.length} product${productIds.length === 1 ? '' : 's'} will be added (master tiers auto-copied).`
      }
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={busy || !orgId || !name}
          >
            {busy ? 'Creating…' : 'Create catalogue'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          Organization
          <Select
            className="mt-1"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">— Select —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Description
          <Textarea
            className="mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalogues/CreateCatalogueDialog.tsx
git commit -m "refactor(create-catalogue-dialog): consistent UI primitives + states"
```

---

## Task 7: Refactor `AddFromMasterDialog.tsx`

**Files:**
- Modify: `src/components/catalogues/AddFromMasterDialog.tsx`

**Master plan target:** custom modal div → `Modal` primitive.

⚠ **Hidden behavior preserved:** This component has a 300ms debounce + cleanup on the search input. The refactor must not break the debounce. Keep `useRef` + `setTimeout`/`clearTimeout` exactly as-is.

- [ ] **Step 1: Replace custom modal markup with `Modal`**

Behavior unchanged: debounce, cleanup, error/loading/empty branches all preserved.

Key changes:
- Import `Modal`.
- Replace outer fixed-inset wrapper with `<Modal open onClose={onClose} title="Add from master products" description="..." size="lg" footer={<Close button>}>`.
- Inner search input + results list move into Modal body unchanged.

Full file:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

type SearchHit = {
  id: string
  name: string
  image_url?: string | null
  sku?: string | null
}

export function AddFromMasterDialog({
  catalogueId,
  onClose,
  onAdded,
}: {
  catalogueId: string
  onClose: () => void
  onAdded: () => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/products/search?q=${encodeURIComponent(query.trim())}`,
        )
        if (!r.ok) {
          setError('Search failed')
          setResults([])
          return
        }
        const d = (await r.json()) as { products?: SearchHit[] }
        setResults(d.products ?? [])
        setError(null)
      } catch {
        setError('Search failed')
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function add(productId: string) {
    setAdding(productId)
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_product_id: productId }),
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Add failed')
      setAdding(null)
      return
    }
    setAdding(null)
    await onAdded()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add from master products"
      description="Search for an existing master product to copy into this catalogue. Master pricing tiers will auto-copy."
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Input
        autoFocus
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-3 max-h-80 overflow-y-auto">
        {error && (
          <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {query.trim().length < 2 ? (
          <p className="text-sm text-gray-500">
            Type at least 2 characters to search.
          </p>
        ) : loading ? (
          <p className="text-sm text-gray-500">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500">No matching products.</p>
        ) : (
          <ul className="divide-y">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-100" />
                )}
                <div className="flex-1">
                  <div className="text-sm">{p.name}</div>
                  {p.sku && (
                    <div className="text-xs text-gray-500">{p.sku}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => add(p.id)}
                  disabled={adding === p.id}
                >
                  {adding === p.id ? 'Adding…' : 'Add'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalogues/AddFromMasterDialog.tsx
git commit -m "refactor(add-from-master-dialog): consistent UI primitives + states"
```

---

## Task 8: Refactor `CreateB2BOnlyItemDialog.tsx`

**Files:**
- Modify: `src/components/catalogues/CreateB2BOnlyItemDialog.tsx`

**Master plan target:** custom modal div → `Modal` primitive. Also has 2 raw `<select>` (category, brand) and 1 raw `<input type="checkbox">` (decoration eligible) that should move to primitives.

- [ ] **Step 1: Replace custom modal + raw markup**

Behavior unchanged: brand/category fetches, formValid logic, submit flow.

Key changes:
- Import `Modal`, `Select`, `Checkbox`.
- Outer fixed-inset wrapper → `<Modal>`.
- Inline-styled `<select>` for category + brand → `<Select>`.
- `<input type="checkbox">` for decoration eligible → `<Checkbox>`.

Full file:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'

type Lookup = { id: string; name: string }

export function CreateB2BOnlyItemDialog({
  catalogueId,
  onClose,
  onAdded,
}: {
  catalogueId: string
  onClose: () => void
  onAdded: () => void | Promise<void>
}) {
  const [brands, setBrands] = useState<Lookup[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [name, setName] = useState('')
  const [baseCost, setBaseCost] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [decorationEligible, setDecorationEligible] = useState(false)
  const [decorationPrice, setDecorationPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/brands')
      .then((r) => (r.ok ? r.json() : { brands: [] }))
      .then((d: { brands?: Lookup[] }) => setBrands(d.brands ?? []))
      .catch(() => setBrands([]))
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: Lookup[] }) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]))
  }, [])

  const baseCostNum = Number(baseCost)
  const formValid =
    name.trim().length > 0 &&
    baseCost !== '' &&
    Number.isFinite(baseCostNum) &&
    !!brandId &&
    !!categoryId

  async function submit() {
    if (!formValid) return
    setBusy(true)
    setError(null)
    const body: Record<string, unknown> = {
      name: name.trim(),
      base_cost: baseCostNum,
      brand_id: brandId,
      category_id: categoryId,
      decoration_eligible: decorationEligible,
    }
    if (decorationEligible && decorationPrice !== '') {
      body.decoration_price = Number(decorationPrice)
    }
    if (imageUrl.trim()) body.image_url = imageUrl.trim()

    const r = await fetch(`/api/catalogues/${catalogueId}/items/b2b-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Create failed')
      setBusy(false)
      return
    }
    setBusy(false)
    await onAdded()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create B2B-only item"
      description={
        <>
          Creates a new product flagged <code>is_b2b_only</code> and adds it to this catalogue.
        </>
      }
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={busy || !formValid}
          >
            {busy ? 'Creating…' : 'Create item'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          Base cost
          <Input
            className="mt-1"
            type="number"
            step="0.01"
            min={0}
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          Category
          <Select
            className="mt-1"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm">
          Brand
          <Select
            className="mt-1"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">— Select —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={decorationEligible}
            onChange={(e) => setDecorationEligible(e.target.checked)}
          />
          Decoration eligible
        </label>

        {decorationEligible && (
          <label className="block text-sm">
            Decoration price
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              min={0}
              value={decorationPrice}
              onChange={(e) => setDecorationPrice(e.target.value)}
            />
          </label>
        )}

        <label className="block text-sm">
          Image URL (optional)
          <Input
            className="mt-1"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd c:/Users/MSI/Documents/Projects/print-room-staff-portal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalogues/CreateB2BOnlyItemDialog.tsx
git commit -m "refactor(create-b2b-only-item-dialog): consistent UI primitives + states"
```

---

## Self-review

**Spec coverage (master plan §WS2 table):**
- Row 1 CatalogueItemsTable → Task 1 ✓
- Row 2 AccountTermsCard → Task 2 ✓
- Row 3 StoresPanel → Task 3 ✓
- Row 4 AddStoreDialog → Task 4 ✓
- Row 5 ProductsSelectionBar → Task 5 ✓
- Row 6 CreateCatalogueDialog → Task 6 ✓
- Row 7 AddFromMasterDialog → Task 7 ✓
- Row 8 CreateB2BOnlyItemDialog → Task 8 ✓
- Row 9 OverrideFlag → out of scope per master plan ✓
- Primitive gap (Select / Checkbox / Modal) → Task 0 ✓

**Hidden-behavior carry-over:**
- AddFromMasterDialog 300ms debounce — preserved verbatim in Task 7.
- All `defaultValue`+`onBlur` patterns (uncontrolled inputs that fire one PATCH on blur) — preserved.
- `setOpenId(openId === s.id ? null : s.id)` toggle in StoresPanel — preserved.
- `useTransition`+`router.refresh()` in AccountTermsCard and StoresPanel — preserved.
- Empty-state CTA buttons in CatalogueItemsTable now live in the empty `<Card>` block; the buttons-row below the table only renders when items exist (Task 1). This is a small UX win, not a behavior change.

**No placeholders.** Every task has full file contents. No "implement later", no "similar to Task N".

**Type consistency.** All primitives `Select`, `Checkbox`, `Modal` are defined once in Task 0 and used identically across Tasks 1–8. `Input`, `Card`, `Button`, `Textarea` already exist and are imported with the same path.

---

## Definition of done

- All 8 in-scope files refactored, plus 3 new UI primitives in Task 0
- `npx tsc --noEmit` clean
- Each refactor committed individually with message `refactor(<surface>): consistent UI primitives + states` (Task 0 uses `feat(ui): ...` since it's net-new)
- Branch `feat/ws2-staff-polish` not pushed (Jamie reviews first)
- Manual smoke per surface using PRT tenant `ee155266-200c-4b73-8dbd-be385db3e5b0` after the full chain lands
