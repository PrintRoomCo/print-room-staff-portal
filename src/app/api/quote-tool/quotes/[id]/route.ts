import { NextRequest, NextResponse } from 'next/server'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  let q = auth.admin.from('staff_quotes').select('*').eq('id', id)
  if (!auth.context.isAdmin) q = q.eq('staff_user_id', auth.context.staffId)

  const { data, error } = await q.single()
  if (error || !data) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ quote: data })
}
