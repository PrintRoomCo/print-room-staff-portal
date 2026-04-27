'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Org = { id: string; name: string }

export function CreateCatalogueDialog({
  productIds,
  onClose,
}: {
  productIds: string[]
  onClose: () => void
}) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
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
        discount_pct: discountPct,
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Create B2B catalogue</h2>
        <p className="mt-1 text-sm text-gray-500">
          {productIds.length === 0
            ? 'Empty catalogue — add items after creating.'
            : `${productIds.length} product${productIds.length === 1 ? '' : 's'} will be added (master tiers auto-copied).`}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Organization
            <select
              className="mt-1 w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">— Select —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
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
          <label className="block text-sm">
            Discount %
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={100}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
            />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
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
        </div>
      </div>
    </div>
  )
}
