'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Extra, QuoteExtra } from '@/lib/quote-builder/types'

interface ExtrasSelectorProps {
  title: string
  extras: QuoteExtra[]
  options: Extra[]
  onAdd: () => void
  onChange: (extraId: string, patch: Partial<QuoteExtra>) => void
  onRemove: (extraId: string) => void
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

export function ExtrasSelector({
  title,
  extras,
  options,
  onAdd,
  onChange,
  onRemove,
}: ExtrasSelectorProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium text-foreground">{title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">Choose a preset or enter a custom extra.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Extra
        </Button>
      </div>

      {extras.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-muted-foreground">
          No extras added.
        </div>
      ) : null}

      {extras.map((extra) => (
        <div key={extra.id} className="grid gap-3 rounded-2xl border border-gray-100 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
          <select
            value={extra.sourceId != null ? String(extra.sourceId) : ''}
            onChange={(event) => {
              const nextId = Number.parseInt(event.target.value, 10)
              const selected = options.find((option) => option.id === nextId)
              if (!selected) return

              onChange(extra.id, {
                sourceId: selected.id,
                name: selected.name,
                price: selected.price,
                pricingStructure: selected.pricing_structure,
                category: selected.category,
                appliesTo: selected.applies_to,
                sourcingType: selected.sourcing_type,
              })
            }}
            className={selectClassName}
          >
            <option value="">Custom extra</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <Input
            value={extra.name}
            onChange={(event) => onChange(extra.id, { name: event.target.value })}
            placeholder="Extra name"
          />

          <Input
            value={extra.price}
            onChange={(event) => onChange(extra.id, { price: event.target.value })}
            placeholder="$2.50"
          />

          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(extra.id)} aria-label="Remove extra">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
