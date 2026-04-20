'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export interface OrderLineVariantRef {
  color_label: string | null
  color_hex: string | null
  size_label: string | null
}

export interface OrderLine {
  id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number | null
  total_price: number | null
  variant_id: string | null
  variant: OrderLineVariantRef | null
}

interface VariantOption {
  id: string
  color_label: string | null
  color_hex: string | null
  size_label: string | null
}

interface Props {
  orderId: string
  line: OrderLine
  disabled: boolean
}

interface RawVariantRow {
  id: string
  color_swatch_id: string | null
  size_id: number | null
  product_color_swatches?: { label: string | null; hex: string | null } | null
  sizes?: { label: string | null } | null
}

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `$${Number(n).toFixed(2)}`
}

function describeVariant(v: OrderLineVariantRef | VariantOption | null): string {
  if (!v) return '—'
  const bits = [v.color_label, v.size_label].filter(Boolean)
  return bits.length ? bits.join(' / ') : '—'
}

export function LineEditRow({ orderId, line, disabled }: Props) {
  const router = useRouter()
  const [qty, setQty] = useState<number>(line.quantity)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<VariantOption[] | null>(null)
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [showVariantPicker, setShowVariantPicker] = useState(false)

  async function loadVariants() {
    if (!line.product_id) {
      setError('No product on this line — cannot swap variants.')
      return
    }
    setLoadingVariants(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${line.product_id}/variants`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load variants.')
        return
      }
      const rows = (json.variants as RawVariantRow[] | undefined) ?? []
      setVariants(
        rows.map((v) => ({
          id: v.id,
          color_label: v.product_color_swatches?.label ?? null,
          color_hex: v.product_color_swatches?.hex ?? null,
          size_label: v.sizes?.label ?? null,
        })),
      )
    } finally {
      setLoadingVariants(false)
    }
  }

  async function handleOpenVariantPicker() {
    setShowVariantPicker(true)
    if (!variants) {
      await loadVariants()
    }
  }

  async function saveQty() {
    if (qty === line.quantity) return
    if (!Number.isInteger(qty) || qty <= 0) {
      setError('Quantity must be a positive integer.')
      setQty(line.quantity)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to update quantity.')
        setQty(line.quantity)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function saveVariant(variantId: string) {
    if (variantId === line.variant_id) {
      setShowVariantPicker(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variantId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to swap variant.')
        return
      }
      setShowVariantPicker(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function removeLine() {
    if (!window.confirm('Remove this line from the order?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/lines/${line.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to remove line.')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2 align-top">
        <div className="font-medium">{line.product_name ?? '—'}</div>
        {line.product_id && (
          <div className="text-xs text-gray-400">{line.product_id}</div>
        )}
        {error && (
          <div className="text-xs text-red-600 mt-1">{error}</div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {showVariantPicker ? (
          <div className="space-y-1">
            {loadingVariants && (
              <div className="text-xs text-gray-500">Loading variants…</div>
            )}
            {variants && variants.length === 0 && (
              <div className="text-xs text-gray-500">
                No variants for this product.
              </div>
            )}
            {variants && variants.length > 0 && (
              <select
                className="block w-full text-sm border border-gray-300 rounded px-2 py-1"
                value={line.variant_id ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const v = e.target.value
                  if (v) saveVariant(v)
                }}
              >
                <option value="">Select a variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {describeVariant(v)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 underline"
              onClick={() => setShowVariantPicker(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm">
              {line.variant?.color_hex && (
                <span
                  className="inline-block w-3 h-3 rounded-full border border-gray-200"
                  style={{ backgroundColor: line.variant.color_hex }}
                />
              )}
              {describeVariant(line.variant)}
            </span>
            {!disabled && line.product_id && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                onClick={handleOpenVariantPicker}
                disabled={busy}
              >
                Change
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top w-28">
        {disabled ? (
          <span className="text-sm">{line.quantity}</span>
        ) : (
          <input
            type="number"
            min={1}
            step={1}
            className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
            value={qty}
            disabled={busy}
            onChange={(e) => setQty(Number(e.target.value))}
            onBlur={saveQty}
          />
        )}
      </td>
      <td className="px-3 py-2 align-top text-sm tabular-nums">
        {formatCurrency(line.unit_price)}
      </td>
      <td className="px-3 py-2 align-top text-sm tabular-nums">
        {formatCurrency(line.total_price)}
      </td>
      <td className="px-3 py-2 align-top text-right">
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removeLine}
            disabled={busy}
          >
            Remove
          </Button>
        )}
      </td>
    </tr>
  )
}
