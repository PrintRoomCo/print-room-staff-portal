import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { CreateB2BOnlyItemBody } from '@/types/catalogues'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = (await request.json()) as CreateB2BOnlyItemBody

  if (!body.name?.trim() || typeof body.base_cost !== 'number') {
    return NextResponse.json(
      { error: 'name and base_cost required' },
      { status: 400 },
    )
  }

  // products.brand_id and products.category_id are NOT NULL with no DB default;
  // we cannot fabricate UUIDs, so require them on the request body.
  if (!body.brand_id || !body.category_id) {
    return NextResponse.json(
      { error: 'brand_id and category_id required (products NOT-NULL columns with no default)' },
      { status: 400 },
    )
  }

  const { data: prod, error: pErr } = await admin
    .from('products')
    .insert({
      name: body.name.trim(),
      base_cost: body.base_cost,
      markup_multiplier: 1.0,
      decoration_eligible: body.decoration_eligible ?? false,
      decoration_price: body.decoration_price ?? null,
      image_url: body.image_url ?? null,
      category_id: body.category_id,
      brand_id: body.brand_id,
      is_b2b_only: true,
      is_active: true,
      platform: 'uniforms',
    })
    .select('id')
    .single()
  if (pErr || !prod) {
    return NextResponse.json({ error: pErr?.message ?? 'product insert failed' }, { status: 500 })
  }

  const { data: item, error: iErr } = await admin
    .from('b2b_catalogue_items')
    .insert({ catalogue_id: id, source_product_id: prod.id })
    .select('id')
    .single()
  if (iErr || !item) {
    await admin.from('products').delete().eq('id', prod.id)
    return NextResponse.json({ error: iErr?.message ?? 'item insert failed' }, { status: 500 })
  }

  return NextResponse.json({ catalogue_item_id: item.id, product_id: prod.id }, { status: 201 })
}
