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
