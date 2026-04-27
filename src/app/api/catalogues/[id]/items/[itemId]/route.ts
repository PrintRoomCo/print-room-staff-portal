import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

const PATCHABLE = [
  'markup_multiplier_override',
  'decoration_type_override',
  'decoration_price_override',
  'shipping_cost_override',
  'metafields',
  'is_active',
  'sort_order',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of PATCHABLE) if (k in body) patch[k] = body[k]

  const { error } = await admin.from('b2b_catalogue_items').update(patch).eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin.from('b2b_catalogue_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
