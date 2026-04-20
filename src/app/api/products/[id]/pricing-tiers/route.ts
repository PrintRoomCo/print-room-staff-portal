import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .select('*')
    .eq('product_id', id)
    .order('min_quantity')
  if (error) return dbErrorResponse(error, 'Failed to load pricing tiers.')
  return NextResponse.json({ tiers: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { min_quantity?: number; max_quantity?: number | null; unit_price?: number; currency?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const minQ = Number(body.min_quantity)
  const maxQ = body.max_quantity == null ? null : Number(body.max_quantity)
  const price = Number(body.unit_price)
  const currency = (body.currency || 'NZD').trim() || 'NZD'

  if (!Number.isFinite(minQ) || minQ < 1) {
    return NextResponse.json({ error: 'min_quantity must be a positive integer.' }, { status: 400 })
  }
  if (maxQ != null && (!Number.isFinite(maxQ) || maxQ < minQ)) {
    return NextResponse.json({ error: 'max_quantity must be >= min_quantity (or null).' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'unit_price must be a non-negative number.' }, { status: 400 })
  }

  const { data, error } = await access.admin
    .from('product_pricing_tiers')
    .insert({
      product_id: id,
      min_quantity: minQ,
      max_quantity: maxQ,
      unit_price: price,
      currency,
      tier_level: 1,
      is_active: true,
    })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add pricing tier.')
  return NextResponse.json({ tier: data }, { status: 201 })
}
