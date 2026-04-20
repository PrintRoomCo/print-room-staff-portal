import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { EventsTable } from '@/components/inventory/EventsTable'
import { EventsFilters } from '@/components/inventory/EventsFilters'

export const dynamic = 'force-dynamic'

function str(v: string | string[] | undefined) {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export default async function EventsLogPage(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const sp = await searchParams
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) redirect('/dashboard')

  const limit = Math.min(200, Math.max(1, Number(sp.limit ?? 50)))
  const offset = Math.max(0, Number(sp.offset ?? 0))

  const { data, error } = await auth.admin.rpc('inventory_events_search', {
    p_org_id: str(sp.org_id),
    p_product_id: str(sp.product_id),
    p_variant_id: str(sp.variant_id),
    p_reason: str(sp.reason),
    p_staff_user_id: str(sp.staff_user_id),
    p_from: str(sp.from),
    p_to: str(sp.to),
    p_limit: limit,
    p_offset: offset,
  })

  const events = (data ?? []) as any[]
  const total = Number(events[0]?.total_count ?? 0)

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500">Inventory</div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
      </div>

      <EventsFilters initial={{
        org_id: str(sp.org_id) ?? '',
        reason: str(sp.reason) ?? '',
        staff_user_id: str(sp.staff_user_id) ?? '',
        variant_id: str(sp.variant_id) ?? '',
        product_id: str(sp.product_id) ?? '',
        from: str(sp.from) ?? '',
        to: str(sp.to) ?? '',
      }} />

      {error ? (
        <div className="text-red-600 text-sm">Error: {error.message}</div>
      ) : (
        <EventsTable
          events={events}
          total={total}
          limit={limit}
          offset={offset}
          currentQuery={sp}
        />
      )}
    </div>
  )
}
