'use client'

import { Input } from '@/components/ui/input'

export interface TermsState {
  paymentTerms: string
  depositPercent: number
  requiredBy: string
}

interface TermsSectionProps {
  value: TermsState
  onChange: (next: TermsState) => void
  presetDeposit?: number | null
}

const PAYMENT_TERMS_OPTIONS = [
  'Prepaid',
  'Deposit',
  '7 days',
  '14 days',
  '20th of month',
  'Net 30',
]

export function TermsSection({ value, onChange, presetDeposit }: TermsSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <h2 className="text-base font-semibold">Payment & timing</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block text-sm">
          <span className="text-gray-600">Payment terms</span>
          <select
            value={value.paymentTerms}
            onChange={(e) =>
              onChange({ ...value, paymentTerms: e.target.value })
            }
            className="mt-1 block w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm text-foreground focus:outline-none focus:border-gray-400 focus:bg-gray-100 transition-all duration-200"
          >
            <option value="">Select…</option>
            {PAYMENT_TERMS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">
            Deposit %{presetDeposit != null && ` (default ${presetDeposit}%)`}
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={value.depositPercent}
            onChange={(e) =>
              onChange({
                ...value,
                depositPercent: Number(e.target.value) || 0,
              })
            }
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Required by</span>
          <Input
            type="date"
            value={value.requiredBy}
            onChange={(e) =>
              onChange({ ...value, requiredBy: e.target.value })
            }
            className="mt-1"
          />
        </label>
      </div>
    </section>
  )
}
