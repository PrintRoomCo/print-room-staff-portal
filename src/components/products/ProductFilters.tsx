'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GARMENT_FAMILIES, type GarmentFamily } from '@/lib/products/garment-families'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ShopifyLiveFilter,
  ActiveFilter,
} from '@/types/products'
import { TagCheckboxGroup } from './TagCheckboxGroup'

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
        <TagCheckboxGroup
          value={filters.type_tags}
          onChange={tags => patch({ type_tags: tags })}
        />

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

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  )
}
