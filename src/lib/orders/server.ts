import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface OrdersStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

/**
 * Authorises a request against the orders sub-app.
 *
 * Access rule: role is admin/super_admin OR permissions array contains
 * either 'orders' (sidebar permission key) or 'orders:write' (the
 * spec's explicit write key — accepted for forward-compat with v1.1
 * which may split read vs write).
 */
export async function requireOrdersStaffAccess() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  const typedStaff = staff as StaffRow
  const permissions = Array.isArray(typedStaff.permissions) ? typedStaff.permissions : []
  const isAdmin = typedStaff.role === 'admin' || typedStaff.role === 'super_admin'
  const hasOrdersPerm =
    permissions.includes('orders') || permissions.includes('orders:write')

  if (!isAdmin && !hasOrdersPerm) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typedStaff.id,
      role: typedStaff.role,
      isAdmin,
      displayName: typedStaff.display_name,
    } satisfies OrdersStaffContext,
  }
}
