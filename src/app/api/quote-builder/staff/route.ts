import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const permissions = (staff.permissions as string[]) || []
  const hasAccess = staff.role === 'admin' || staff.role === 'super_admin' || permissions.includes('quote-tool')

  if (!hasAccess) {
    return NextResponse.json({ error: 'Missing quote-tool permission' }, { status: 403 })
  }

  const { data: staffUsers, error } = await admin
    .from('staff_users')
    .select('id, display_name, email')
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch staff users' }, { status: 500 })
  }

  return NextResponse.json({
    staff: (staffUsers || []).map((staffUser) => ({
      id: staffUser.id,
      displayName: staffUser.display_name,
      email: staffUser.email,
    })),
  })
}
