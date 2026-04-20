import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  const { data, error } = await auth.admin.rpc('inventory_products_summary', { p_org_id: orgId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    products: (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      variantCount: Number(r.variant_count),
      totalStock: Number(r.total_stock),
      totalCommitted: Number(r.total_committed),
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  let body: { product_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 })
  }

  const productId = body.product_id
  const [{ data: swatches }, { data: sizes }] = await Promise.all([
    auth.admin
      .from('product_color_swatches')
      .select('id')
      .eq('product_id', productId)
      .eq('is_active', true),
    auth.admin.from('sizes').select('id').eq('product_id', productId),
  ])
  if (!swatches?.length || !sizes?.length) {
    return NextResponse.json(
      { error: 'Product has no active swatches or no sizes' },
      { status: 409 }
    )
  }

  const variantRows = swatches.flatMap((s) =>
    sizes.map((z) => ({
      product_id: productId,
      color_swatch_id: s.id,
      size_id: z.id,
    }))
  )
  const upsertV = await auth.admin
    .from('product_variants')
    .upsert(variantRows, {
      onConflict: 'product_id,color_swatch_id,size_id',
      ignoreDuplicates: true,
    })
  if (upsertV.error) {
    return NextResponse.json({ error: upsertV.error.message }, { status: 500 })
  }

  const { data: allVariants } = await auth.admin
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  const invRows = (allVariants ?? []).map((v) => ({
    variant_id: v.id,
    organization_id: orgId,
  }))
  const upsertI = await auth.admin
    .from('variant_inventory')
    .upsert(invRows, {
      onConflict: 'variant_id,organization_id',
      ignoreDuplicates: true,
    })
  if (upsertI.error) {
    return NextResponse.json({ error: upsertI.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
