import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
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

  let q = auth.admin
    .from('orders')
    .select(
      `
      id, status, total_price, placed_at, quote_id,
      quotes!inner (
        order_ref, customer_name, organization_id, required_by,
        organizations:organization_id ( name )
      )
    `,
      { count: 'exact' }
    )
    .order('placed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (p.get('status')) q = q.eq('status', p.get('status')!)
  if (p.get('org_id')) q = q.eq('quotes.organization_id', p.get('org_id')!)
  if (p.get('from')) q = q.gte('placed_at', p.get('from')!)
  if (p.get('to')) q = q.lte('placed_at', p.get('to')!)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [], total: count ?? 0, limit, offset })
}
