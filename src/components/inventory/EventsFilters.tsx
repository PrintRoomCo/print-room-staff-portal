'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface F {
  org_id: string; reason: string; staff_user_id: string
  variant_id: string; product_id: string; from: string; to: string
}

const REASONS = ['intake', 'count_correction', 'damage_writeoff', 'order_commit', 'order_release', 'order_ship']

export function EventsFilters({ initial }: { initial: F }) {
  const [f, setF] = useState<F>(initial)
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) {
      if (v && v.length > 0) params.set(k, v)
    }
    router.push(`/inventory/events${params.toString() ? '?' + params.toString() : ''}`)
  }

  function clearAll() {
    setF({ org_id: '', reason: '', staff_user_id: '', variant_id: '', product_id: '', from: '', to: '' })
    router.push('/inventory/events')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 p-3 border rounded">
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Reason</label>
        <select
          value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })}
          className="border rounded p-1 text-sm"
        >
          <option value="">All</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Org ID</label>
        <Input
          value={f.org_id}
          onChange={(e) => setF({ ...f, org_id: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Product ID</label>
        <Input
          value={f.product_id}
          onChange={(e) => setF({ ...f, product_id: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Variant ID</label>
        <Input
          value={f.variant_id}
          onChange={(e) => setF({ ...f, variant_id: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Staff user ID</label>
        <Input
          value={f.staff_user_id}
          onChange={(e) => setF({ ...f, staff_user_id: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">From (ISO)</label>
        <Input
          value={f.from}
          onChange={(e) => setF({ ...f, from: e.target.value })}
          placeholder="2026-04-01"
          className="text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">To (ISO)</label>
        <Input
          value={f.to}
          onChange={(e) => setF({ ...f, to: e.target.value })}
          placeholder="2026-04-30"
          className="text-sm"
        />
      </div>
      <Button type="submit">Apply</Button>
      <button type="button" onClick={clearAll} className="text-sm text-gray-500 hover:underline">
        Clear
      </button>
    </form>
  )
}
