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
    .from('sizes')
    .select('*')
    .eq('product_id', id)
    .order('order_index')
  if (error) return dbErrorResponse(error, 'Failed to load sizes.')
  return NextResponse.json({ sizes: data || [] })
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

  let body: { label?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const label = (body.label || '').trim() || 'One Size'

  const { data: maxRow } = await access.admin
    .from('sizes')
    .select('order_index')
    .eq('product_id', id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIdx = maxRow && maxRow.length > 0 ? (maxRow[0].order_index || 0) + 1 : 1

  const { data, error } = await access.admin
    .from('sizes')
    .insert({ product_id: id, label, order_index: nextIdx })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add size.')
  return NextResponse.json({ size: data }, { status: 201 })
}
