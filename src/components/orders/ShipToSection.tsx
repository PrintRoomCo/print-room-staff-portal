'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

export interface ShipAddress {
  line1: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

export interface ShipToState {
  storeId: string | null
  address: ShipAddress
  saveAsStore: boolean
}

interface StoreRow {
  id: string
  name: string
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  phone: string | null
}

interface ShipToSectionProps {
  organizationId: string | null
  value: ShipToState
  onChange: (next: ShipToState) => void
}

export const EMPTY_ADDRESS: ShipAddress = {
  line1: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'NZ',
  phone: '',
}

export function ShipToSection({
  organizationId,
  value,
  onChange,
}: ShipToSectionProps) {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!organizationId) {
      setStores([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/stores?organization_id=${organizationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { stores?: StoreRow[] }) => {
        if (cancelled) return
        setStores(json.stores ?? [])
      })
      .catch(() => {
        if (!cancelled) setStores([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  function selectStore(storeId: string) {
    if (!storeId) {
      onChange({
        ...value,
        storeId: null,
        address: EMPTY_ADDRESS,
      })
      return
    }
    const s = stores.find((x) => x.id === storeId)
    if (!s) return
    onChange({
      ...value,
      storeId: s.id,
      address: {
        line1: s.address ?? '',
        city: s.city ?? '',
        state: s.state ?? '',
        postalCode: s.postal_code ?? '',
        country: s.country ?? 'NZ',
        phone: s.phone ?? '',
      },
    })
  }

  function updateAddr(patch: Partial<ShipAddress>) {
    onChange({
      ...value,
      storeId: null, // editing clears linked store
      address: { ...value.address, ...patch },
    })
  }

  const showCustomForm = !value.storeId

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <h2 className="text-base font-semibold">Ship to</h2>

      <label className="block text-sm">
        <span className="text-gray-600">Store</span>
        <select
          value={value.storeId ?? ''}
          onChange={(e) => selectStore(e.target.value)}
          disabled={!organizationId}
          className="mt-1 block w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm text-foreground focus:outline-none focus:border-gray-400 focus:bg-gray-100 disabled:opacity-50"
        >
          <option value="">
            {!organizationId
              ? 'Select a company first…'
              : loading
                ? 'Loading stores…'
                : stores.length
                  ? 'Custom address'
                  : 'No saved stores — enter custom address'}
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.location ? ` — ${s.location}` : ''}
            </option>
          ))}
        </select>
      </label>

      {showCustomForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">Address</span>
            <Input
              value={value.address.line1}
              onChange={(e) => updateAddr({ line1: e.target.value })}
              placeholder="Street address"
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">City</span>
            <Input
              value={value.address.city}
              onChange={(e) => updateAddr({ city: e.target.value })}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">State / region</span>
            <Input
              value={value.address.state}
              onChange={(e) => updateAddr({ state: e.target.value })}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Postal code</span>
            <Input
              value={value.address.postalCode}
              onChange={(e) => updateAddr({ postalCode: e.target.value })}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Country</span>
            <Input
              value={value.address.country}
              onChange={(e) => updateAddr({ country: e.target.value })}
              className="mt-1"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">Phone</span>
            <Input
              value={value.address.phone}
              onChange={(e) => updateAddr({ phone: e.target.value })}
              className="mt-1"
            />
          </label>
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={value.saveAsStore}
              onChange={(e) =>
                onChange({ ...value, saveAsStore: e.target.checked })
              }
            />
            <span>Save as a store for future orders (not yet written — v1)</span>
          </label>
        </div>
      )}
    </section>
  )
}
