import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { AddFromMasterBody } from '@/types/catalogues'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_items')
    .select('*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)')
    .eq('catalogue_id', id)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = (await request.json()) as AddFromMasterBody
  if (!body.source_product_id) {
    return NextResponse.json({ error: 'source_product_id required' }, { status: 400 })
  }

  const { data: item, error: iErr } = await admin
    .from('b2b_catalogue_items')
    .insert({ catalogue_id: id, source_product_id: body.source_product_id })
    .select('id')
    .single()
  if (iErr || !item) return NextResponse.json({ error: iErr?.message ?? 'insert failed' }, { status: 500 })

  const { data: masterTiers } = await admin
    .from('product_pricing_tiers')
    .select('min_quantity, max_quantity, unit_price')
    .eq('product_id', body.source_product_id)
    .eq('is_active', true)
    .order('min_quantity')

  if (masterTiers?.length) {
    const tierRows = masterTiers.map((t) => ({
      catalogue_item_id: item.id,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity,
      unit_price: t.unit_price,
    }))
    const { error: tErr } = await admin
      .from('b2b_catalogue_item_pricing_tiers')
      .insert(tierRows)
    if (tErr) {
      await admin.from('b2b_catalogue_items').delete().eq('id', item.id)
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: item.id }, { status: 201 })
}
