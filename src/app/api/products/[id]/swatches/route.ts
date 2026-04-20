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
    .from('product_color_swatches')
    .select('*')
    .eq('product_id', id)
    .order('position')

  if (error) return dbErrorResponse(error, 'Failed to load swatches.')
  return NextResponse.json({ swatches: data || [] })
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

  let body: { label?: string; hex?: string; image_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const label = (body.label || '').trim() || 'Unnamed'
  const hex = (body.hex || '').trim() || '#000000'
  const image_url = body.image_url ? String(body.image_url).trim() || null : null

  const { data: existingSwatches } = await access.admin
    .from('product_color_swatches')
    .select('position')
    .eq('product_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition =
    existingSwatches && existingSwatches.length > 0
      ? (existingSwatches[0].position || 0) + 1
      : 0

  const { data, error } = await access.admin
    .from('product_color_swatches')
    .insert({
      product_id: id,
      label,
      hex,
      image_url,
      position: nextPosition,
      is_active: true,
    })
    .select('*')
    .single()

  if (error || !data) return dbErrorResponse(error, 'Failed to add swatch.')
  return NextResponse.json({ swatch: data }, { status: 201 })
}
