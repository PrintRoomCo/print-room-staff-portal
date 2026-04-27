import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()
  const patch: Record<string, unknown> = {}
  for (const k of ['min_quantity', 'max_quantity', 'unit_price']) if (k in body) patch[k] = body[k]
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .update(patch)
    .eq('id', tierId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; tierId: string }> },
) {
  const { tierId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin
    .from('b2b_catalogue_item_pricing_tiers')
    .delete()
    .eq('id', tierId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
