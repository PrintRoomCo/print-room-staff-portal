import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  const [cat, items] = await Promise.all([
    admin.from('b2b_catalogues').select('*').eq('id', id).single(),
    admin
      .from('b2b_catalogue_items')
      .select('*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)')
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])
  if (cat.error || !cat.data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ catalogue: cat.data, items: items.data ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['name', 'description', 'is_active']) {
    if (k in body) patch[k] = body[k]
  }
  const { error } = await admin.from('b2b_catalogues').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { error } = await admin.from('b2b_catalogues').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
