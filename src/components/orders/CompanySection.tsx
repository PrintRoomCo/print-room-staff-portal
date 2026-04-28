'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface CompanyOrg {
  id: string
  name: string
  customer_code: string | null
}

export interface B2BAccount {
  tier_level: number | null
  payment_terms: string | null
  credit_limit: number | null
  default_deposit_percent: number | null
}

interface OrgResult {
  id: string
  name: string
  customer_code: string | null
}

interface CompanySectionProps {
  organization: CompanyOrg | null
  b2bAccount: B2BAccount | null
  stocked: boolean
  onChangeOrganization: (
    org: CompanyOrg | null,
    account: B2BAccount | null,
    stocked: boolean,
  ) => void
  onChangeCustomerCode: (code: string) => void
  customerEmail: string
  onChangeCustomerEmail: (email: string) => void
}

export function CompanySection({
  organization,
  b2bAccount,
  stocked,
  onChangeOrganization,
  onChangeCustomerCode,
  customerEmail,
  onChangeCustomerEmail,
}: CompanySectionProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<OrgResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const [codeDraft, setCodeDraft] = useState('')
  const [codeSaving, setCodeSaving] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Debounced org typeahead.
  useEffect(() => {
    if (!showDropdown || search.length < 2 || organization) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/organizations/search?q=${encodeURIComponent(search)}`,
        )
        if (r.ok) {
          const json = (await r.json()) as { orgs?: OrgResult[] }
          setResults(json.orgs ?? [])
        }
      } catch {
        /* ignore */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search, showDropdown, organization])

  async function selectOrg(r: OrgResult) {
    setShowDropdown(false)
    setResults([])
    setSearch('')

    try {
      const bRes = await fetch(`/api/b2b-accounts?organization_id=${r.id}`)
      let account: B2BAccount | null = null
      let isStocked = false
      if (bRes.ok) {
        const json = (await bRes.json()) as {
          account: B2BAccount | null
          stocked?: boolean
        }
        account = json.account ?? null
        isStocked = !!json.stocked
      }
      const org: CompanyOrg = {
        id: r.id,
        name: r.name,
        customer_code: r.customer_code,
      }
      onChangeOrganization(org, account, isStocked)
    } catch {
      onChangeOrganization(
        { id: r.id, name: r.name, customer_code: r.customer_code },
        null,
        false,
      )
    }
  }

  function clearOrg() {
    onChangeOrganization(null, null, false)
    setSearch('')
    setCodeDraft('')
    setCodeError(null)
  }

  async function saveCode() {
    if (!organization) return
    const code = codeDraft.trim().toUpperCase()
    if (!/^[A-Z0-9]{2,6}$/.test(code)) {
      setCodeError('Must be 2–6 letters or digits.')
      return
    }
    setCodeSaving(true)
    setCodeError(null)
    try {
      const r = await fetch(
        `/api/organizations/${organization.id}/customer-code`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_code: code }),
        },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setCodeError(j.error ?? 'Failed to save customer code.')
        return
      }
      onChangeCustomerCode(code)
      setCodeDraft('')
    } catch (e) {
      setCodeError((e as Error).message || 'Failed to save customer code.')
    } finally {
      setCodeSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Company</h2>
        {organization && (
          <Button type="button" variant="ghost" size="sm" onClick={clearOrg}>
            Change
          </Button>
        )}
      </div>

      {!organization ? (
        <div className="relative">
          <Input
            placeholder="Search organisations…"
            value={search}
            onFocus={() => setShowDropdown(true)}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
            }}
          />
          {showDropdown && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectOrg(r)}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-medium">{organization.name}</span>
            {organization.customer_code ? (
              <span className="inline-block bg-gray-100 rounded-full px-3 py-1 text-xs font-mono">
                {organization.customer_code}
              </span>
            ) : (
              <span className="inline-block bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-xs">
                No customer code
              </span>
            )}
            {stocked && (
              <span className="inline-block bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-xs">
                Stocked
              </span>
            )}
          </div>

          {!organization.customer_code && (
            <div className="flex items-end gap-2 flex-wrap">
              <label className="block text-sm">
                <span className="text-gray-600">
                  Assign customer code (2–6 chars)
                </span>
                <Input
                  value={codeDraft}
                  onChange={(e) =>
                    setCodeDraft(e.target.value.toUpperCase())
                  }
                  placeholder="ACME"
                  maxLength={6}
                  className="mt-1 w-40"
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={codeSaving || !codeDraft}
                onClick={saveCode}
              >
                {codeSaving ? 'Saving…' : 'Save code'}
              </Button>
              {codeError && (
                <span className="text-xs text-red-600">{codeError}</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-2 border-t">
            <div>
              <div className="text-gray-500 text-xs">Tier</div>
              <div className="font-medium">
                {b2bAccount?.tier_level ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Payment terms</div>
              <div className="font-medium">
                {b2bAccount?.payment_terms ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Credit limit</div>
              <div className="font-medium">
                {b2bAccount?.credit_limit != null
                  ? `$${Number(b2bAccount.credit_limit).toFixed(2)}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Default deposit %</div>
              <div className="font-medium">
                {b2bAccount?.default_deposit_percent != null
                  ? `${b2bAccount.default_deposit_percent}%`
                  : '—'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <label className="block text-sm">
              <span className="text-gray-600">
                Customer email <span className="text-red-500">*</span>
              </span>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => onChangeCustomerEmail(e.target.value)}
                placeholder="orders@customer.example"
                className="mt-1 max-w-sm"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Used on the Monday production card and order confirmation. Leave
              blank if unknown — submit will be blocked.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
