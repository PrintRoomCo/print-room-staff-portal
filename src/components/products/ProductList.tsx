'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ProductFilters } from './ProductFilters'
import { ProductRow } from './ProductRow'
import {
  PRODUCTS_PER_PAGE,
  defaultListFilters,
  listFiltersToSearchParams,
  parseListSearchParams,
} from '@/lib/products/query'
import type {
  BrandRef,
  CategoryRef,
  ProductListFilters,
  ProductListResponse,
  ProductSummary,
} from '@/types/products'

interface Props {
  initial: ProductListResponse
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductList({ initial, brands, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<ProductListFilters>(() =>
    parseListSearchParams(searchParams)
  )
  const [products, setProducts] = useState<ProductSummary[]>(initial.products)
  const [total, setTotal] = useState<number>(initial.total)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE)),
    [total]
  )

  const fetchPage = useCallback(async (next: ProductListFilters) => {
    setLoading(true)
    try {
      const sp = listFiltersToSearchParams(next).toString()
      const res = await fetch(`/api/products${sp ? `?${sp}` : ''}`)
      if (!res.ok) throw new Error('Failed to load products.')
      const json = (await res.json()) as ProductListResponse
      setProducts(json.products)
      setTotal(json.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const next = parseListSearchParams(searchParams)
    setFilters(next)
    void fetchPage(next)
  }, [searchParams, fetchPage])

  function applyFilters(next: ProductListFilters) {
    setFilters(next)
    const sp = listFiltersToSearchParams(next).toString()
    startTransition(() => {
      router.replace(`/products${sp ? `?${sp}` : ''}`, { scroll: false })
    })
    void fetchPage(next)
  }

  function goToPage(page: number) {
    applyFilters({ ...filters, page })
  }

  async function handleToggleActive(id: string, next: boolean) {
    const res = await fetch(`/api/products/${id}/toggle-active`, { method: 'POST' })
    if (!res.ok) {
      window.alert('Failed to toggle active status.')
      return
    }
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, is_active: next } : p))
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-gray-500">{total} matching</p>
        </div>
        <Link href="/products/new">
          <Button variant="accent">New product</Button>
        </Link>
      </div>

      <ProductFilters
        filters={filters}
        brands={brands}
        categories={categories}
        onChange={applyFilters}
        onClear={() => applyFilters(defaultListFilters())}
      />

      {loading && <p className="text-xs text-gray-500">Loading...</p>}

      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No products match these filters.{' '}
          <button
            type="button"
            onClick={() => applyFilters(defaultListFilters())}
            className="text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <ProductRow key={p.id} product={p} onToggleActive={handleToggleActive} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => goToPage(filters.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => goToPage(filters.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
