'use client'

import { calculateQuoteTotal, formatNZD } from '@/lib/quote-builder/pricing'
import type { QuoteBuilderReferenceData, QuoteDraft } from '@/lib/quote-builder/types'

export function useQuotePricing(draft: QuoteDraft, referenceData: QuoteBuilderReferenceData) {
  const pricing = calculateQuoteTotal(draft, referenceData)

  return {
    pricing,
    formattedSubtotal: formatNZD(pricing.subtotal),
    formattedTotal: formatNZD(pricing.total),
    formattedTotalInclGst: formatNZD(pricing.totalInclGst),
  }
}
