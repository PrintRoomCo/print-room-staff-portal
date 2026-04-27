import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .select('*')
    .eq('catalogue_item_id', itemId)
    .order('min_quantity')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()
  if (typeof body.min_quantity !== 'number' || typeof body.unit_price !== 'number') {
    return NextResponse.json({ error: 'min_quantity and unit_price required' }, { status: 400 })
  }
  const { data, error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .insert({
      catalogue_item_id: itemId,
      min_quantity: body.min_quantity,
      max_quantity: body.max_quantity ?? null,
      unit_price: body.unit_price,
    })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
