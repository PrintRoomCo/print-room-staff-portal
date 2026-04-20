'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TabNav, type TabDef } from './TabNav'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

const TABS: TabDef[] = [
  { key: 'details', label: 'Details' },
  { key: 'swatches', label: 'Swatches' },
  { key: 'sizes', label: 'Sizes' },
  { key: 'images', label: 'Images' },
  { key: 'pricing', label: 'Pricing' },
]

interface Props {
  product: ProductDetail
  brands: BrandRef[]
  categories: CategoryRef[]
}

export function ProductEditor({ product, brands: _brands, categories: _categories }: Props) {
  const [active, setActive] = useState<string>('details')

  useEffect(() => {
    const fromHash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
    if (fromHash && TABS.some(t => t.key === fromHash)) setActive(fromHash)
  }, [])

  function changeTab(key: string) {
    setActive(key)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/products" className="text-xs text-gray-500 hover:underline">
            ← Back to products
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{product.name}</h1>
          <p className="text-xs text-gray-500">
            {product.is_active ? 'Active' : 'Inactive'} · platform: {product.platform}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm">
          (delete moved to Details tab)
        </Button>
      </div>

      <TabNav tabs={TABS} active={active} onChange={changeTab} />

      <div>
        {active === 'details' && (
          <p className="text-sm text-gray-500">Details form goes here (Task 15).</p>
        )}
        {active === 'swatches' && (
          <p className="text-sm text-gray-500">Swatches manager goes here (Task 17).</p>
        )}
        {active === 'sizes' && (
          <p className="text-sm text-gray-500">Sizes manager goes here (Task 18).</p>
        )}
        {active === 'images' && (
          <p className="text-sm text-gray-500">Images manager goes here (Task 19).</p>
        )}
        {active === 'pricing' && (
          <p className="text-sm text-gray-500">Pricing tiers manager goes here (Task 20).</p>
        )}
      </div>
    </div>
  )
}
