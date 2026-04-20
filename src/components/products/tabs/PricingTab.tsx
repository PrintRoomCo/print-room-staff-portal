'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PricingTierRow } from '@/types/products'

interface Props {
  productId: string
}

export function PricingTab({ productId }: Props) {
  const [items, setItems] = useState<PricingTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ min_quantity: '', max_quantity: '', unit_price: '', currency: 'NZD' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/pricing-tiers`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.tiers || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/pricing-tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_quantity: parseInt(draft.min_quantity, 10),
          max_quantity: draft.max_quantity ? parseInt(draft.max_quantity, 10) : null,
          unit_price: parseFloat(draft.unit_price),
          currency: draft.currency,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.tier].sort((a, b) => a.min_quantity - b.min_quantity))
        setDraft({ min_quantity: '', max_quantity: '', unit_price: '', currency: 'NZD' })
      } else window.alert(json.error || 'Failed to add tier.')
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<PricingTierRow>) {
    const res = await fetch(`/api/products/${productId}/pricing-tiers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) {
      setItems(prev =>
        prev.map(t => (t.id === id ? json.tier : t)).sort((a, b) => a.min_quantity - b.min_quantity)
      )
    } else window.alert(json.error || 'Failed to update tier.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this pricing tier?')) return
    const res = await fetch(`/api/products/${productId}/pricing-tiers/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(t => t.id !== id))
    else window.alert('Failed to delete tier.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading pricing tiers...</p>

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-500 text-left">
            <th className="py-2 pr-2">Min qty</th>
            <th className="py-2 pr-2">Max qty</th>
            <th className="py-2 pr-2">Unit price</th>
            <th className="py-2 pr-2">Currency</th>
            <th className="py-2 pr-2">Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id} className="border-t border-gray-100">
              <td className="py-2 pr-2 w-24">
                <Input
                  type="number"
                  defaultValue={t.min_quantity}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10)
                    if (Number.isFinite(v) && v !== t.min_quantity) update(t.id, { min_quantity: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-24">
                <Input
                  type="number"
                  defaultValue={t.max_quantity ?? ''}
                  placeholder="∞"
                  onBlur={e => {
                    const raw = e.target.value
                    const next = raw === '' ? null : parseInt(raw, 10)
                    update(t.id, { max_quantity: next == null || Number.isFinite(next) ? next : t.max_quantity })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-28">
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={t.unit_price}
                  onBlur={e => {
                    const v = parseFloat(e.target.value)
                    if (Number.isFinite(v) && v !== t.unit_price) update(t.id, { unit_price: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2 w-20">
                <Input
                  defaultValue={t.currency}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    if (v && v !== t.currency) update(t.id, { currency: v })
                  }}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  checked={t.is_active}
                  onChange={e => update(t.id, { is_active: e.target.checked })}
                />
              </td>
              <td className="py-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-sm text-gray-500 py-4 text-center">
                No pricing tiers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add tier</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Input
            type="number"
            placeholder="Min qty"
            value={draft.min_quantity}
            onChange={e => setDraft({ ...draft, min_quantity: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Max qty (blank = ∞)"
            value={draft.max_quantity}
            onChange={e => setDraft({ ...draft, max_quantity: e.target.value })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Unit price"
            value={draft.unit_price}
            onChange={e => setDraft({ ...draft, unit_price: e.target.value })}
          />
          <Input
            placeholder="Currency"
            value={draft.currency}
            onChange={e => setDraft({ ...draft, currency: e.target.value })}
          />
          <Button
            type="button"
            variant="accent"
            onClick={add}
            disabled={busy || !draft.min_quantity || !draft.unit_price}
          >
            {busy ? 'Adding...' : 'Add tier'}
          </Button>
        </div>
      </div>
    </div>
  )
}
