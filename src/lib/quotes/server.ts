import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface QuotesStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  canApprove: boolean
  displayName: string
}

export async function requireQuotesStaffAccess(
  opts: { needApproval?: boolean } = {}
) {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = getSupabaseAdmin()
  const { data: staff, error } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (error || !staff) return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }

  const typed = staff as StaffRow
  const perms = Array.isArray(typed.permissions) ? typed.permissions : []
  const isAdmin = typed.role === 'admin' || typed.role === 'super_admin'
  const hasWrite =
    perms.includes('quotes:write') ||
    perms.includes('quote-tool') // legacy sidebar key
  const canApprove = isAdmin || perms.includes('quotes:approve')

  if (!isAdmin && !hasWrite) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }
  if (opts.needApproval && !canApprove) {
    return { error: NextResponse.json({ error: 'Approval permission required' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typed.id,
      role: typed.role,
      isAdmin,
      canApprove,
      displayName: typed.display_name,
    } satisfies QuotesStaffContext,
  }
}
