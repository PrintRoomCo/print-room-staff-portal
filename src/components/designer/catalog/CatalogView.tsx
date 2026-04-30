import { getSupabaseAdmin } from '@/lib/supabase-server'
import { AddProductTile } from './AddProductTile'
import { ProductCard } from './ProductCard'

interface ProductRow {
  id: string
  name: string
  brand: { name: string | null } | { name: string | null }[] | null
  primary_image: { file_url: string | null } | { file_url: string | null }[] | null
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// Catalog visibility per spec §9.2 lock: decoration_eligible=true AND a front-view
// image exists. We pre-collect product_ids that have a front view image, then scope
// the products query against that set. Two roundtrips, but no PostgREST `EXISTS`
// awkwardness and easy to reason about.
async function loadDesignerCatalog() {
  const admin = getSupabaseAdmin()

  const { data: frontImageRows } = await admin
    .from('product_images')
    .select('product_id')
    .eq('view_lower', 'front')

  const productIdsWithFrontImage = Array.from(
    new Set((frontImageRows ?? []).map((r) => r.product_id as string)),
  )

  if (productIdsWithFrontImage.length === 0) {
    return [] as Array<{ id: string; name: string; brand: string | null; imageUrl: string | null }>
  }

  const { data: products, error } = await admin
    .from('products')
    .select(
      `
      id,
      name,
      brand:brands(name),
      primary_image:product_images!inner(file_url)
    `,
    )
    .eq('decoration_eligible', true)
    .eq('is_active', true)
    .in('id', productIdsWithFrontImage)
    .eq('product_images.view_lower', 'front')
    .order('name')

  if (error) {
    console.error('[designer/catalog] load error:', error)
    return []
  }

  const rows = (products ?? []) as unknown as ProductRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: pickOne(row.brand)?.name ?? null,
    imageUrl: pickOne(row.primary_image)?.file_url ?? null,
  }))
}

export async function CatalogView() {
  const products = await loadDesignerCatalog()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Designer · Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            {products.length === 0
              ? 'No products yet. Add one to start designing.'
              : `${products.length} product${products.length === 1 ? '' : 's'} ready to design.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <AddProductTile />
        {products.map((p) => (
          <ProductCard
            key={p.id}
            productId={p.id}
            name={p.name}
            brandName={p.brand}
            imageUrl={p.imageUrl}
          />
        ))}
      </div>
    </div>
  )
}
