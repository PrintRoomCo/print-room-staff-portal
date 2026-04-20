'use client'

import { Button } from '@/components/ui/button'
import { LineItemRow, type LineState } from './LineItemRow'

interface LineItemsTableProps {
  lines: LineState[]
  organizationId: string | null
  onChange: (next: LineState[]) => void
}

export function LineItemsTable({
  lines,
  organizationId,
  onChange,
}: LineItemsTableProps) {
  function makeEmpty(): LineState {
    return {
      tmpId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: null,
      productName: '',
      variantId: null,
      colorSwatchId: null,
      sizeId: null,
      quantity: 0,
      unitPrice: 0,
      unitPriceOverride: false,
      availableQty: null,
      stockTracked: false,
    }
  }

  function updateAt(index: number, next: LineState) {
    const copy = [...lines]
    copy[index] = next
    onChange(copy)
  }

  function removeAt(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  function addLine() {
    onChange([...lines, makeEmpty()])
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Line items</h2>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          + Add line
        </Button>
      </div>

      {lines.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-200 rounded-xl">
          No lines yet. Click “Add line” to add a product.
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => (
            <LineItemRow
              key={line.tmpId}
              line={line}
              index={i}
              organizationId={organizationId}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
