import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

interface ProductRow {
  id: string
  name: string
  image_url: string | null
}

interface CatalogueItemRow {
  source_product_id: string | null
  products: ProductRow | ProductRow[] | null
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export async function GET(request: Request) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const organizationId = url.searchParams.get('organization_id')
  if (q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  // Catalogue branch: if org has an active catalogue, fetch its items first.
  let catalogueProducts: Array<ProductRow & { via_catalogue: true }> = []
  if (organizationId) {
    const { data: cat } = await auth.admin
      .from('b2b_catalogues')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cat?.id) {
      const { data: items } = await auth.admin
        .from('b2b_catalogue_items')
        .select(
          'source_product_id, products!source_product_id ( id, name, image_url )',
        )
        .eq('catalogue_id', cat.id)
        .eq('is_active', true)

      const rows = (items ?? []) as unknown as CatalogueItemRow[]
      catalogueProducts = rows
        .map((r) => pickOne(r.products))
        .filter(
          (p): p is ProductRow =>
            p != null && p.name.toLowerCase().includes(q.toLowerCase()),
        )
        .map((p) => ({ ...p, via_catalogue: true as const }))
    }
  }

  // Global branch: products that are NOT b2b-only.
  const { data: globals, error } = await auth.admin
    .from('products')
    .select('id, name, image_url')
    .eq('is_active', true)
    .eq('is_b2b_only', false)
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .limit(20)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Dedupe: catalogue items take precedence (they carry via_catalogue flag).
  const seen = new Set(catalogueProducts.map((p) => p.id))
  const globalDecorated = (globals ?? [])
    .filter((p) => !seen.has(p.id))
    .map((p) => ({ ...p, via_catalogue: false as const }))

  const combined = [...catalogueProducts, ...globalDecorated]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20)

  return NextResponse.json({ products: combined })
}
