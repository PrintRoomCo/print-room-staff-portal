'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GARMENT_FAMILIES, type GarmentFamily } from '@/lib/products/garment-families'
import { CHANNELS, CHANNEL_LABELS, type Channel } from '@/types/products'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ShopifyLiveFilter,
  ActiveFilter,
} from '@/types/products'

interface Props {
  filters: ProductListFilters
  brands: BrandRef[]
  categories: CategoryRef[]
  onChange: (next: ProductListFilters) => void
  onClear: () => void
}

export function ProductFilters({ filters, brands, categories, onChange, onClear }: Props) {
  function patch(part: Partial<ProductListFilters>) {
    onChange({ ...filters, ...part, page: 1 })
  }

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input
          placeholder="Search by name..."
          value={filters.search}
          onChange={e => patch({ search: e.target.value })}
        />

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.brand_id ?? ''}
          onChange={e => patch({ brand_id: e.target.value || null })}
        >
          <option value="">All brands</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.category_id ?? ''}
          onChange={e => patch({ category_id: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
          value={filters.garment_family ?? ''}
          onChange={e =>
            patch({ garment_family: (e.target.value || null) as GarmentFamily | null })
          }
        >
          <option value="">All garment families</option>
          {GARMENT_FAMILIES.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Channel</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.channel ?? ''}
            onChange={e => patch({ channel: (e.target.value || null) as Channel | null })}
          >
            <option value="">All channels</option>
            {CHANNELS.map(c => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Live on Shopify</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.shopify}
            onChange={e => patch({ shopify: e.target.value as ShopifyLiveFilter })}
          >
            <option value="all">All</option>
            <option value="live">Yes</option>
            <option value="not-live">No</option>
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-gray-600">Status</legend>
          <select
            className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
            value={filters.active}
            onChange={e => patch({ active: e.target.value as ActiveFilter })}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </fieldset>
      </div>

      <TagFilterCombobox
        value={filters.tags_filter}
        onChange={tags_filter => patch({ tags_filter })}
      />

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  )
}

function TagFilterCombobox({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = draft.trim().toLowerCase()
    let cancelled = false
    const run = async () => {
      const url = q.length > 0
        ? `/api/products/tags?q=${encodeURIComponent(q)}`
        : '/api/products/tags'
      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json()
      if (cancelled) return
      const names = Array.isArray(json.tags) ? (json.tags as string[]) : []
      setSuggestions(names.filter(n => !value.includes(n)).slice(0, 8))
    }
    void run()
    return () => { cancelled = true }
  }, [draft, value])

  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function add(name: string) {
    if (value.includes(name)) return
    onChange([...value, name])
    setDraft('')
  }

  function remove(name: string) {
    onChange(value.filter(t => t !== name))
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-gray-600">Tags (all must match)</legend>
      <div ref={wrapRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={e => { setDraft(e.target.value); setOpen(true) }}
            placeholder={value.length === 0 ? 'Filter by tag' : ''}
            className="flex-1 min-w-[8rem] bg-transparent border-0 px-1 py-0 text-sm focus:outline-none focus:ring-0"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  )
}
