import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const { data: item } = await admin
    .from('b2b_catalogue_items')
    .select('source_product_id')
    .eq('id', itemId)
    .single()
  if (!item) return NextResponse.json({ error: 'item not found' }, { status: 404 })

  const { data: masterTiers, error: mErr } = await admin
    .from('product_pricing_tiers')
    .select('min_quantity, max_quantity, unit_price')
    .eq('product_id', item.source_product_id)
    .eq('is_active', true)
    .order('min_quantity')
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  await admin.from('b2b_catalogue_item_pricing_tiers').delete().eq('catalogue_item_id', itemId)

  if (masterTiers?.length) {
    const rows = masterTiers.map((t) => ({
      catalogue_item_id: itemId,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity,
      unit_price: t.unit_price,
    }))
    const { error: iErr } = await admin
      .from('b2b_catalogue_item_pricing_tiers')
      .insert(rows)
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  return NextResponse.json({ replaced: masterTiers?.length ?? 0 })
}
