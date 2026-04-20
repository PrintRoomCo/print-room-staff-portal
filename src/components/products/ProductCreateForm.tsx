'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GARMENT_FAMILIES } from '@/lib/products/garment-families'
import type { BrandRef, CategoryRef } from '@/types/products'

interface Props {
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductCreateForm({ brands, categories }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '',
    brand_id: '',
    category_id: '',
    sku: '',
    supplier_code: '',
    garment_family: '',
    description: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrors(json.errors || { _root: json.error || 'Failed to create product.' })
        return
      }
      router.push(`/products/${json.product.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New product</h1>
      <p className="text-sm text-gray-500">
        Save the core fields first; swatches, sizes, images, and pricing tiers unlock after save.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-600">Name *</label>
        <Input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Brand *</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.brand_id}
            onChange={e => setForm({ ...form, brand_id: e.target.value })}
            required
          >
            <option value="">Select brand...</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.brand_id && <p className="text-xs text-red-600">{errors.brand_id}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Category *</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.category_id}
            onChange={e => setForm({ ...form, category_id: e.target.value })}
            required
          >
            <option value="">Select category...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category_id && <p className="text-xs text-red-600">{errors.category_id}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">SKU</label>
          <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Supplier code</label>
          <Input
            value={form.supplier_code}
            onChange={e => setForm({ ...form, supplier_code: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Garment family</label>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={form.garment_family}
            onChange={e => setForm({ ...form, garment_family: e.target.value })}
          >
            <option value="">—</option>
            {GARMENT_FAMILIES.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-600">Description</label>
        <Textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {errors._root && <p className="text-sm text-red-600">{errors._root}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={busy}>
          {busy ? 'Creating...' : 'Create product'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/products')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
