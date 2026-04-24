'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VariantGrid } from '@/components/inventory/VariantGrid'
import type { InventoryOrgBundle } from '@/app/api/products/[id]/inventory-by-org/route'

interface InventoryTabProps {
  productId: string
}

export function InventoryTab({ productId }: InventoryTabProps) {
  const [orgs, setOrgs] = useState<InventoryOrgBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/products/${productId}/inventory-by-org`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? 'You need inventory:write to view per-product inventory.'
              : `Failed to load inventory (status ${res.status}).`
          )
        }
        return res.json() as Promise<{ orgs: InventoryOrgBundle[] }>
      })
      .then((data) => {
        if (cancelled) return
        setOrgs(data.orgs ?? [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load inventory.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        <p className="mb-2">No customers are tracking stock for this product yet.</p>
        <p>
          Use the{' '}
          <Link href="/inventory" className="text-blue-600 hover:underline">
            Inventory sub-app
          </Link>{' '}
          to start tracking this product for a customer.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-xs text-gray-500">
        Inventory adjustments on this page update the same data as the dedicated
        Inventory sub-app. Cross-org views and the audit log live in the{' '}
        <Link href="/inventory" className="text-blue-600 hover:underline">
          Inventory sub-app
        </Link>
        .
      </div>

      {orgs.map((bundle) => (
        <section key={bundle.org_id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {bundle.org_name}
            </h3>
            <Link
              href={`/inventory/${bundle.org_id}/${productId}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Open in Inventory sub-app →
            </Link>
          </div>
          <VariantGrid
            orgId={bundle.org_id}
            productId={productId}
            variants={bundle.variants}
          />
        </section>
      ))}
    </div>
  )
}
