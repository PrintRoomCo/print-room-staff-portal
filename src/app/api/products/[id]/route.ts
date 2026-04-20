import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import { mergeWithReservedTags } from '@/lib/products/tags'
import { normaliseUpdate } from '@/lib/products/schema'

const DETAIL_SELECT = '*'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const { data, error } = await withUniformsScope(
    access.admin.from('products').select(DETAIL_SELECT).eq('id', id)
  ).single()

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = normaliseUpdate(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Validation failed.', errors: parsed.errors }, { status: 400 })
  }

  const existingTags = Array.isArray(existing.product.tags) ? existing.product.tags : []
  const incomingTags = parsed.value.tags ?? []
  const finalTags = mergeWithReservedTags(incomingTags, existingTags)

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .update({ ...parsed.value, tags: finalTags, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(DETAIL_SELECT)
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to update product.')

  return NextResponse.json({ product: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const [swatchRes, sizeRes, imageRes, tierRes] = await Promise.all([
    access.admin.from('product_color_swatches').delete().eq('product_id', id),
    access.admin.from('sizes').delete().eq('product_id', id),
    access.admin.from('product_images').delete().eq('product_id', id),
    access.admin.from('product_pricing_tiers').delete().eq('product_id', id),
  ])
  for (const res of [swatchRes, sizeRes, imageRes, tierRes]) {
    if (res.error) return dbErrorResponse(res.error, 'Failed to delete product children.')
  }

  const { error } = await withUniformsScope(
    access.admin.from('products').delete().eq('id', id)
  )
  if (error) return dbErrorResponse(error, 'Failed to delete product.')

  return NextResponse.json({ ok: true })
}
