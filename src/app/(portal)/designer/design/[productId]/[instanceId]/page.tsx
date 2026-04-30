import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Phase 2 placeholder. The full Fabric.js canvas + DesignProvider stack lands in
// Phase 3 (Tasks 3.2 / 3.8 / 3.10 of the implementation plan). Until then this
// page exists so the AddProductModal redirect from `/designer/catalog` lands
// somewhere meaningful instead of a 404, and so the URL pattern is exercised
// end-to-end during the Phase 2 demo gate.

interface ProductSummary {
  id: string
  name: string
  brand_name: string | null
  category_name: string | null
  decoration_eligible: boolean | null
}

interface ProductRow {
  id: string
  name: string
  decoration_eligible: boolean | null
  brand: { name: string | null } | { name: string | null }[] | null
  category: { name: string | null } | { name: string | null }[] | null
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

async function loadProduct(productId: string): Promise<ProductSummary | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('products')
    .select(`id, name, decoration_eligible, brand:brands(name), category:categories(name)`)
    .eq('id', productId)
    .single()
  if (error || !data) return null
  const row = data as unknown as ProductRow
  return {
    id: row.id,
    name: row.name,
    brand_name: pickOne(row.brand)?.name ?? null,
    category_name: pickOne(row.category)?.name ?? null,
    decoration_eligible: row.decoration_eligible,
  }
}

export default async function DesignerDesignPage({
  params,
}: {
  params: Promise<{ productId: string; instanceId: string }>
}) {
  const { productId, instanceId } = await params
  const product = await loadProduct(productId)

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        href="/designer/catalog"
        className="text-sm text-pr-blue hover:underline"
      >
        ← Back to catalog
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Designer · Design canvas</h1>
      <p className="mt-1 text-sm text-gray-500">
        Phase 2 placeholder. The Fabric.js canvas + Design context provider stack lands in Phase 3.
      </p>

      <div className="mt-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div>
          <span className="font-medium text-gray-700">Product:</span>{' '}
          {product ? (
            <span className="text-gray-900">{product.name}</span>
          ) : (
            <span className="text-red-600">Not found ({productId})</span>
          )}
        </div>
        {product && (
          <>
            <div>
              <span className="font-medium text-gray-700">Brand:</span>{' '}
              <span className="text-gray-900">{product.brand_name ?? '—'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>{' '}
              <span className="text-gray-900">{product.category_name ?? '—'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Decoration eligible:</span>{' '}
              <span className="text-gray-900">{product.decoration_eligible ? 'yes' : 'no'}</span>
            </div>
          </>
        )}
        <div>
          <span className="font-medium text-gray-700">Instance id:</span>{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">{instanceId}</code>
        </div>
      </div>
    </div>
  )
}
