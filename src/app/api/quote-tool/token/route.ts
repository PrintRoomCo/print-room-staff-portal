import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST() {
  // Authenticate the staff user
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify staff access and quote-tool permission
  const admin = getSupabaseAdmin()
  const { data: staff, error } = await admin
    .from('staff_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (error || !staff) {
    return NextResponse.json(
      { error: 'Access denied. No staff account found.' },
      { status: 403 }
    )
  }

  const hasPermission =
    staff.role === 'admin' ||
    staff.role === 'super_admin' ||
    (staff.permissions as string[])?.includes('quote-tool')

  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Missing quote-tool permission' },
      { status: 403 }
    )
  }

  // Generate a staff JWT for the design tool
  const secret = process.env.STAFF_QUOTE_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const portalOrigin = process.env.NEXT_PUBLIC_APP_URL || ''
  const encodedSecret = new TextEncoder().encode(secret)

  const token = await new SignJWT({
    staffId: staff.id,
    staffEmail: staff.email,
    staffName: staff.display_name,
    portalOrigin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(encodedSecret)

  return NextResponse.json({ token })
}
