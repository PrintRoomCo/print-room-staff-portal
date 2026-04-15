'use client'

import Link from 'next/link'
import { Copy, ExternalLink, PackagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  ItemPricingBreakdown,
  QuoteBuilderReferenceData,
  QuoteDecoration,
  QuoteExtra,
  QuoteFinish,
  QuoteItem,
} from '@/lib/quote-builder/types'
import { formatNZD } from '@/lib/quote-builder/pricing'
import { DecorationEditor } from '@/components/quote-builder/DecorationEditor'
import { ExtrasSelector } from '@/components/quote-builder/ExtrasSelector'
import { FinishSelector } from '@/components/quote-builder/FinishSelector'
import { VolumePricingTable } from '@/components/quote-builder/VolumePricingTable'

interface ProductCardProps {
  item: QuoteItem
  referenceData: QuoteBuilderReferenceData
  pricing: ItemPricingBreakdown | undefined
  itemIssues: string[]
  onPatchItem: (patch: Partial<QuoteItem>) => void
  onRemoveItem: () => void
  onDuplicateItem: () => void
  onAddDecoration: () => void
  onPatchDecoration: (decorationId: string, patch: Partial<QuoteDecoration>) => void
  onRemoveDecoration: (decorationId: string) => void
  onAddDecorationExtra: (decorationId: string) => void
  onPatchDecorationExtra: (decorationId: string, extraId: string, patch: Partial<QuoteExtra>) => void
  onRemoveDecorationExtra: (decorationId: string, extraId: string) => void
  onAddFinish: () => void
  onPatchFinish: (finishId: string, patch: Partial<QuoteFinish>) => void
  onRemoveFinish: (finishId: string) => void
  onAddItemExtra: () => void
  onPatchItemExtra: (extraId: string, patch: Partial<QuoteExtra>) => void
  onRemoveItemExtra: (extraId: string) => void
}

export function ProductCard({
  item,
  referenceData,
  pricing,
  itemIssues,
  onPatchItem,
  onRemoveItem,
  onDuplicateItem,
  onAddDecoration,
  onPatchDecoration,
  onRemoveDecoration,
  onAddDecorationExtra,
  onPatchDecorationExtra,
  onRemoveDecorationExtra,
  onAddFinish,
  onPatchFinish,
  onRemoveFinish,
  onAddItemExtra,
  onPatchItemExtra,
  onRemoveItemExtra,
}: ProductCardProps) {
  const decorationExtraOptions = referenceData.extras.filter((extra) => extra.category === 'decoration')

  return (
    <div className="space-y-5 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {item.source}
            </span>
            {item.designGroupName ? (
              <span className="rounded-full bg-[rgb(var(--color-brand-blue))]/10 px-3 py-1 text-xs font-medium text-[rgb(var(--color-brand-blue))]">
                {item.designGroupName}
              </span>
            ) : null}
          </div>
          <h3 className="text-xl font-semibold text-foreground">{item.name || 'Untitled item'}</h3>
          <p className="text-sm text-muted-foreground">
            {[item.brand, item.sku, item.category].filter(Boolean).join(' · ') || 'Custom line item'}
          </p>
          {item.productUrl ? (
            <Link href={item.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--color-brand-blue))] hover:underline">
              View source product
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onDuplicateItem}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemoveItem}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {itemIssues.length > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {itemIssues.join(' ')}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EditableField label="Item Name">
          <Input value={item.name} onChange={(event) => onPatchItem({ name: event.target.value })} />
        </EditableField>

        <EditableField label="Quantity">
          <Input
            type="number"
            min={Math.max(item.minQty || 24, 1)}
            value={item.quantity}
            onChange={(event) => onPatchItem({ quantity: Number.parseInt(event.target.value || '0', 10) })}
          />
        </EditableField>

        <EditableField label="Base Cost">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.baseCost}
            onChange={(event) => onPatchItem({ baseCost: Number.parseFloat(event.target.value || '0') })}
          />
        </EditableField>

        <EditableField label="Design Group">
          <Input value={item.designGroupName || ''} onChange={(event) => onPatchItem({ designGroupName: event.target.value })} placeholder="Optional" />
        </EditableField>

        <EditableField label="Brand">
          <Input value={item.brand || ''} onChange={(event) => onPatchItem({ brand: event.target.value })} />
        </EditableField>

        <EditableField label="Category">
          <Input value={item.category || ''} onChange={(event) => onPatchItem({ category: event.target.value })} />
        </EditableField>

        <EditableField label="Sourcing Type">
          <Input value={item.sourcingType} onChange={(event) => onPatchItem({ sourcingType: event.target.value })} />
        </EditableField>

        <EditableField label="Product Type">
          <Input value={item.productType || ''} onChange={(event) => onPatchItem({ productType: event.target.value })} />
        </EditableField>
      </div>

      <VolumePricingTable item={item} referenceData={referenceData} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-foreground">Decorations</h4>
            <p className="text-sm text-muted-foreground">Add every logo application and location required for this item.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onAddDecoration}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Decoration
          </Button>
        </div>

        {item.decorations.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-muted-foreground">
            No decorations added yet.
          </div>
        ) : null}

        {item.decorations.map((decoration) => (
          <DecorationEditor
            key={decoration.id}
            item={item}
            decoration={decoration}
            decorations={referenceData.decorations}
            locations={referenceData.locations}
            decorationExtras={decorationExtraOptions}
            onChange={(patch) => onPatchDecoration(decoration.id, patch)}
            onRemove={() => onRemoveDecoration(decoration.id)}
            onAddExtra={() => onAddDecorationExtra(decoration.id)}
            onChangeExtra={(extraId, patch) => onPatchDecorationExtra(decoration.id, extraId, patch)}
            onRemoveExtra={(extraId) => onRemoveDecorationExtra(decoration.id, extraId)}
          />
        ))}
      </section>

      <ExtrasSelector
        title="Decoration Extras"
        extras={item.extras}
        options={decorationExtraOptions}
        onAdd={onAddItemExtra}
        onChange={onPatchItemExtra}
        onRemove={onRemoveItemExtra}
      />

      <FinishSelector
        item={item}
        finishes={item.finishes}
        options={referenceData.finishes}
        onAdd={onAddFinish}
        onChange={onPatchFinish}
        onRemove={onRemoveFinish}
      />

      <div className="grid gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Unit Price" value={formatNZD(pricing?.unitPrice || 0)} />
        <Metric label="Garment" value={formatNZD(pricing?.productUnitPrice || 0)} />
        <Metric label="Decoration" value={formatNZD(pricing?.decorationUnitPrice || 0)} />
        <Metric label="Subtotal" value={formatNZD(pricing?.subtotal || 0)} accent />
      </div>
    </div>
  )
}

function EditableField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-[rgb(var(--color-brand-blue))]' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  )
}
