'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShopifyLiveBadge } from './ShopifyLiveBadge'
import { ChannelsCell } from './ChannelsCell'
import type { ProductSummary } from '@/types/products'

interface Props {
  product: ProductSummary
  onToggleActive: (id: string, next: boolean) => Promise<void>
}

export function ProductRow({ product, onToggleActive }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleToggle() {
    setBusy(true)
    try {
      await onToggleActive(product.id, !product.is_active)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <span className="text-gray-300 text-xs">No image</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/products/${product.id}`}
            className="text-sm font-semibold text-foreground hover:underline truncate"
          >
            {product.name}
          </Link>
          <ShopifyLiveBadge shopifyId={product.shopify_product_id} />
          {!product.is_active && <Badge variant="gray">Inactive</Badge>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-4">
          {product.sku && <span>SKU: {product.sku}</span>}
          {product.brand?.name && <span>{product.brand.name}</span>}
          {product.category?.name && <span>{product.category.name}</span>}
          {product.garment_family && <span>{product.garment_family}</span>}
        </div>
      </div>

      <div className="min-w-[12rem] max-w-[16rem]">
        <ChannelsCell channels={product.channels} />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant={product.is_active ? 'secondary' : 'accent'}
          size="sm"
          onClick={handleToggle}
          disabled={busy}
        >
          {product.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Link href={`/products/${product.id}`}>
          <Button type="button" variant="outline" size="sm">
            Edit
          </Button>
        </Link>
      </div>
    </div>
  )
}
