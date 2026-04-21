'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Finish, QuoteFinish, QuoteItem } from '@/lib/quote-builder/types'

interface FinishSelectorProps {
  item: QuoteItem
  finishes: QuoteFinish[]
  options: Finish[]
  onAdd: () => void
  onChange: (finishId: string, patch: Partial<QuoteFinish>) => void
  onRemove: (finishId: string) => void
  disabled?: boolean
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

export function FinishSelector({
  item,
  finishes,
  options,
  onAdd,
  onChange,
  onRemove,
  disabled = false,
}: FinishSelectorProps) {
  const availableOptions = options.filter((option) => {
    const matchesSource = !option.sourcing_type || option.sourcing_type === item.sourcingType
    const meetsMin = option.min_qty == null || item.quantity >= option.min_qty
    const meetsMax = option.max_qty == null || item.quantity <= option.max_qty
    return matchesSource && meetsMin && meetsMax
  })

  return (
    <div className="space-y-4 rounded-3xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium text-foreground">Finishes & Packaging</h4>
          <p className="mt-1 text-xs text-muted-foreground">Add any finishing touches that apply to this line item.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Add Finish
        </Button>
      </div>

      {finishes.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-muted-foreground">
          No finishes added.
        </div>
      ) : null}

      {finishes.map((finish) => (
        <div key={finish.id} className="grid gap-3 rounded-2xl border border-gray-100 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={finish.sourceId != null ? String(finish.sourceId) : ''}
            onChange={(event) => {
              const nextId = Number.parseInt(event.target.value, 10)
              const selected = availableOptions.find((option) => option.id === nextId)
              if (!selected) return

              onChange(finish.id, {
                sourceId: selected.id,
                finishType: selected.finish_type,
                price: selected.price,
              })
            }}
            className={selectClassName}
            disabled={disabled}
          >
            <option value="">Select finish</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.finish_type}
              </option>
            ))}
          </select>

          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(finish.id)} aria-label="Remove finish" disabled={disabled}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
