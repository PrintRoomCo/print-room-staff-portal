'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface VariantSummary {
  variant_id: string
  color_label: string | null
  size_label: string | null
  stock_qty: number
  committed_qty: number
  available_qty: number
}

interface EventRow {
  id: string
  created_at: string
  reason: string
  delta_stock: number
  delta_committed: number
  note: string | null
  staff_display_name: string | null
}

export function AdjustDrawer({
  orgId,
  variant,
  onClose,
}: {
  orgId: string
  productId: string
  variant: VariantSummary
  onClose: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'receive' | 'recount' | 'writeoff'>('receive')
  const [events, setEvents] = useState<EventRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/inventory/events?variant_id=${variant.variant_id}&limit=10`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        if (!cancelled) setEvents(d.events ?? [])
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [variant.variant_id])

  async function submitReceive(qty: number, note: string) {
    setBusy(true)
    setErr(null)
    const r = await fetch(
      `/api/inventory/${orgId}/variants/${variant.variant_id}/adjust`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: qty, reason: 'intake', note: note || null }),
      }
    )
    setBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setErr(j.error ?? 'Failed')
      return
    }
    router.refresh()
    onClose()
  }

  async function submitRecount(absolute: number, note: string) {
    setBusy(true)
    setErr(null)
    const r = await fetch(
      `/api/inventory/${orgId}/variants/${variant.variant_id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absolute_stock_qty: absolute, note }),
      }
    )
    setBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setErr(j.error ?? 'Failed')
      return
    }
    router.refresh()
    onClose()
  }

  async function submitWriteOff(qty: number, note: string) {
    setBusy(true)
    setErr(null)
    const r = await fetch(
      `/api/inventory/${orgId}/variants/${variant.variant_id}/adjust`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delta: -qty,
          reason: 'damage_writeoff',
          note,
        }),
      }
    )
    setBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setErr(j.error ?? 'Failed')
      return
    }
    router.refresh()
    onClose()
  }

  async function untrack() {
    if (!confirm('Untrack this variant? Inventory data will be removed.')) return
    setBusy(true)
    setErr(null)
    const r = await fetch(
      `/api/inventory/${orgId}/variants/${variant.variant_id}`,
      { method: 'DELETE' }
    )
    setBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setErr(j.error ?? 'Failed')
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-lg p-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500">
              {variant.color_label ?? '—'} · {variant.size_label ?? '—'}
            </div>
            <div className="text-lg font-semibold">
              {variant.stock_qty} on hand · {variant.committed_qty} committed
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 mb-4 text-sm">
          <button
            onClick={() => setTab('receive')}
            className={`px-3 py-1 rounded ${
              tab === 'receive' ? 'bg-gray-900 text-white' : 'bg-gray-100'
            }`}
          >
            Receive
          </button>
          <button
            onClick={() => setTab('recount')}
            className={`px-3 py-1 rounded ${
              tab === 'recount' ? 'bg-gray-900 text-white' : 'bg-gray-100'
            }`}
          >
            Recount
          </button>
          <button
            onClick={() => setTab('writeoff')}
            className={`px-3 py-1 rounded ${
              tab === 'writeoff' ? 'bg-gray-900 text-white' : 'bg-gray-100'
            }`}
          >
            Write off
          </button>
        </div>

        {err && <div className="text-sm text-red-600 mb-2">{err}</div>}

        {tab === 'receive' && <ReceiveForm busy={busy} onSubmit={submitReceive} />}
        {tab === 'recount' && (
          <RecountForm
            currentStock={variant.stock_qty}
            busy={busy}
            onSubmit={submitRecount}
          />
        )}
        {tab === 'writeoff' && (
          <WriteOffForm busy={busy} onSubmit={submitWriteOff} />
        )}

        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <a
              href={`/inventory/events?variant_id=${variant.variant_id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all in log
            </a>
          </div>
          <div className="space-y-1 text-xs">
            {events.length === 0 && (
              <div className="text-gray-500">No events yet.</div>
            )}
            {events.map((e) => (
              <div key={e.id} className="flex justify-between">
                <span>
                  {e.reason} · Δstock {e.delta_stock} · Δcomm{' '}
                  {e.delta_committed}
                </span>
                <span className="text-gray-400">
                  {new Date(e.created_at).toLocaleDateString('en-NZ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <button
            onClick={untrack}
            disabled={busy || variant.committed_qty > 0}
            className="text-red-600 text-sm disabled:text-gray-400 hover:underline"
            title={
              variant.committed_qty > 0
                ? 'Cannot untrack while committed > 0'
                : undefined
            }
          >
            Untrack this variant
          </button>
        </div>
      </div>
    </div>
  )
}

function ReceiveForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (qty: number, note: string) => void
}) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const valid = /^\d+$/.test(qty) && Number(qty) > 0
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(Number(qty), note)
      }}
      className="space-y-2"
    >
      <Input
        placeholder="Quantity received"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        inputMode="numeric"
      />
      <Input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" disabled={!valid || busy}>
        Receive
      </Button>
    </form>
  )
}

function RecountForm({
  currentStock,
  busy,
  onSubmit,
}: {
  currentStock: number
  busy: boolean
  onSubmit: (absolute: number, note: string) => void
}) {
  const [qty, setQty] = useState(String(currentStock))
  const [note, setNote] = useState('')
  const valid = /^\d+$/.test(qty) && Number(qty) >= 0 && note.trim().length > 0
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(Number(qty), note)
      }}
      className="space-y-2"
    >
      <Input
        placeholder="Absolute on-hand count"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        inputMode="numeric"
      />
      <Input
        placeholder="Note (required)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" disabled={!valid || busy}>
        Recount
      </Button>
    </form>
  )
}

function WriteOffForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (qty: number, note: string) => void
}) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const valid = /^\d+$/.test(qty) && Number(qty) > 0 && note.trim().length > 0
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(Number(qty), note)
      }}
      className="space-y-2"
    >
      <Input
        placeholder="Quantity written off"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        inputMode="numeric"
      />
      <Input
        placeholder="Reason / note (required)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" disabled={!valid || busy}>
        Write off
      </Button>
    </form>
  )
}
