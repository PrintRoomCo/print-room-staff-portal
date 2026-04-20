'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TagCheckboxGroup } from '../TagCheckboxGroup'
import { GARMENT_FAMILIES } from '@/lib/products/garment-families'
import { PRODUCT_TYPE_TAGS, type ProductTypeTag } from '@/lib/products/tags'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

interface Props {
  product: ProductDetail
  brands: BrandRef[]
  categories: CategoryRef[]
  onSave: (patch: Record<string, unknown>) => Promise<void>
  onDelete: () => Promise<void>
  saving: boolean
  errors: Record<string, string>
}

function readTypeTags(tags: string[]): ProductTypeTag[] {
  return tags.filter((t): t is ProductTypeTag =>
    (PRODUCT_TYPE_TAGS as readonly string[]).includes(t)
  )
}

export function DetailsTab({
  product,
  brands,
  categories,
  onSave,
  onDelete,
  saving,
  errors,
}: Props) {
  const [form, setForm] = useState({
    name: product.name ?? '',
    sku: product.sku ?? '',
    supplier_code: product.supplier_code ?? '',
    code: product.code ?? '',
    description: product.description ?? '',
    brand_id: product.brand_id ?? '',
    category_id: product.category_id ?? '',
    garment_family: product.garment_family ?? '',
    industry: (product.industry || []).join(', '),
    default_sizes: (product.default_sizes || []).join(', '),
    base_cost: product.base_cost == null ? '' : String(product.base_cost),
    markup_pct: String(product.markup_pct ?? 0),
    decoration_eligible: !!product.decoration_eligible,
    decoration_price: String(product.decoration_price ?? 0),
    specs: product.specs ? JSON.stringify(product.specs, null, 2) : '',
    safety_standard: product.safety_standard ?? '',
    moq: String(product.moq ?? 24),
    lead_time_days: String(product.lead_time_days ?? 14),
    sizing_type: product.sizing_type ?? 'multi_size',
    supports_labels: !!product.supports_labels,
    is_hero: !!product.is_hero,
    is_active: !!product.is_active,
    type_tags: readTypeTags(product.tags || []),
  })

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      ...form,
      tags: form.type_tags,
    })
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    await onDelete()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name *" error={errors.name}>
            <Input value={form.name} onChange={e => patch('name', e.target.value)} required />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={e => patch('sku', e.target.value)} />
          </Field>
          <Field label="Supplier code">
            <Input
              value={form.supplier_code}
              onChange={e => patch('supplier_code', e.target.value)}
            />
          </Field>
          <Field label="Internal code">
            <Input value={form.code} onChange={e => patch('code', e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={e => patch('description', e.target.value)}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Classification</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Brand *" error={errors.brand_id}>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.brand_id}
              onChange={e => patch('brand_id', e.target.value)}
              required
            >
              <option value="">Select brand...</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category *" error={errors.category_id}>
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.category_id}
              onChange={e => patch('category_id', e.target.value)}
              required
            >
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Garment family">
            <select
              className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
              value={form.garment_family}
              onChange={e => patch('garment_family', e.target.value)}
            >
              <option value="">—</option>
              {GARMENT_FAMILIES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Industry (comma-separated)">
            <Input
              value={form.industry}
              onChange={e => patch('industry', e.target.value)}
              placeholder="trades, healthcare, ..."
            />
          </Field>
        </div>
        <TagCheckboxGroup
          legend="Product type"
          value={form.type_tags}
          onChange={tags => patch('type_tags', tags)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Pricing & costs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Base cost (NZD)">
            <Input
              type="number"
              step="0.01"
              value={form.base_cost}
              onChange={e => patch('base_cost', e.target.value)}
            />
          </Field>
          <Field label="Markup %">
            <Input
              type="number"
              step="0.01"
              value={form.markup_pct}
              onChange={e => patch('markup_pct', e.target.value)}
            />
          </Field>
          <Field label="Decoration price">
            <Input
              type="number"
              step="0.01"
              value={form.decoration_price}
              onChange={e => patch('decoration_price', e.target.value)}
            />
          </Field>
          <Field label=" ">
            <label className="inline-flex items-center gap-2 text-sm h-10">
              <input
                type="checkbox"
                checked={form.decoration_eligible}
                onChange={e => patch('decoration_eligible', e.target.checked)}
              />
              Decoration eligible
            </label>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Specs & ops</h2>
        <Field label="Specs (JSON)" error={errors.specs}>
          <Textarea
            value={form.specs}
            onChange={e => patch('specs', e.target.value)}
            placeholder='{"weight_gsm": 200}'
            className="font-mono text-xs"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Safety standard">
            <Input
              value={form.safety_standard}
              onChange={e => patch('safety_standard', e.target.value)}
            />
          </Field>
          <Field label="MOQ">
            <Input
              type="number"
              value={form.moq}
              onChange={e => patch('moq', e.target.value)}
            />
          </Field>
          <Field label="Lead time (days)">
            <Input
              type="number"
              value={form.lead_time_days}
              onChange={e => patch('lead_time_days', e.target.value)}
            />
          </Field>
          <Field label="Sizing type">
            <Input
              value={form.sizing_type}
              onChange={e => patch('sizing_type', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Default sizes (comma-separated)">
          <Input
            value={form.default_sizes}
            onChange={e => patch('default_sizes', e.target.value)}
            placeholder="S, M, L, XL"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Flags</h2>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.supports_labels}
              onChange={e => patch('supports_labels', e.target.checked)}
            />
            Supports labels
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_hero}
              onChange={e => patch('is_hero', e.target.checked)}
            />
            Hero product
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => patch('is_active', e.target.checked)}
            />
            Active
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-1 text-xs text-gray-500">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Read-only</h2>
        <p>
          Shopify:{' '}
          {product.shopify_product_id ? (
            <span className="font-mono">{product.shopify_product_id}</span>
          ) : (
            'Not synced'
          )}
        </p>
        <p>Platform: {product.platform}</p>
        <p>
          Created {product.created_at || '—'} · Updated {product.updated_at}
        </p>
      </section>

      {errors._root && <p className="text-sm text-red-600">{errors._root}</p>}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
          Delete product
        </Button>
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? 'Saving...' : 'Save details'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
