import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { fetchOrdersListData } from '@/lib/orders/read'
import { submitB2BOrder } from '@/lib/orders/submit'
import type { OrderSubmitRequest } from '@/types/orders'

export async function POST(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  let body: Partial<OrderSubmitRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const missing: string[] = []
  for (const k of [
    'idempotency_key',
    'organization_id',
    'customer_code',
    'customer_name',
    'customer_email',
    'shipping_address',
    'payment_terms',
  ] as const) {
    if (!body[k]) missing.push(k)
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) missing.push('lines')
  if (missing.length) {
    return NextResponse.json({ error: 'Missing fields', missing }, { status: 400 })
  }

  try {
    const result = await submitB2BOrder(body as OrderSubmitRequest)
    return NextResponse.json(result)
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('OUT_OF_STOCK')) {
      return NextResponse.json({ error: 'OUT_OF_STOCK' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 25)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))

  const { orders, count, quotesById, organizationsById, lineCountsByQuoteId, error } = await fetchOrdersListData(auth.admin, {
    status: p.get('status') || undefined,
    orgId: p.get('org_id') || undefined,
    from: p.get('from') || undefined,
    to: p.get('to') || undefined,
    limit,
    offset,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })

  const payload = orders.map((order) => {
    const quote = order.quote_id ? quotesById[order.quote_id] : undefined
    const organization = quote?.organization_id ? organizationsById[quote.organization_id] : undefined

    return {
      ...order,
      quote: quote
        ? {
            ...quote,
            organization: organization ?? null,
          }
        : null,
      line_count: order.quote_id ? lineCountsByQuoteId[order.quote_id] ?? null : null,
    }
  })

  return NextResponse.json({ orders: payload, total: count ?? 0, limit, offset })
}
