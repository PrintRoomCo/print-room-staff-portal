'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface SummaryLine {
  tmpId: string
  productName: string
  quantity: number
  unitPrice: number
  availableQty: number | null
  stockTracked: boolean
}

interface SummaryPanelProps {
  lines: SummaryLine[]
  depositPercent: number
  canSubmit: boolean
  submitting: boolean
  onSubmit: () => void
}

export function SummaryPanel({
  lines,
  depositPercent,
  canSubmit,
  submitting,
  onSubmit,
}: SummaryPanelProps) {
  const lineCount = lines.length
  const subtotal = lines.reduce(
    (acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0,
  )
  const deposit = subtotal * (Math.max(0, Math.min(100, depositPercent)) / 100)
  const balance = subtotal - deposit

  const outOfStock = lines.filter(
    (l) =>
      l.stockTracked &&
      l.availableQty != null &&
      Number(l.quantity) > 0 &&
      Number(l.quantity) > l.availableQty,
  )

  return (
    <div className="lg:sticky lg:top-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-base font-semibold">Summary</h3>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Line count</span>
              <span className="font-medium">{lineCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">
                Deposit ({depositPercent || 0}%)
              </span>
              <span className="font-medium">${deposit.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-gray-700">Balance</span>
              <span className="font-semibold">${balance.toFixed(2)}</span>
            </div>
          </div>

          {outOfStock.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <div className="font-semibold mb-1">
                {outOfStock.length} line{outOfStock.length === 1 ? '' : 's'} over
                available stock:
              </div>
              <ul className="list-disc ml-4 space-y-0.5">
                {outOfStock.map((l) => (
                  <li key={l.tmpId}>
                    {l.productName || 'Unnamed'} — qty {l.quantity} /{' '}
                    {l.availableQty}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            variant="accent"
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
          >
            {submitting ? 'Submitting…' : 'Submit order'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
