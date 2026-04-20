'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SwatchRow } from '@/types/products'

interface Props {
  productId: string
}

export function SwatchesTab({ productId }: Props) {
  const [items, setItems] = useState<SwatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ label: '', hex: '#000000', image_url: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/swatches`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.swatches || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/swatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.swatch])
        setDraft({ label: '', hex: '#000000', image_url: '' })
      } else {
        window.alert(json.error || 'Failed to add swatch.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<SwatchRow>) {
    const res = await fetch(`/api/products/${productId}/swatches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) setItems(prev => prev.map(s => (s.id === id ? json.swatch : s)))
    else window.alert(json.error || 'Failed to update swatch.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this swatch?')) return
    const res = await fetch(`/api/products/${productId}/swatches/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(s => s.id !== id))
    else window.alert('Failed to delete swatch.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading swatches...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(s => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.hex}
                onChange={e => update(s.id, { hex: e.target.value })}
                className="w-10 h-10 rounded border border-gray-200"
              />
              <Input
                value={s.label}
                onChange={e => update(s.id, { label: e.target.value })}
                className="flex-1"
              />
            </div>
            <Input
              placeholder="Image URL (optional)"
              value={s.image_url || ''}
              onChange={e => update(s.id, { image_url: e.target.value })}
            />
            <div className="flex justify-between items-center">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={s.is_active}
                  onChange={e => update(s.id, { is_active: e.target.checked })}
                />
                Active
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(s.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add swatch</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <input
            type="color"
            value={draft.hex}
            onChange={e => setDraft({ ...draft, hex: e.target.value })}
            className="w-12 h-10 rounded border border-gray-200"
          />
          <Input
            placeholder="Label (e.g. Navy)"
            value={draft.label}
            onChange={e => setDraft({ ...draft, label: e.target.value })}
          />
          <Input
            placeholder="Image URL (optional)"
            value={draft.image_url}
            onChange={e => setDraft({ ...draft, image_url: e.target.value })}
          />
          <Button type="button" variant="accent" onClick={add} disabled={busy}>
            {busy ? 'Adding...' : 'Add swatch'}
          </Button>
        </div>
      </div>
    </div>
  )
}
