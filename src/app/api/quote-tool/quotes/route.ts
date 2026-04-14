import { NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const isAdmin = staff.role === 'admin' || staff.role === 'super_admin'

  // Admins see all quotes, staff see only their own
  let query = admin
    .from('staff_quotes')
    .select('id, customer_name, customer_email, customer_company, status, subtotal, discount_percent, total, staff_notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!isAdmin) {
    query = query.eq('staff_user_id', staff.id)
  }

  const { data: quotes, error: quotesError } = await query

  if (quotesError) {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }

  return NextResponse.json({ quotes: quotes || [] })
}
