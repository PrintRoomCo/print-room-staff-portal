'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface OrdersListRow {
  id: string
  status: string
  total_price: number | null
  placed_at: string | null
  order_ref: string | null
  org_name: string | null
  required_by: string | null
  line_count: number | null
}

export interface OrdersListFilters {
  status: string
  org_id: string
  from: string
  to: string
  page: number
}

export const ORDERS_PAGE_SIZE = 25

const STATUS_OPTIONS = [
  'awaiting-production',
  'in-production',
  'fulfilled',
  'shipped',
  'cancelled',
]

function formatDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: '2-digit' })
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'awaiting-production':
      return 'bg-amber-100 text-amber-800'
    case 'in-production':
      return 'bg-blue-100 text-blue-800'
    case 'fulfilled':
      return 'bg-emerald-100 text-emerald-800'
    case 'shipped':
      return 'bg-indigo-100 text-indigo-800'
    case 'cancelled':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function buildQuery(f: OrdersListFilters): string {
  const p = new URLSearchParams()
  if (f.status) p.set('status', f.status)
  if (f.org_id) p.set('org_id', f.org_id)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.page > 1) p.set('page', String(f.page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function OrdersList({
  rows,
  total,
  filters,
}: {
  rows: OrdersListRow[]
  total: number
  filters: OrdersListFilters
}) {
  const router = useRouter()
  const [f, setF] = useState<OrdersListFilters>(filters)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Reset to page 1 on filter submit.
    router.push(`/orders${buildQuery({ ...f, page: 1 })}`)
  }

  function clearAll() {
    const cleared: OrdersListFilters = { status: '', org_id: '', from: '', to: '', page: 1 }
    setF(cleared)
    router.push('/orders')
  }

  const pageSize = ORDERS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.max(1, filters.page)
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages
  const firstRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastRow = Math.min(currentPage * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/orders/new">
          <Button>New order</Button>
        </Link>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-2 p-3 border rounded"
      >
        <div className="flex flex-col">
          <label className="text-xs text-gray-500" htmlFor="orders-status-filter">
            Status
          </label>
          <select
            id="orders-status-filter"
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value })}
            className="border rounded p-1 text-sm"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500" htmlFor="orders-org-filter">
            Org ID
          </label>
          <Input
            id="orders-org-filter"
            value={f.org_id}
            onChange={(e) => setF({ ...f, org_id: e.target.value })}
            placeholder="organization uuid"
            className="text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500" htmlFor="orders-from-filter">
            From
          </label>
          <Input
            id="orders-from-filter"
            type="date"
            value={f.from}
            onChange={(e) => setF({ ...f, from: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500" htmlFor="orders-to-filter">
            To
          </label>
          <Input
            id="orders-to-filter"
            type="date"
            value={f.to}
            onChange={(e) => setF({ ...f, to: e.target.value })}
            className="text-sm"
          />
        </div>
        <Button type="submit">Apply</Button>
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-gray-500 hover:underline"
        >
          Clear
        </button>
      </form>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Order ref</th>
              <th className="px-3 py-2">Organisation</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Required by</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/orders/${r.id}`} className="text-blue-600 hover:underline">
                      {r.order_ref ?? r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.org_name ?? '—'}</td>
                  <td className="px-3 py-2">{formatDate(r.placed_at)}</td>
                  <td className="px-3 py-2">{formatDate(r.required_by)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.line_count == null ? '—' : r.line_count}
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(r.total_price)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${statusPillClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          {total === 0
            ? 'No results'
            : `Showing ${firstRow}–${lastRow} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          {hasPrev ? (
            <Link
              href={`/orders${buildQuery({ ...filters, page: currentPage - 1 })}`}
              className="border rounded px-3 py-1 hover:bg-gray-50"
            >
              Prev
            </Link>
          ) : (
            <span className="border rounded px-3 py-1 text-gray-300 cursor-not-allowed">
              Prev
            </span>
          )}
          <span>
            Page {currentPage} / {totalPages}
          </span>
          {hasNext ? (
            <Link
              href={`/orders${buildQuery({ ...filters, page: currentPage + 1 })}`}
              className="border rounded px-3 py-1 hover:bg-gray-50"
            >
              Next
            </Link>
          ) : (
            <span className="border rounded px-3 py-1 text-gray-300 cursor-not-allowed">
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
