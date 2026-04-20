import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'] as const

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data: existingSizes } = await access.admin
    .from('sizes')
    .select('label, order_index')
    .eq('product_id', id)

  const labels = new Set((existingSizes || []).map(r => r.label))
  const maxIndex = (existingSizes || []).reduce(
    (max, r) => Math.max(max, r.order_index || 0),
    0
  )

  const toAdd = STANDARD_SIZES.filter(s => !labels.has(s)).map((label, i) => ({
    product_id: id,
    label,
    order_index: maxIndex + i + 1,
  }))

  if (toAdd.length === 0) {
    const { data, error } = await access.admin
      .from('sizes')
      .select('*')
      .eq('product_id', id)
      .order('order_index')
    if (error) return dbErrorResponse(error, 'Failed to reload sizes.')
    return NextResponse.json({ sizes: data || [], added: 0 })
  }

  const { error: insertErr } = await access.admin.from('sizes').insert(toAdd)
  if (insertErr) return dbErrorResponse(insertErr, 'Failed to add sizes.')

  const { data, error } = await access.admin
    .from('sizes')
    .select('*')
    .eq('product_id', id)
    .order('order_index')
  if (error) return dbErrorResponse(error, 'Failed to reload sizes.')
  return NextResponse.json({ sizes: data || [], added: toAdd.length })
}
