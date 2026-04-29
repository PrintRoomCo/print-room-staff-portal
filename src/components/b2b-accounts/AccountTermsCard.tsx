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
