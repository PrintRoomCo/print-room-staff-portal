'use client'

import { FileText, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatNZD } from '@/lib/quote-builder/pricing'
import type { QuoteDraft, QuotePricingBreakdown, QuoteValidationState } from '@/lib/quote-builder/types'

interface QuoteSummaryProps {
  draft: QuoteDraft
  pricing: QuotePricingBreakdown
  validation: QuoteValidationState
  onFieldChange: <K extends keyof QuoteDraft>(field: K, value: QuoteDraft[K]) => void
  onSave: () => void
  saving: boolean
  saveLabel?: string
  savingLabel?: string
  saveState?: 'idle' | 'saving' | 'saved' | 'error' | 'locked'
  disabled?: boolean
}

const DISCLAIMER_TEXT = 'Prices exclude GST unless shown otherwise. Final pricing remains subject to artwork review, stock confirmation, and freight adjustments.'

export function QuoteSummary({
  draft,
  pricing,
  validation,
  onFieldChange,
  onSave,
  saving,
  saveLabel = 'Save Quote',
  savingLabel = 'Saving Quote…',
  saveState = 'idle',
  disabled = false,
}: QuoteSummaryProps) {
  const displayedTotal = draft.includeGst ? pricing.totalInclGst : pricing.total

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Quote Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live pricing breakdown for the current draft.</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${validation.isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {validation.isReady ? 'Ready to Quote' : 'Incomplete'}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {draft.items.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-muted-foreground">
              Add products to see a pricing summary.
            </div>
          ) : (
            draft.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-100 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{item.name || 'Untitled item'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.quantity} units · {item.designGroupName || 'Standalone design'}</div>
                  </div>
                  <div className="text-right font-semibold text-foreground">
                    {formatNZD(pricing.items[item.id]?.subtotal || 0)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 space-y-3 rounded-3xl border border-gray-100 bg-gray-50 p-4">
          <TotalRow label="Subtotal" value={formatNZD(pricing.subtotal)} />
          <TotalRow label="Discount" value={`-${formatNZD(pricing.discountAmount)}`} />
          <TotalRow label="Order Extras" value={formatNZD(pricing.orderExtrasTotal)} />
          <div className="border-t border-gray-200 pt-3">
            <TotalRow label={draft.includeGst ? 'Total (Incl. GST)' : 'Total (Excl. GST)'} value={formatNZD(displayedTotal)} accent />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <ToggleChip
              active={draft.includeGst}
              label="Incl. GST"
              onClick={() => onFieldChange('includeGst', !draft.includeGst)}
              disabled={disabled}
            />
            <ToggleChip
              active={draft.showTotal}
              label="Show Total"
              onClick={() => onFieldChange('showTotal', !draft.showTotal)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-[rgb(var(--color-brand-blue))]/5 px-4 py-4 text-sm text-muted-foreground">
          {DISCLAIMER_TEXT}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {saveState !== 'idle' ? <SaveStateBadge state={saveState} /> : null}
          <Button variant="accent" disabled>
            <FileText className="mr-2 h-4 w-4" />
            Generate Quote PDF
          </Button>
          <Button variant="secondary" onClick={onSave} disabled={saving || disabled}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? savingLabel : saveLabel}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-lg font-semibold text-foreground">Notes</h3>
        <p className="mt-1 text-sm text-muted-foreground">Internal instructions or context for this quote.</p>
        <div className="mt-4">
          <Textarea
            value={draft.notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            placeholder="Add production notes, delivery considerations, or handoff context"
            disabled={disabled}
          />
        </div>
      </Card>
    </div>
  )
}

function TotalRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent ? 'text-[rgb(var(--color-brand-blue))]' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

function SaveStateBadge({ state }: { state: NonNullable<QuoteSummaryProps['saveState']> }) {
  const config = {
    saving: { label: 'Saving…', className: 'bg-sky-100 text-sky-800' },
    saved: { label: 'Saved', className: 'bg-emerald-100 text-emerald-800' },
    error: { label: 'Save failed', className: 'bg-red-100 text-red-800' },
    locked: { label: 'Locked', className: 'bg-amber-100 text-amber-900' },
    idle: { label: '', className: '' },
  }[state]

  if (!config.label) return null

  return (
    <div className={`self-start rounded-full px-3 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </div>
  )
}

function ToggleChip({ active, label, onClick, disabled = false }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-[rgb(var(--color-brand-blue))] bg-[rgb(var(--color-brand-blue))] text-white' : 'border-gray-200 bg-white text-foreground hover:bg-gray-50'}`}
    >
      {label}
    </button>
  )
}
