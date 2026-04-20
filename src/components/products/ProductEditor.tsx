'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TabNav, type TabDef } from './TabNav'
import { DetailsTab } from './tabs/DetailsTab'
import { SwatchesTab } from './tabs/SwatchesTab'
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

export function ProductEditor(props: Props) {
  const router = useRouter()
  const [active, setActive] = useState<string>('details')
  const [product, setProduct] = useState<ProductDetail>(props.product)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({})

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

  async function saveDetails(patch: Record<string, unknown>) {
    setSavingDetails(true)
    setDetailsErrors({})
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) {
        setDetailsErrors(json.errors || { _root: json.error || 'Failed to save.' })
        return
      }
      setProduct(json.product as ProductDetail)
    } finally {
      setSavingDetails(false)
    }
  }

  async function deleteProduct() {
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    if (!res.ok) {
      window.alert('Failed to delete.')
      return
    }
    router.push('/products')
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
      </div>

      <TabNav tabs={TABS} active={active} onChange={changeTab} />

      <div>
        {active === 'details' && (
          <DetailsTab
            product={product}
            brands={props.brands}
            categories={props.categories}
            onSave={saveDetails}
            onDelete={deleteProduct}
            saving={savingDetails}
            errors={detailsErrors}
          />
        )}
        {active === 'swatches' && <SwatchesTab productId={product.id} />}
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
