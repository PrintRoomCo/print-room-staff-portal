import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let query = admin
    .from('staff_quotes')
    .select('*')
    .eq('id', id)

  const isAdmin = staff.role === 'admin' || staff.role === 'super_admin'
  if (!isAdmin) {
    query = query.eq('staff_user_id', staff.id)
  }

  const { data: quote, error: quoteError } = await query.single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  return NextResponse.json({ quote })
}
