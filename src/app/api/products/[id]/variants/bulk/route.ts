import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const { id: productId } = await params
  let body: { organization_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const orgId = body.organization_id
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const [{ data: swatches }, { data: sizes }] = await Promise.all([
    admin
      .from('product_color_swatches')
      .select('id')
      .eq('product_id', productId)
      .eq('is_active', true),
    admin.from('sizes').select('id').eq('product_id', productId),
  ])
  if (!swatches?.length || !sizes?.length) {
    return NextResponse.json(
      { error: 'Product has no active swatches or no sizes — cannot expand' },
      { status: 409 }
    )
  }

  const rows = swatches.flatMap((s) =>
    sizes.map((z) => ({
      product_id: productId,
      color_swatch_id: s.id,
      size_id: z.id,
    }))
  )
  const { data: variants, error: vErr } = await admin
    .from('product_variants')
    .upsert(rows, {
      onConflict: 'product_id,color_swatch_id,size_id',
      ignoreDuplicates: true,
    })
    .select('id')
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // Fetch the full variant set (upsert with ignoreDuplicates returns only inserted rows).
  const { data: allVariants, error: listErr } = await admin
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const invRows = (allVariants ?? []).map((v) => ({
    variant_id: v.id,
    organization_id: orgId,
    stock_qty: 0,
    committed_qty: 0,
  }))
  const { data: inv, error: invErr } = await admin
    .from('variant_inventory')
    .upsert(invRows, {
      onConflict: 'variant_id,organization_id',
      ignoreDuplicates: true,
    })
    .select('id')
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({
    variantsCreated: variants?.length ?? 0,
    inventoryRowsCreated: inv?.length ?? 0,
  })
}
