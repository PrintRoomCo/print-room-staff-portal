'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Decoration, Location, QuoteDecoration, QuoteItem } from '@/lib/quote-builder/types'
import { ExtrasSelector } from '@/components/quote-builder/ExtrasSelector'
import type { Extra, QuoteExtra } from '@/lib/quote-builder/types'

interface DecorationEditorProps {
  item: QuoteItem
  decoration: QuoteDecoration
  decorations: Decoration[]
  locations: Location[]
  decorationExtras: Extra[]
  onChange: (patch: Partial<QuoteDecoration>) => void
  onRemove: () => void
  onAddExtra: () => void
  onChangeExtra: (extraId: string, patch: Partial<QuoteExtra>) => void
  onRemoveExtra: (extraId: string) => void
  disabled?: boolean
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

function filterDecorations(item: QuoteItem, decorations: Decoration[]) {
  return decorations.filter((candidate) => {
    const matchesSource = !candidate.sourcing_type || candidate.sourcing_type === item.sourcingType
    const matchesCategory = !candidate.product_category || candidate.product_category === item.category
    const meetsMin = candidate.min_qty == null || item.quantity >= candidate.min_qty
    const meetsMax = candidate.max_qty == null || item.quantity <= candidate.max_qty
    return matchesSource && matchesCategory && meetsMin && meetsMax
  })
}

function filterLocations(item: QuoteItem, locations: Location[]) {
  return locations.filter((location) => !location.sourcing_type || location.sourcing_type === item.sourcingType)
}

export function DecorationEditor({
  item,
  decoration,
  decorations,
  locations,
  decorationExtras,
  onChange,
  onRemove,
  onAddExtra,
  onChangeExtra,
  onRemoveExtra,
  disabled = false,
}: DecorationEditorProps) {
  const availableDecorations = filterDecorations(item, decorations)
  const typeOptions = Array.from(new Set(availableDecorations.map((option) => option.decoration_type))).sort()
  const detailOptions = availableDecorations
    .filter((option) => !decoration.decorationType || option.decoration_type === decoration.decorationType)
    .sort((left, right) => left.decoration_detail.localeCompare(right.decoration_detail))
  const locationOptions = filterLocations(item, locations)

  return (
    <div className="space-y-4 rounded-3xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium text-foreground">Decoration</h4>
          <p className="mt-1 text-xs text-muted-foreground">Technique, detail, and placement for this product.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove decoration" disabled={disabled}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          value={decoration.decorationType}
          onChange={(event) => onChange({ decorationType: event.target.value, decorationDetail: '', sourceId: null })}
          className={selectClassName}
          disabled={disabled}
        >
          <option value="">Decoration type</option>
          {typeOptions.map((typeOption) => (
            <option key={typeOption} value={typeOption}>
              {typeOption}
            </option>
          ))}
        </select>

        <select
          value={decoration.sourceId != null ? String(decoration.sourceId) : ''}
          onChange={(event) => {
            const nextId = Number.parseInt(event.target.value, 10)
            const selected = detailOptions.find((option) => option.id === nextId)
            if (!selected) return

            onChange({
              sourceId: selected.id,
              decorationType: selected.decoration_type,
              decorationDetail: selected.decoration_detail,
              price: selected.price,
              setupFee: selected.setup_fee,
            })
          }}
          className={selectClassName}
          disabled={disabled}
        >
          <option value="">Decoration detail</option>
          {detailOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.decoration_detail}
            </option>
          ))}
        </select>

        <select
          value={decoration.location}
          onChange={(event) => onChange({ location: event.target.value })}
          className={selectClassName}
          disabled={disabled}
        >
          <option value="">Location</option>
          {locationOptions.map((location) => (
            <option key={location.id} value={location.location}>
              {location.location}
            </option>
          ))}
        </select>
      </div>

      <ExtrasSelector
        title="Decoration Extras"
        extras={decoration.extras}
        options={decorationExtras}
        onAdd={onAddExtra}
        onChange={onChangeExtra}
        onRemove={onRemoveExtra}
        disabled={disabled}
      />

      <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs text-muted-foreground">
        Setup and per-unit pricing are derived from the selected decoration detail when the pricing tables are available.
      </div>
    </div>
  )
}
