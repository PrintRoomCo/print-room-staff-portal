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
