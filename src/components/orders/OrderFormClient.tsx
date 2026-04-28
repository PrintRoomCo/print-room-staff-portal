'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CompanySection,
  type B2BAccount,
  type CompanyOrg,
} from './CompanySection'
import {
  ShipToSection,
  type ShipToState,
  EMPTY_ADDRESS,
} from './ShipToSection'
import { LineItemsTable } from './LineItemsTable'
import { type LineState } from './LineItemRow'
import { TermsSection, type TermsState } from './TermsSection'
import { SummaryPanel } from './SummaryPanel'
import type { OrderLineInput, OrderSubmitRequest } from '@/types/orders'

interface FormError {
  message: string
  lineIndex: number | null
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function OrderFormClient() {
  const router = useRouter()

  const [organization, setOrganization] = useState<CompanyOrg | null>(null)
  const [b2bAccount, setB2bAccount] = useState<B2BAccount | null>(null)
  const [stocked, setStocked] = useState(false)

  const [shipTo, setShipTo] = useState<ShipToState>({
    storeId: null,
    address: EMPTY_ADDRESS,
    saveAsStore: false,
  })

  const [lines, setLines] = useState<LineState[]>([])
  const [terms, setTerms] = useState<TermsState>({
    paymentTerms: '',
    depositPercent: 0,
    requiredBy: '',
  })
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<FormError | null>(null)

  // Set idempotency key once on mount.
  useEffect(() => {
    setIdempotencyKey(makeUuid())
  }, [])

  // When b2b account loads, seed default payment_terms and deposit %.
  useEffect(() => {
    if (!b2bAccount) return
    setTerms((prev) => ({
      ...prev,
      paymentTerms: prev.paymentTerms || b2bAccount.payment_terms || '',
      depositPercent:
        prev.depositPercent ||
        (b2bAccount.default_deposit_percent ?? 0),
    }))
  }, [b2bAccount])

  function handleOrgChange(
    org: CompanyOrg | null,
    account: B2BAccount | null,
    isStocked: boolean,
  ) {
    setOrganization(org)
    setB2bAccount(account)
    setStocked(isStocked)
    // Reset ship-to and lines when org changes.
    setShipTo({ storeId: null, address: EMPTY_ADDRESS, saveAsStore: false })
    setLines([])
  }

  function handleCustomerCodeChange(code: string) {
    setOrganization((prev) =>
      prev ? { ...prev, customer_code: code } : prev,
    )
  }

  const canSubmit = useMemo(() => {
    if (!organization || !organization.customer_code) return false
    if (!idempotencyKey) return false
    if (!terms.paymentTerms) return false
    if (
      !customerEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return false
    }
    if (!lines.length) return false
    if (
      !shipTo.address.line1.trim() ||
      !shipTo.address.city.trim() ||
      !shipTo.address.country.trim()
    ) {
      return false
    }
    for (const l of lines) {
      if (!l.productId || !l.quantity || l.quantity <= 0) return false
      if (!l.unitPrice || l.unitPrice <= 0) return false
      if (
        l.stockTracked &&
        l.availableQty != null &&
        l.quantity > l.availableQty
      ) {
        return false
      }
    }
    return true
  }, [
    organization,
    idempotencyKey,
    terms.paymentTerms,
    lines,
    shipTo.address,
    customerEmail,
  ])

  async function handleSubmit() {
    if (!organization || !organization.customer_code) return
    setSubmitting(true)
    setError(null)
    try {
      const lineInputs: OrderLineInput[] = lines.map((l) => ({
        product_id: l.productId!,
        product_name: l.productName,
        variant_id: l.variantId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
      }))
      const body: OrderSubmitRequest = {
        idempotency_key: idempotencyKey,
        organization_id: organization.id,
        customer_code: organization.customer_code,
        customer_name: organization.name,
        customer_email: customerEmail.trim(),
        shipping_address: {
          line1: shipTo.address.line1,
          city: shipTo.address.city,
          state: shipTo.address.state,
          postal_code: shipTo.address.postalCode,
          country: shipTo.address.country,
          phone: shipTo.address.phone,
          store_id: shipTo.storeId,
          save_as_store: shipTo.saveAsStore,
        },
        payment_terms: terms.paymentTerms,
        required_by: terms.requiredBy || null,
        notes: notes || null,
        internal_notes: internalNotes || null,
        lines: lineInputs,
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res
        .json()
        .catch(() => ({}))) as { error?: string; order_id?: string }

      if (!res.ok) {
        if (res.status === 409 && json.error === 'OUT_OF_STOCK') {
          setError({
            message:
              'One or more lines exceed available stock. Review the stock pills above.',
            lineIndex: null,
          })
        } else {
          setError({
            message: json.error || `Submit failed (${res.status})`,
            lineIndex: null,
          })
        }
        return
      }
      if (json.order_id) {
        router.push(`/orders/${json.order_id}`)
      }
    } catch (e) {
      setError({
        message: (e as Error).message || 'Submit failed',
        lineIndex: null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New order</h1>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Couldn’t submit order</div>
          <div>{error.message}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <CompanySection
            organization={organization}
            b2bAccount={b2bAccount}
            stocked={stocked}
            onChangeOrganization={handleOrgChange}
            onChangeCustomerCode={handleCustomerCodeChange}
            customerEmail={customerEmail}
            onChangeCustomerEmail={setCustomerEmail}
          />

          <ShipToSection
            organizationId={organization?.id ?? null}
            value={shipTo}
            onChange={setShipTo}
          />

          <LineItemsTable
            lines={lines}
            organizationId={organization?.id ?? null}
            onChange={setLines}
          />

          <TermsSection
            value={terms}
            onChange={setTerms}
            presetDeposit={b2bAccount?.default_deposit_percent ?? null}
          />

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-gray-600">Customer notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-2xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-gray-400 focus:bg-gray-100"
                placeholder="Notes that will appear on the order"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Internal notes</span>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-2xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-gray-400 focus:bg-gray-100"
                placeholder="Visible to staff only"
              />
            </label>
          </section>
        </div>

        <div>
          <SummaryPanel
            lines={lines.map((l) => ({
              tmpId: l.tmpId,
              productName: l.productName,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              availableQty: l.availableQty,
              stockTracked: l.stockTracked,
            }))}
            depositPercent={terms.depositPercent}
            canSubmit={canSubmit}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
