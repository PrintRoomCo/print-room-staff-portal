'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Lookup = { id: string; name: string }

export function CreateB2BOnlyItemDialog({
  catalogueId,
  onClose,
  onAdded,
}: {
  catalogueId: string
  onClose: () => void
  onAdded: () => void | Promise<void>
}) {
  const [brands, setBrands] = useState<Lookup[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [name, setName] = useState('')
  const [baseCost, setBaseCost] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [decorationEligible, setDecorationEligible] = useState(false)
  const [decorationPrice, setDecorationPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/brands')
      .then((r) => (r.ok ? r.json() : { brands: [] }))
      .then((d: { brands?: Lookup[] }) => setBrands(d.brands ?? []))
      .catch(() => setBrands([]))
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: Lookup[] }) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]))
  }, [])

  const baseCostNum = Number(baseCost)
  const formValid =
    name.trim().length > 0 &&
    baseCost !== '' &&
    Number.isFinite(baseCostNum) &&
    !!brandId &&
    !!categoryId

  async function submit() {
    if (!formValid) return
    setBusy(true)
    setError(null)
    const body: Record<string, unknown> = {
      name: name.trim(),
      base_cost: baseCostNum,
      brand_id: brandId,
      category_id: categoryId,
      decoration_eligible: decorationEligible,
    }
    if (decorationEligible && decorationPrice !== '') {
      body.decoration_price = Number(decorationPrice)
    }
    if (imageUrl.trim()) body.image_url = imageUrl.trim()

    const r = await fetch(`/api/catalogues/${catalogueId}/items/b2b-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Create failed')
      setBusy(false)
      return
    }
    setBusy(false)
    await onAdded()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Create B2B-only item</h2>
        <p className="mt-1 text-sm text-gray-500">
          Creates a new product flagged <code>is_b2b_only</code> and adds it to this catalogue.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Base cost
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              min={0}
              value={baseCost}
              onChange={(e) => setBaseCost(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Category
            <select
              className="mt-1 w-full rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— Select —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Brand
            <select
              className="mt-1 w-full rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">— Select —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={decorationEligible}
              onChange={(e) => setDecorationEligible(e.target.checked)}
            />
            Decoration eligible
          </label>

          {decorationEligible && (
            <label className="block text-sm">
              Decoration price
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                min={0}
                value={decorationPrice}
                onChange={(e) => setDecorationPrice(e.target.value)}
              />
            </label>
          )}

          <label className="block text-sm">
            Image URL (optional)
            <Input
              className="mt-1"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
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
            disabled={busy || !formValid}
          >
            {busy ? 'Creating…' : 'Create item'}
          </Button>
        </div>
      </div>
    </div>
  )
}
