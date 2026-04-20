import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET() {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin.rpc('inventory_orgs_summary')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    variantCount: Number(r.variant_count),
    totalStock: Number(r.total_stock),
    totalCommitted: Number(r.total_committed),
    lastEventAt: r.last_event_at,
  }))
  return NextResponse.json({ orgs: mapped })
}
