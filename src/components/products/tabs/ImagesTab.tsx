'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ImageRow } from '@/types/products'

const VIEWS: Array<{ value: string; label: string }> = [
  { value: '', label: '—' },
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side', label: 'Side' },
  { value: 'detail', label: 'Detail' },
]

interface Props {
  productId: string
}

export function ImagesTab({ productId }: Props) {
  const [items, setItems] = useState<ImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ file_url: '', view: '', alt_text: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/products/${productId}/images`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.images || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function add() {
    if (!draft.file_url.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()
      if (res.ok) {
        setItems(prev => [...prev, json.image])
        setDraft({ file_url: '', view: '', alt_text: '' })
      } else window.alert(json.error || 'Failed to add image.')
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, patch: Partial<ImageRow>) {
    const res = await fetch(`/api/products/${productId}/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok) setItems(prev => prev.map(i => (i.id === id ? json.image : i)))
    else window.alert(json.error || 'Failed to update image.')
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this image?')) return
    const res = await fetch(`/api/products/${productId}/images/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    else window.alert('Failed to delete image.')
  }

  async function makePrimary(id: string) {
    const target = items.find(i => i.id === id)
    if (!target) return
    await update(id, { position: -1 })
    setItems(prev => {
      const re = [target, ...prev.filter(i => i.id !== id)]
      return re.map((img, idx) => ({ ...img, position: idx }))
    })
  }

  if (loading) return <p className="text-sm text-gray-500">Loading images...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((img, idx) => (
          <div key={img.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
              <Image
                src={img.file_url}
                alt={img.alt_text || ''}
                width={300}
                height={300}
                unoptimized
                className="object-cover w-full h-full"
              />
            </div>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs"
              value={img.view || ''}
              onChange={e => update(img.id, { view: e.target.value || null })}
            >
              {VIEWS.map(v => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Alt text"
              value={img.alt_text || ''}
              onChange={e => update(img.id, { alt_text: e.target.value })}
              className="text-xs"
            />
            <div className="flex justify-between items-center">
              {idx === 0 ? (
                <span className="text-xs text-emerald-700 font-medium">Primary</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => makePrimary(img.id)}>
                  Set primary
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(img.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold mb-2">Add image</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <Input
            placeholder="https://..."
            value={draft.file_url}
            onChange={e => setDraft({ ...draft, file_url: e.target.value })}
            className="md:col-span-2"
          />
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={draft.view}
            onChange={e => setDraft({ ...draft, view: e.target.value })}
          >
            {VIEWS.map(v => (
              <option key={v.value} value={v.value}>
                {v.label || 'View (optional)'}
              </option>
            ))}
          </select>
          <Button type="button" variant="accent" onClick={add} disabled={busy || !draft.file_url.trim()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
