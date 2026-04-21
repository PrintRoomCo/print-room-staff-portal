'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MtoProduct, Product } from '@/lib/quote-builder/types'

interface ProductSelectorProps {
  products: Array<Product | MtoProduct>
  selectedProductId?: string | null
  onSelect: (product: Product | MtoProduct) => void
  label?: string
  disabled?: boolean
}

function matchesProduct(product: Product | MtoProduct, query: string) {
  const haystack = [
    product.name,
    product.brand,
    product.sku,
    product.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

export function ProductSelector({
  products,
  selectedProductId,
  onSelect,
  label = 'Product',
  disabled = false,
}: ProductSelectorProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    const selected = products.find((product) => product.id === selectedProductId)
    if (selected) {
      setQuery(`${selected.name}${selected.sku ? ` · ${selected.sku}` : ''}`)
    }
  }, [products, selectedProductId])

  const matchingProducts = deferredQuery.trim()
    ? products.filter((product) => matchesProduct(product, deferredQuery)).slice(0, 20)
    : products.slice(0, 12)

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by product, SKU, brand, or category"
          className="pl-11"
          disabled={disabled}
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-3xl border border-gray-100 bg-white">
        {matchingProducts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No products match the current search.
          </div>
        ) : (
          matchingProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex w-full items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/30"
              disabled={disabled}
              onClick={() => {
                onSelect(product)
                setQuery(`${product.name}${product.sku ? ` · ${product.sku}` : ''}`)
              }}
            >
              <div>
                <div className="font-medium text-foreground">{product.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[product.brand, product.sku, product.category].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-muted-foreground">
                {'min_qty' in product ? 'MTO' : product.sourcing_type}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
