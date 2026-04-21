import { NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'
import { validateQuotePayload, type QuotePayload } from '@/lib/quotes/validation'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asOptionalText(value: unknown): string | null | undefined {
  if (value == null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeQuotePayloadInput(body: unknown): unknown {
  const record = asRecord(body)
  if (!record) return body

  if (asRecord(record.quote_data)) {
    return body
  }

  if (!Array.isArray(record.items)) {
    return body
  }

  return {
    quote_data: record,
    subtotal: asNumber(record.subtotal),
    discount_percent: asNumber(record.customDiscount) ?? 0,
    total: asNumber(record.total),
    customer_name: asOptionalText(record.customerName),
    customer_email: asOptionalText(record.customerEmail),
    customer_company: asOptionalText(record.customerCompany),
    customer_phone: asOptionalText(record.customerPhone),
    staff_notes: asOptionalText(record.notes),
    valid_until: asOptionalText(record.expiryDate),
    status: asText(record.status),
  }
}

function nullableInsertText(value: string | null | undefined) {
  if (typeof value !== 'string') return value ?? null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getInsertCustomerField(
  explicitValue: string | null | undefined,
  quoteDataValue: unknown
) {
  return nullableInsertText(explicitValue) ?? nullableInsertText(asText(quoteDataValue))
}

export async function GET(request: Request) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error

  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 25)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))
  const mineOnly = p.get('mine') === '1'
  const status = p.get('status')

  let q = auth.admin
    .from('staff_quotes')
    .select(
      'id, customer_name, customer_email, customer_company, status, subtotal, discount_percent, total, staff_notes, monday_item_id, approved_at, created_at, updated_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!auth.context.isAdmin || mineOnly) q = q.eq('staff_user_id', auth.context.staffId)
  if (status) q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data ?? [], total: count ?? 0, limit, offset })
}

export async function POST(request: Request) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const v = validateQuotePayload(normalizeQuotePayloadInput(body))
  if (!v.ok) return NextResponse.json({ error: 'Validation failed', issues: v.errors }, { status: 400 })

  const d: QuotePayload = v.data
  const { data: quote, error } = await auth.admin
    .from('staff_quotes')
    .insert({
      staff_user_id: auth.context.staffId,
      status: 'draft',
      quote_data: d.quote_data,
      subtotal: d.subtotal,
      discount_percent: d.discount_percent,
      total: d.total,
      customer_name: getInsertCustomerField(d.customer_name, d.quote_data.customerName),
      customer_email: getInsertCustomerField(d.customer_email, d.quote_data.customerEmail),
      customer_company: getInsertCustomerField(d.customer_company, d.quote_data.customerCompany),
      customer_phone: getInsertCustomerField(d.customer_phone, d.quote_data.customerPhone),
      staff_notes: nullableInsertText(d.staff_notes),
      valid_until: nullableInsertText(d.valid_until),
    })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote }, { status: 201 })
}
