'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
    <section className="rounded border border-gray-200 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          Stores ({stores.length})
        </h2>
        <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>
          + Add store
        </Button>
      </header>

      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
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
                <button
                  type="button"
                  className="text-xs text-blue-600 underline"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  {openId === s.id ? 'Close' : 'Edit'}
                </button>
              </div>

              {openId === s.id && (
                <form
                  className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setOpenId(null)
                  }}
                >
                  {EDITABLE_FIELDS.map((field) => (
                    <label key={field} className="block text-xs text-gray-600">
                      {field.replace('_', ' ')}
                      <input
                        aria-label={`Store ${field}`}
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
    </section>
  )
}
