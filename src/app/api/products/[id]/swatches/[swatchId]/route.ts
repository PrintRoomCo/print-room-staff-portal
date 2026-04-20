import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; swatchId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, swatchId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { label?: string; hex?: string; image_url?: string | null; position?: number; is_active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (typeof body.label === 'string') update.label = body.label.trim() || 'Unnamed'
  if (typeof body.hex === 'string') update.hex = body.hex.trim() || '#000000'
  if (body.image_url !== undefined) update.image_url = body.image_url ? String(body.image_url).trim() || null : null
  if (typeof body.position === 'number') update.position = body.position
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await access.admin
    .from('product_color_swatches')
    .update(update)
    .eq('id', swatchId)
    .eq('product_id', id)
    .select('*')
    .single()

  if (error || !data) return dbErrorResponse(error, 'Failed to update swatch.')
  return NextResponse.json({ swatch: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; swatchId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, swatchId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_color_swatches')
    .delete()
    .eq('id', swatchId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete swatch.')
  return NextResponse.json({ ok: true })
}
