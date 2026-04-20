import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, tierId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { min_quantity?: number; max_quantity?: number | null; unit_price?: number; currency?: string; is_active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if (body.min_quantity !== undefined) {
    const minQ = Number(body.min_quantity)
    if (!Number.isFinite(minQ) || minQ < 1) {
      return NextResponse.json({ error: 'min_quantity must be a positive integer.' }, { status: 400 })
    }
    update.min_quantity = minQ
  }
  if (body.max_quantity !== undefined) {
    if (body.max_quantity === null) update.max_quantity = null
    else {
      const maxQ = Number(body.max_quantity)
      if (!Number.isFinite(maxQ) || maxQ < 1) {
        return NextResponse.json({ error: 'max_quantity must be a positive integer or null.' }, { status: 400 })
      }
      update.max_quantity = maxQ
    }
  }
  if (body.unit_price !== undefined) {
    const price = Number(body.unit_price)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'unit_price must be non-negative.' }, { status: 400 })
    }
    update.unit_price = price
  }
  if (body.currency !== undefined) update.currency = String(body.currency).trim() || 'NZD'
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .update(update)
    .eq('id', tierId)
    .eq('product_id', id)
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to update tier.')
  return NextResponse.json({ tier: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id, tierId } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { error } = await access.admin
    .from('product_pricing_tiers')
    .delete()
    .eq('id', tierId)
    .eq('product_id', id)
  if (error) return dbErrorResponse(error, 'Failed to delete tier.')
  return NextResponse.json({ ok: true })
}
