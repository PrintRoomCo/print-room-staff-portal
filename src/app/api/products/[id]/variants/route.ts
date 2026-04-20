import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { id: productId } = await params
  const { data, error } = await auth.admin
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { id: productId } = await params
  let body: { color_swatch_id?: string | null; size_id?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('product_variants')
    .upsert(
      {
        product_id: productId,
        color_swatch_id: body.color_swatch_id ?? null,
        size_id: body.size_id ?? null,
      },
      { onConflict: 'product_id,color_swatch_id,size_id' }
    )
    .select('id')
    .single()
  if (error) {
    const status = error.message?.includes('belongs to product') ? 400 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ id: data.id })
}
