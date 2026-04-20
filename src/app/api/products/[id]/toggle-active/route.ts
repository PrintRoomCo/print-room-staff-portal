import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data: row, error: readErr } = await withUniformsScope(
    access.admin.from('products').select('is_active').eq('id', id)
  ).single()
  if (readErr || !row) return dbErrorResponse(readErr, 'Product not found', 404)

  const next = !row.is_active
  const { error } = await withUniformsScope(
    access.admin
      .from('products')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', id)
  )
  if (error) return dbErrorResponse(error, 'Failed to toggle active status.')

  return NextResponse.json({ is_active: next })
}
