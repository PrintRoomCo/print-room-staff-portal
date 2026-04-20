'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LineEditRow, type OrderLine } from '@/components/orders/LineEditRow'
import { PRODUCTION_BOARD_ID } from '@/lib/monday/column-ids'

export interface OrderDetailHeader {
  id: string
  order_ref: string | null
  org_name: string | null
  status: string
  placed_at: string | null
  total_price: number | null
  monday_item_id: string | null
}

interface Props {
  order: OrderDetailHeader
  lines: OrderLine[]
  isShipped: boolean
}

function formatDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `$${Number(n).toFixed(2)}`
}

function mondayPulseUrl(itemId: string): string {
  return `https://theprintroom.monday.com/boards/${PRODUCTION_BOARD_ID}/pulses/${itemId}`
}

export function OrderDetailClient({ order, lines, isShipped }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const editsDisabled = isShipped || order.status === 'cancelled'

  async function copyRef() {
    if (!order.order_ref) return
    try {
      await navigator.clipboard.writeText(order.order_ref)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Swallow — clipboard denial is not fatal.
    }
  }

  async function cancelOrder() {
    if (
      !window.confirm(
        'Cancel this order? All reserved stock will be released. This cannot be undone.',
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to cancel order.')
        return
      }
      setInfo('Order cancelled.')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function retryMondayPush() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/monday-reconcile`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to push to Monday.')
        return
      }
      setInfo('Monday push triggered.')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500">
        <a href="/orders" className="hover:underline">
          Orders
        </a>{' '}
        ›{' '}
        <span>{order.order_ref ?? order.id}</span>
      </div>

      {isShipped && (
        <div className="rounded border border-yellow-300 bg-yellow-50 text-yellow-900 px-4 py-3 text-sm">
          Some items shipped — edits disabled.
        </div>
      )}
      {order.status === 'cancelled' && !isShipped && (
        <div className="rounded border border-gray-300 bg-gray-50 text-gray-700 px-4 py-3 text-sm">
          Order is cancelled — edits disabled.
        </div>
      )}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded border border-green-300 bg-green-50 text-green-800 px-4 py-3 text-sm">
          {info}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  {order.order_ref ?? 'Order'}
                  {order.order_ref && (
                    <button
                      type="button"
                      className="text-xs font-normal text-blue-600 hover:text-blue-800 underline"
                      onClick={copyRef}
                    >
                      {copied ? 'Copied!' : 'Copy ref'}
                    </button>
                  )}
                </h1>
                <div className="text-sm text-gray-500 mt-1">
                  {order.org_name ?? 'Unknown org'}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="font-medium capitalize">
                    {order.status.replace(/[-_]/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Placed:</span>{' '}
                  {formatDate(order.placed_at)}
                </div>
                <div className="text-lg font-semibold mt-2 tabular-nums">
                  {formatCurrency(order.total_price)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line items</h2>
              <span className="text-xs text-gray-500">
                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
              </span>
            </div>
            {lines.length === 0 ? (
              <div className="px-6 py-8 text-sm text-gray-500">
                No lines on this order.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Variant</th>
                    <th className="px-3 py-2 text-left">Qty</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-left">Total</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <LineEditRow
                      key={line.id}
                      orderId={order.id}
                      line={line}
                      disabled={editsDisabled}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold">External links</h3>
            <div>
              <div className="text-xs text-gray-500">Monday.com</div>
              {order.monday_item_id ? (
                <a
                  href={mondayPulseUrl(order.monday_item_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                >
                  Open pulse
                </a>
              ) : (
                <div className="text-sm text-gray-400">
                  Not yet pushed.
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={retryMondayPush}
                      disabled={busy}
                    >
                      Retry Monday push
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">Xero</div>
              <div className="text-sm text-gray-400">
                <button
                  type="button"
                  disabled
                  className="text-sm text-gray-400 cursor-not-allowed"
                  title="Xero integration not available in v1"
                >
                  Open in Xero (v1: not linked)
                </button>
              </div>
            </div>
          </div>

          {!editsDisabled && (
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
              <p className="text-xs text-gray-500">
                Cancelling releases all reserved stock and marks the order
                cancelled. Shipped lines block cancellation.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={cancelOrder}
                disabled={busy}
              >
                Cancel order
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
