import Link from 'next/link'

interface Event {
  id: string
  created_at: string
  organization_name: string | null
  product_name: string | null
  color_label: string | null
  size_label: string | null
  reason: string
  delta_stock: number
  delta_committed: number
  note: string | null
  staff_display_name: string | null
  reference_quote_item_id: string | null
}

export function EventsTable({
  events, total, limit, offset, currentQuery,
}: {
  events: Event[]; total: number; limit: number; offset: number
  currentQuery: Record<string, string | string[] | undefined>
}) {
  function pageHref(nextOffset: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(currentQuery)) {
      if (k === 'offset' || k === 'limit') continue
      if (typeof v === 'string' && v.length > 0) params.set(k, v)
    }
    params.set('limit', String(limit))
    params.set('offset', String(nextOffset))
    return `/inventory/events?${params.toString()}`
  }

  const hasPrev = offset > 0
  const hasNext = offset + events.length < total

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-500 mb-2">
        {total} total{events.length > 0 ? ` \u00b7 showing ${offset + 1}\u2013${offset + events.length}` : ''}
      </div>
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Customer</th>
            <th className="p-2">Product / Variant</th>
            <th className="p-2">Reason</th>
            <th className="p-2 text-right">&Delta; stock</th>
            <th className="p-2 text-right">&Delta; committed</th>
            <th className="p-2">Note</th>
            <th className="p-2">Staff</th>
            <th className="p-2">Quote item</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-2 text-gray-600">{new Date(e.created_at).toLocaleString('en-NZ')}</td>
              <td className="p-2">{e.organization_name ?? '\u2014'}</td>
              <td className="p-2">
                {e.product_name ?? '\u2014'}
                {(e.color_label || e.size_label) && (
                  <span className="text-gray-500"> \u00b7 {e.color_label ?? ''} {e.size_label ?? ''}</span>
                )}
              </td>
              <td className="p-2">{e.reason}</td>
              <td className="p-2 text-right tabular-nums">{e.delta_stock}</td>
              <td className="p-2 text-right tabular-nums">{e.delta_committed}</td>
              <td className="p-2">{e.note ?? ''}</td>
              <td className="p-2">{e.staff_display_name ?? ''}</td>
              <td className="p-2 text-xs text-gray-500">
                {e.reference_quote_item_id ? (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 font-mono">
                    {e.reference_quote_item_id.slice(0, 8)}
                  </span>
                ) : ''}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-gray-500">No events match these filters.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex gap-2 mt-4 text-sm">
        {hasPrev && <Link href={pageHref(Math.max(0, offset - limit))} className="underline">&larr; Prev</Link>}
        {hasNext && <Link href={pageHref(offset + limit)} className="underline ml-auto">Next &rarr;</Link>}
      </div>
    </div>
  )
}
