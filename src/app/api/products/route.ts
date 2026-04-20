import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  dbErrorResponse,
} from '@/lib/products/server'
import { withUniformsScope } from '@/lib/products/scope'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { normaliseCreate } from '@/lib/products/schema'
import { rowsToChannelsMap, CHANNELS } from '@/lib/products/channels'
import { sanitiseTagArray, upsertTagCatalog } from '@/lib/products/tag-catalog'

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

  const products = (data || []).map(row => {
    const { _channel_filter, channels, ...rest } = row as unknown as Record<string, unknown>
    void _channel_filter
    return { ...rest, channels: rowsToChannelsMap(channels) }
  })

  return NextResponse.json({
    products,
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

  const tags = sanitiseTagArray(parsed.value.tags)
  const bodyObj = body as Record<string, unknown>
  const channelsInput = (bodyObj.channels && typeof bodyObj.channels === 'object')
    ? (bodyObj.channels as Record<string, unknown>)
    : {}

  const { data, error } = await withUniformsScope(
    access.admin
      .from('products')
      .insert({
        ...parsed.value,
        tags,
        platform: 'uniforms',
      })
      .select('id, name')
      .limit(1)
  ).single()

  if (error || !data) return dbErrorResponse(error, 'Failed to create product.')

  const channelRows: { product_id: string; product_type: string; is_active: boolean }[] = []
  for (const channel of CHANNELS) {
    const state = channelsInput[channel]
    if (state === 'active' || state === 'inactive') {
      channelRows.push({
        product_id: data.id,
        product_type: channel,
        is_active: state === 'active',
      })
    }
  }

  if (channelRows.length > 0) {
    const { error: chErr } = await access.admin
      .from('product_type_activations')
      .insert(channelRows)
    if (chErr) return dbErrorResponse(chErr, 'Failed to create channel rows.')
  }

  if (tags.length > 0) {
    await upsertTagCatalog(access.admin, tags, access.context.staffId)
  }

  return NextResponse.json({ product: data }, { status: 201 })
}
