import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let q = auth.admin.from('staff_quotes').select('*').eq('id', id)
  if (!auth.context.isAdmin) q = q.eq('staff_user_id', auth.context.staffId)

  const { data, error } = await q.single()
  if (error || !data) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ quote: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const v = validateQuotePayload(normalizeQuotePayloadInput(body))
  if (!v.ok) return NextResponse.json({ error: 'Validation failed', issues: v.errors }, { status: 400 })

  let probe = auth.admin
    .from('staff_quotes')
    .select('status, staff_user_id')
    .eq('id', id)
  if (!auth.context.isAdmin) probe = probe.eq('staff_user_id', auth.context.staffId)

  const { data: existing, error: existingError } = await probe.single()
  if (existingError || !existing) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (existing.status === 'approved' || existing.status === 'cancelled') {
    return NextResponse.json({ error: `Cannot edit ${existing.status} quote` }, { status: 409 })
  }

  const d: QuotePayload = v.data
  let update = auth.admin
    .from('staff_quotes')
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (!auth.context.isAdmin) update = update.eq('staff_user_id', auth.context.staffId)

  const { data: quote, error } = await update.select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote })
}
