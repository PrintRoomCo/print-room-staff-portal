import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import { mergeWithReservedTags } from '@/lib/products/tags'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { normaliseCreate } from '@/lib/products/schema'

export async function GET(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const filters = parseListSearchParams(request.nextUrl.searchParams)
  const offset = (filters.page - 1) * PRODUCTS_PER_PAGE

  const { data, error, count } = await buildListQuery(access.admin, filters).range(
    offset,
    offset + PRODUCTS_PER_PAGE - 1
  )

  if (error) return dbErrorResponse(error, 'Failed to load products.')

  return NextResponse.json({
    products: data || [],
    total: count || 0,
    page: filters.page,
    perPage: PRODUCTS_PER_PAGE,
  })
}

export async function POST(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = normaliseCreate(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Validation failed.', errors: parsed.errors }, { status: 400 })
  }

  const finalTags = mergeWithReservedTags(parsed.value.tags, [])

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .insert({
        ...parsed.value,
        tags: finalTags,
        platform: 'uniforms',
      })
      .select('id, name')
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to create product.')

  return NextResponse.json({ product: data }, { status: 201 })
}
