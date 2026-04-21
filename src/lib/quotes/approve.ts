import type { SupabaseClient } from '@supabase/supabase-js'
import { PRODUCTION_BOARD_ID } from '@/lib/monday/column-ids'
import { pushProductionJob } from '@/lib/monday/production-job'
import { validateApproveReady, type QuotePayload } from '@/lib/quotes/validation'

type AdminClient = SupabaseClient

type QuoteJson = Record<string, unknown>

interface StaffQuoteRow {
  id: string
  status: string
  quote_data: QuoteJson | null
  customer_name: string | null
  customer_email: string | null
  subtotal: number | null
  discount_percent: number | null
  total: number | null
  staff_notes: string | null
  monday_item_id: string | null
  monday_board_id: string | null
  approved_at: string | null
  approved_by: string | null
}

interface ProductionOrderPayload {
  order_ref: string
  customer_name: string
  customer_email: string | null
  total_price: number
  required_by: string | null
  payment_terms: string | null
  notes: string | null
  monday_item_id: string | null
}

interface ProductionLinePayload {
  quote_item_id: string
  product_name: string
  variant_label: string
  quantity: number
  unit_price: number
  decoration_summary: string | null
  existing_subitem_id: string | null
}

export interface ApproveResult {
  quote: StaffQuoteRow | null
  pushStatus: 'ok' | 'failed' | 'skipped'
  error?: string
  issues?: string[]
  alreadyApproved?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getQuoteData(quote: StaffQuoteRow): QuoteJson {
  return asRecord(quote.quote_data) ?? {}
}

function getQuoteItems(quote: StaffQuoteRow): Array<Record<string, unknown>> {
  const items = getQuoteData(quote).items
  if (!Array.isArray(items)) return []

  return items
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
}

function getDecorationSummary(item: Record<string, unknown>): string | null {
  const decorations = item.decorations
  if (!Array.isArray(decorations)) return null

  const parts = decorations
    .map((decoration) => {
      const record = asRecord(decoration)
      if (!record) return null

      const decorationType = asString(record.decorationType)
      const decorationDetail = asString(record.decorationDetail)
      if (!decorationType && !decorationDetail) return null

      return [decorationType, decorationDetail].filter(Boolean).join(': ')
    })
    .filter((value): value is string => Boolean(value))

  return parts.length > 0 ? parts.join(', ') : null
}

function buildOrderPayload(quote: StaffQuoteRow): ProductionOrderPayload {
  const data = getQuoteData(quote)
  const refId = `Q-${String(quote.id).slice(0, 8).toUpperCase()}`

  return {
    order_ref: refId,
    customer_name: quote.customer_name ?? asString(data.customerName) ?? 'Unknown',
    customer_email: quote.customer_email ?? asString(data.customerEmail),
    total_price: Number(quote.total ?? asNumber(data.total) ?? 0),
    required_by: asString(data.inHandDate),
    payment_terms: null,
    notes: quote.staff_notes ?? asString(data.notes),
    monday_item_id: quote.monday_item_id ?? null,
  }
}

function buildLinesPayload(quote: StaffQuoteRow): ProductionLinePayload[] {
  return getQuoteItems(quote).map((item, index) => ({
    quote_item_id: `quote-line-${index}`,
    product_name: asString(item.name) ?? 'Line',
    variant_label: [asString(item.brand), asString(item.category)].filter(Boolean).join(' — ') || '—',
    quantity: Number(asNumber(item.quantity) ?? 0),
    unit_price: 0,
    decoration_summary: getDecorationSummary(item),
    existing_subitem_id: asString(item.monday_subitem_id),
  }))
}

function buildApproveValidationPayload(quote: StaffQuoteRow): QuotePayload {
  return {
    quote_data: getQuoteData(quote) as QuotePayload['quote_data'],
    subtotal: Number(quote.subtotal ?? 0),
    discount_percent: Number(quote.discount_percent ?? 0),
    total: Number(quote.total ?? 0),
  }
}

function patchPushSuccessData(
  quote: StaffQuoteRow,
  subitemIds: Record<string, string>
): QuoteJson {
  const data = getQuoteData(quote)
  const items = getQuoteItems(quote).map((item, index) => ({
    ...item,
    monday_subitem_id: subitemIds[`quote-line-${index}`] ?? asString(item.monday_subitem_id),
  }))

  return {
    ...data,
    items,
    __push_state: 'ok',
    __push_error: null,
  }
}

function patchPushFailureData(quote: StaffQuoteRow, message: string): QuoteJson {
  return {
    ...getQuoteData(quote),
    __push_state: 'failed',
    __push_error: message,
  }
}

function mergeQuote(
  quote: StaffQuoteRow,
  patch: Partial<StaffQuoteRow>
): StaffQuoteRow {
  return {
    ...quote,
    ...patch,
  }
}

export async function approveQuote(
  admin: AdminClient,
  quoteId: string,
  staffId: string
): Promise<ApproveResult> {
  const { data, error } = await admin
    .from('staff_quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  const quote = data as StaffQuoteRow | null
  if (error || !quote) {
    return { quote: null, pushStatus: 'skipped', error: 'Quote not found' }
  }

  if (quote.status === 'approved' && quote.monday_item_id) {
    return { quote, pushStatus: 'skipped', alreadyApproved: true }
  }

  if (quote.status !== 'approved') {
    if (!['created', 'draft', 'sent'].includes(quote.status)) {
      return {
        quote,
        pushStatus: 'skipped',
        error: 'VALIDATION',
        issues: [`Only created, draft, or sent quotes can be approved. Current status: ${quote.status}`],
      }
    }

    const readyIssues = validateApproveReady(buildApproveValidationPayload(quote))
    if (readyIssues.length > 0) {
      return { quote, pushStatus: 'skipped', error: 'VALIDATION', issues: readyIssues }
    }

    const { data: updated, error: updateError } = await admin
      .from('staff_quotes')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: staffId,
      })
      .eq('id', quoteId)
      .select('*')
      .single()

    if (updateError || !updated) {
      return { quote, pushStatus: 'skipped', error: updateError?.message ?? 'Failed to approve quote' }
    }

    Object.assign(quote, updated as StaffQuoteRow)
  }

  try {
    const { itemId, subitemIds } = await pushProductionJob(
      buildOrderPayload(quote),
      buildLinesPayload(quote)
    )

    const newData = patchPushSuccessData(quote, subitemIds)
    const { data: finalRow } = await admin
      .from('staff_quotes')
      .update({
        monday_item_id: itemId,
        monday_board_id: String(PRODUCTION_BOARD_ID),
        quote_data: newData,
      })
      .eq('id', quoteId)
      .select('*')
      .single()

    return {
      quote: finalRow
        ? (finalRow as StaffQuoteRow)
        : mergeQuote(quote, {
            monday_item_id: itemId,
            monday_board_id: String(PRODUCTION_BOARD_ID),
            quote_data: newData,
          }),
      pushStatus: 'ok',
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Monday push failed'
    const newData = patchPushFailureData(quote, message)
    const { data: finalRow } = await admin
      .from('staff_quotes')
      .update({ quote_data: newData })
      .eq('id', quoteId)
      .select('*')
      .single()

    return {
      quote: finalRow
        ? (finalRow as StaffQuoteRow)
        : mergeQuote(quote, { quote_data: newData }),
      pushStatus: 'failed',
      error: message,
    }
  }
}
