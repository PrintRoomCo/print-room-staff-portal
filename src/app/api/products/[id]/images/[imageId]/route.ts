import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const ALLOWED_VIEWS = ['front', 'back', 'side', 'detail'] as const
type View = (typeof ALLOWED_VIEWS)[number]

function isView(v: unknown): v is View {
  return typeof v === 'string' && (ALLOWED_VIEWS as readonly string[]).includes(v)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, imageId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { view?: string; alt_text?: string | null; position?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (body.view !== undefined) update.view = isView(body.view) ? body.view : null
  if (body.alt_text !== undefined) update.alt_text = body.alt_text ? String(body.alt_text).trim() || null : null
  if (typeof body.position === 'number') update.position = body.position

  const { data, error } = await access.admin
    .from('product_images')
    .update(update)
    .eq('id', imageId)
    .eq('product_id', id)
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to update image.')
  return NextResponse.json({ image: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, imageId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_images')
    .delete()
    .eq('id', imageId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete image.')
  return NextResponse.json({ ok: true })
}
