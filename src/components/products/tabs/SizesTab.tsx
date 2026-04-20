'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SizeRow } from '@/types/products'

interface Props {
  productId: string
}

export function SizesTab({ productId }: Props) {
  const [items, setItems] = useState<SizeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/sizes`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.sizes || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function quickAdd() {
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/sizes/quick-add`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) setItems(json.sizes || [])
      else window.alert(json.error || 'Failed to add standard sizes.')
    } finally {
      setBusy(false)
    }
  }

  async function addCustom() {
    if (!custom.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/sizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: custom.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.size])
        setCustom('')
      } else window.alert(json.error || 'Failed to add size.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(sizeId: number) {
    if (!window.confirm('Delete this size?')) return
    const res = await fetch(`/api/products/${productId}/sizes/${sizeId}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(s => s.id !== sizeId))
    else window.alert('Failed to delete size.')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading sizes...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {items.map(s => (
          <Badge key={s.id} variant="gray" className="text-sm gap-2">
            {s.label}
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="text-gray-400 hover:text-red-600"
              aria-label={`Delete ${s.label}`}
            >
              ×
            </button>
          </Badge>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No sizes yet.</p>}
      </div>

      <div className="flex flex-wrap gap-3 items-center border-t border-gray-100 pt-4">
        <Button type="button" variant="secondary" onClick={quickAdd} disabled={busy}>
          Add standard sizes (XS-5XL)
        </Button>
        <span className="text-xs text-gray-400">or</span>
        <Input
          placeholder="Custom size label"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant="accent" onClick={addCustom} disabled={busy || !custom.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}
