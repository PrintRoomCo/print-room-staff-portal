'use client'

import { getProductSellingPrice, formatNZD } from '@/lib/quote-builder/pricing'
import type { QuoteBuilderReferenceData, QuoteItem } from '@/lib/quote-builder/types'
import { QUANTITY_BREAKS } from '@/lib/quote-builder/types'

interface VolumePricingTableProps {
  item: QuoteItem
  referenceData: QuoteBuilderReferenceData
}

export function VolumePricingTable({ item, referenceData }: VolumePricingTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-foreground">
        Volume pricing
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-5">
        {QUANTITY_BREAKS.map((quantityBreak, index) => {
          const unitPrice = getProductSellingPrice(
            {
              base_cost: item.baseCost,
              category: item.category || null,
              sourcing_type: item.sourcingType,
            },
            quantityBreak,
            referenceData.multipliers
          )

          const rangeLabel = index === QUANTITY_BREAKS.length - 1
            ? `${quantityBreak}+`
            : `${quantityBreak}-${QUANTITY_BREAKS[index + 1] - 1}`

          return (
            <div key={quantityBreak} className="bg-white px-4 py-4">
              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{rangeLabel}</div>
              <div className="mt-2 text-base font-semibold text-foreground">{formatNZD(unitPrice)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Per garment before decoration</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
