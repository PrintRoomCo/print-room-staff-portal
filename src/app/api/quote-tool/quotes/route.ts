import { NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export async function GET(request: Request) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error

  const p = new URL(request.url).searchParams
  const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 25)))
  const offset = Math.max(0, Number(p.get('offset') ?? 0))
  const mineOnly = p.get('mine') === '1'
  const status = p.get('status')

  let q = auth.admin
    .from('staff_quotes')
    .select(
      'id, customer_name, customer_email, customer_company, status, subtotal, discount_percent, total, staff_notes, monday_item_id, approved_at, created_at, updated_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!auth.context.isAdmin || mineOnly) q = q.eq('staff_user_id', auth.context.staffId)
  if (status) q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data ?? [], total: count ?? 0, limit, offset })
}
