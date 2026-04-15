'use client'

import { CalendarDays } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { PriceTier, QuoteBuilderStaffOption, QuoteDraft, Template } from '@/lib/quote-builder/types'
import { EXPIRY_PRESET_DAYS, QUOTE_STATUS_OPTIONS } from '@/lib/quote-builder/types'

interface QuoteDetailsSectionProps {
  draft: QuoteDraft
  priceTiers: PriceTier[]
  templates: Template[]
  staffUsers: QuoteBuilderStaffOption[]
  onFieldChange: <K extends keyof QuoteDraft>(field: K, value: QuoteDraft[K]) => void
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

function addDaysFromToday(days: number) {
  const today = new Date()
  today.setDate(today.getDate() + days)
  return today.toISOString().slice(0, 10)
}

export function QuoteDetailsSection({
  draft,
  priceTiers,
  templates,
  staffUsers,
  onFieldChange,
}: QuoteDetailsSectionProps) {
  return (
    <details open className="rounded-[28px] border border-gray-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Quote Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Customer details, quote settings, and pricing controls.</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">
          <CalendarDays className="h-5 w-5 text-[rgb(var(--color-brand-blue))]" />
        </div>
      </summary>

      <div className="grid gap-4 border-t border-gray-100 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Customer Name">
          <Input value={draft.customerName} onChange={(event) => onFieldChange('customerName', event.target.value)} placeholder="Customer or company contact" />
        </Field>

        <Field label="Customer Email">
          <Input type="email" value={draft.customerEmail} onChange={(event) => onFieldChange('customerEmail', event.target.value)} placeholder="customer@example.com" />
        </Field>

        <Field label="Account Manager">
          {staffUsers.length > 0 ? (
            <select
              value={draft.accountManager}
              onChange={(event) => onFieldChange('accountManager', event.target.value)}
              className={selectClassName}
            >
              <option value="">Select manager</option>
              {staffUsers.map((staffUser) => (
                <option key={staffUser.id} value={staffUser.displayName}>
                  {staffUser.displayName}
                </option>
              ))}
            </select>
          ) : (
            <Input value={draft.accountManager} onChange={(event) => onFieldChange('accountManager', event.target.value)} placeholder="Account manager" />
          )}
        </Field>

        <Field label="In-hand Date">
          <Input type="date" value={draft.inHandDate} onChange={(event) => onFieldChange('inHandDate', event.target.value)} />
        </Field>

        <Field label="Quote Reference">
          <Input value={draft.quoteReference} onChange={(event) => onFieldChange('quoteReference', event.target.value)} placeholder="QB-2026-001" />
        </Field>

        <Field label="Expiry Date">
          <div className="space-y-3">
            <Input type="date" value={draft.expiryDate} onChange={(event) => onFieldChange('expiryDate', event.target.value)} />
            <div className="flex flex-wrap gap-2">
              {EXPIRY_PRESET_DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onFieldChange('expiryDate', addDaysFromToday(days))}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gray-50"
                >
                  {days === 0 ? 'Today' : `${days}d`}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Pricing Tier">
          <select
            value={draft.priceTier}
            onChange={(event) => onFieldChange('priceTier', event.target.value)}
            className={selectClassName}
          >
            <option value="">Select tier</option>
            {priceTiers.map((tier) => (
              <option key={tier.tier_id} value={tier.tier_id}>
                {tier.tier_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="PDF Template">
          <select
            value={draft.templateId}
            onChange={(event) => onFieldChange('templateId', event.target.value)}
            className={selectClassName}
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Custom Discount (%)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={draft.customDiscount ?? ''}
            onChange={(event) => onFieldChange('customDiscount', event.target.value ? Number.parseFloat(event.target.value) : null)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) => onFieldChange('status', event.target.value as QuoteDraft['status'])}
            className={selectClassName}
          >
            {QUOTE_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </details>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
