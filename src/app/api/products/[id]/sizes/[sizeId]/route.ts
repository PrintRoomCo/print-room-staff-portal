import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sizeId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, sizeId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const sizeIdInt = parseInt(sizeId, 10)
  if (!Number.isFinite(sizeIdInt)) {
    return NextResponse.json({ error: 'Invalid size id.' }, { status: 400 })
  }

  const { error } = await access.admin
    .from('sizes')
    .delete()
    .eq('id', sizeIdInt)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete size.')
  return NextResponse.json({ ok: true })
}
