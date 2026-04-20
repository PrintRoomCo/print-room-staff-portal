import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(request: Request) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 50)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))
  const { data, error } = await auth.admin.rpc('inventory_events_search', {
    p_org_id: p.get('org_id') || null,
    p_product_id: p.get('product_id') || null,
    p_variant_id: p.get('variant_id') || null,
    p_reason: p.get('reason') || null,
    p_staff_user_id: p.get('staff_user_id') || null,
    p_from: p.get('from') || null,
    p_to: p.get('to') || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const total = Number(data?.[0]?.total_count ?? 0)
  return NextResponse.json({ events: data ?? [], total, limit, offset })
}
