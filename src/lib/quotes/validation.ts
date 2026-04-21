export interface QuotePayload {
  quote_data: {
    quoteReference?: string
    customerName?: string
    customerEmail?: string
    customerCompany?: string
    customerPhone?: string
    items: Array<{ id?: string; name?: string; quantity?: number; [k: string]: unknown }>
    orderExtras?: Array<{ name?: string; price?: string; customAmount?: number | null }>
    priceTier?: string
    customDiscount?: number | null
    [k: string]: unknown
  }
  subtotal: number
  discount_percent: number
  total: number
  customer_name?: string | null
  customer_email?: string | null
  customer_company?: string | null
  customer_phone?: string | null
  staff_notes?: string | null
  valid_until?: string | null
  status?: string
}

export function validateQuotePayload(body: unknown): { ok: true; data: QuotePayload } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const b = body as Partial<QuotePayload>
  if (!b || typeof b !== 'object') errors.push('body must be an object')
  if (!b?.quote_data || typeof b.quote_data !== 'object') errors.push('quote_data required')
  if (b?.quote_data && !Array.isArray((b.quote_data as any).items)) errors.push('quote_data.items must be array')
  for (const k of ['subtotal', 'discount_percent', 'total'] as const) {
    if (typeof b?.[k] !== 'number' || !Number.isFinite(b[k] as number) || (b[k] as number) < 0) {
      errors.push(`${k} must be a non-negative finite number`)
    }
  }
  if (errors.length) return { ok: false, errors }

  const subtotal = b.subtotal!
  const discountRate = (b.discount_percent! > 1 ? b.discount_percent! / 100 : b.discount_percent!)
  const afterDiscount = Math.max(0, subtotal * (1 - discountRate))
  // Light sanity only — exact extras math lives in pricing.ts, not duplicated here.
  if (Math.abs(b.total! - afterDiscount) / Math.max(1, afterDiscount) > 0.5) {
    errors.push('total deviates more than 50% from subtotal*(1-discount); check client pricing')
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, data: b as QuotePayload }
}

export function validateApproveReady(data: QuotePayload): string[] {
  const errs: string[] = []
  if (!Array.isArray(data.quote_data.items) || data.quote_data.items.length === 0) {
    errs.push('Quote must have at least one line')
  }
  for (const [i, item] of (data.quote_data.items ?? []).entries()) {
    if (!item.name || typeof item.quantity !== 'number' || item.quantity <= 0) {
      errs.push(`Line ${i + 1}: name and positive quantity required`)
    }
  }
  if (data.total <= 0) errs.push('Total must be > 0')
  return errs
}
