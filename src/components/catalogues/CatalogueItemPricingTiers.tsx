'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CatalogueEditorItem } from './CatalogueEditor'

type Tier = {
  id: string
  catalogue_item_id: string
  min_quantity: number
  max_quantity: number | null
  unit_price: number
}

export function CatalogueItemPricingTiers({
  catalogueId,
  items,
}: {
  catalogueId: string
  items: CatalogueEditorItem[]
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [tiersByItem, setTiersByItem] = useState<Record<string, Tier[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<Record<string, string | null>>({})

  async function loadTiers(itemId: string) {
    setLoading((s) => ({ ...s, [itemId]: true }))
    setError((s) => ({ ...s, [itemId]: null }))
    const r = await fetch(
      `/api/catalogues/${catalogueId}/items/${itemId}/tiers`,
    )
    if (!r.ok) {
      setError((s) => ({ ...s, [itemId]: 'Failed to load tiers' }))
      setLoading((s) => ({ ...s, [itemId]: false }))
      return
    }
    const d = (await r.json()) as { tiers?: Tier[] }
    setTiersByItem((s) => ({ ...s, [itemId]: d.tiers ?? [] }))
    setLoading((s) => ({ ...s, [itemId]: false }))
  }

  async function toggle(itemId: string) {
    const next = !open[itemId]
    setOpen((s) => ({ ...s, [itemId]: next }))
    if (next && !tiersByItem[itemId]) {
      await loadTiers(itemId)
    }
  }

  async function patchTier(
    itemId: string,
    tierId: string,
    patch: Record<string, unknown>,
  ) {
    setError((s) => ({ ...s, [itemId]: null }))
    const r = await fetch(
      `/api/catalogues/${catalogueId}/items/${itemId}/tiers/${tierId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    )
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError((s) => ({ ...s, [itemId]: j.error ?? 'Update failed' }))
      return
    }
    await loadTiers(itemId)
  }

  async function deleteTier(itemId: string, tierId: string) {
    if (!confirm('Delete this tier?')) return
    setError((s) => ({ ...s, [itemId]: null }))
    const r = await fetch(
      `/api/catalogues/${catalogueId}/items/${itemId}/tiers/${tierId}`,
      { method: 'DELETE' },
    )
    if (!r.ok && r.status !== 204) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError((s) => ({ ...s, [itemId]: j.error ?? 'Delete failed' }))
      return
    }
    await loadTiers(itemId)
  }

  async function addTier(
    itemId: string,
    minQty: string,
    maxQty: string,
    unitPrice: string,
    reset: () => void,
  ) {
    const minN = Number(minQty)
    const priceN = Number(unitPrice)
    if (
      !Number.isFinite(minN) ||
      !Number.isFinite(priceN) ||
      minQty === '' ||
      unitPrice === ''
    ) {
      setError((s) => ({
        ...s,
        [itemId]: 'min_quantity and unit_price required',
      }))
      return
    }
    const body: Record<string, unknown> = {
      min_quantity: minN,
      unit_price: priceN,
      max_quantity: maxQty === '' ? null : Number(maxQty),
    }
    setError((s) => ({ ...s, [itemId]: null }))
    const r = await fetch(
      `/api/catalogues/${catalogueId}/items/${itemId}/tiers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError((s) => ({ ...s, [itemId]: j.error ?? 'Add failed' }))
      return
    }
    reset()
    await loadTiers(itemId)
  }

  async function refreshFromMaster(itemId: string) {
    if (
      !confirm(
        'Replace this item\'s catalogue tiers with a fresh copy from the master product? Any custom edits will be lost.',
      )
    ) {
      return
    }
    setError((s) => ({ ...s, [itemId]: null }))
    const r = await fetch(
      `/api/catalogues/${catalogueId}/items/${itemId}/refresh-tiers`,
      { method: 'POST' },
    )
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError((s) => ({ ...s, [itemId]: j.error ?? 'Refresh failed' }))
      return
    }
    await loadTiers(itemId)
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No items in this catalogue yet. Add some on the Items tab first.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <ItemTierCard
          key={it.id}
          item={it}
          isOpen={!!open[it.id]}
          tiers={tiersByItem[it.id]}
          loading={!!loading[it.id]}
          error={error[it.id] ?? null}
          onToggle={() => toggle(it.id)}
          onPatchTier={(tierId, patch) => patchTier(it.id, tierId, patch)}
          onDeleteTier={(tierId) => deleteTier(it.id, tierId)}
          onAddTier={(min, max, price, reset) =>
            addTier(it.id, min, max, price, reset)
          }
          onRefresh={() => refreshFromMaster(it.id)}
        />
      ))}
    </div>
  )
}

function ItemTierCard({
  item,
  isOpen,
  tiers,
  loading,
  error,
  onToggle,
  onPatchTier,
  onDeleteTier,
  onAddTier,
  onRefresh,
}: {
  item: CatalogueEditorItem
  isOpen: boolean
  tiers: Tier[] | undefined
  loading: boolean
  error: string | null
  onToggle: () => void
  onPatchTier: (tierId: string, patch: Record<string, unknown>) => void
  onDeleteTier: (tierId: string) => void
  onAddTier: (
    min: string,
    max: string,
    price: string,
    reset: () => void,
  ) => void
  onRefresh: () => void
}) {
  const [newMin, setNewMin] = useState('')
  const [newMax, setNewMax] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const reset = () => {
    setNewMin('')
    setNewMax('')
    setNewPrice('')
  }

  return (
    <div className="rounded border border-gray-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-medium">{item.source.name}</span>
        <span className="text-xs text-gray-500">
          {isOpen ? 'Hide' : 'Show'} tiers
        </span>
      </button>
      {isOpen && (
        <div className="border-t px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Pricing tiers</h3>
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              Refresh from master
            </Button>
          </div>
          {error && (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-2 py-2">Min qty</th>
                  <th className="px-2 py-2">Max qty</th>
                  <th className="px-2 py-2">Unit price</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(tiers ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-center text-gray-500"
                    >
                      No tiers yet.
                    </td>
                  </tr>
                ) : (
                  (tiers ?? []).map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          defaultValue={t.min_quantity}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          onBlur={(e) =>
                            onPatchTier(t.id, {
                              min_quantity: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          defaultValue={t.max_quantity ?? ''}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          onBlur={(e) =>
                            onPatchTier(t.id, {
                              max_quantity:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={t.unit_price}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                          onBlur={(e) =>
                            onPatchTier(t.id, {
                              unit_price: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => onDeleteTier(t.id)}
                          className="text-xs text-red-600 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      placeholder="min"
                      value={newMin}
                      onChange={(e) => setNewMin(e.target.value)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      placeholder="max"
                      value={newMax}
                      onChange={(e) => setNewMax(e.target.value)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="price"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() =>
                        onAddTier(newMin, newMax, newPrice, reset)
                      }
                    >
                      Add tier
                    </Button>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
