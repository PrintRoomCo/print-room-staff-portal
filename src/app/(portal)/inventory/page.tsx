import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { OrgCard } from '@/components/inventory/OrgCard'
import { TrackOrgPicker } from '@/components/inventory/TrackOrgPicker'

export const dynamic = 'force-dynamic'

interface OrgSummaryRow {
  id: string
  name: string
  variant_count: number | string
  total_stock: number | string
  total_committed: number | string
  last_event_at: string | null
}

export default async function InventoryLandingPage() {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) {
    redirect('/dashboard')
  }

  const { data } = await auth.admin.rpc('inventory_orgs_summary')
  const rows = (data ?? []) as OrgSummaryRow[]
  const orgs = rows.map((r) => ({
    id: r.id,
    name: r.name,
    variantCount: Number(r.variant_count),
    totalStock: Number(r.total_stock),
    totalCommitted: Number(r.total_committed),
    lastEventAt: r.last_event_at,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <TrackOrgPicker />
      </div>

      {orgs.length === 0 ? (
        <div className="text-gray-500">No customers have tracked stock yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((o) => (
            <Link key={o.id} href={`/inventory/${o.id}`}>
              <OrgCard org={o} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
