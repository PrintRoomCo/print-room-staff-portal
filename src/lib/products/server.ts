import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface ProductsStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

/**
 * Authorises a request against the products sub-app.
 *
 * Access rule: role is admin/super_admin OR permissions array contains
 * either 'products' (sidebar permission key) or 'products:write' (the
 * spec's explicit write key — accepted for forward-compat with v1.1
 * which may split read vs write).
 */
export async function requireProductsStaffAccess() {
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
  const hasProductsPerm =
    permissions.includes('products') || permissions.includes('products:write')

  if (!isAdmin && !hasProductsPerm) {
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
    } satisfies ProductsStaffContext,
  }
}

/**
 * Loads a product (UUID) verifying it is in the v1 platform scope.
 * Returns either { product } or { error: NextResponse }.
 */
export async function requireUniformsProduct(productId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('products')
    .select('id, name, tags, platform')
    .eq('id', productId)
    .eq('platform', 'uniforms')
    .single()

  if (error || !data) {
    return { error: NextResponse.json({ error: 'Product not found' }, { status: 404 }) }
  }

  return { product: data }
}

export function dbErrorResponse(
  error: { code?: string; message?: string } | null,
  fallbackMessage: string,
  status = 500
) {
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Duplicate value (unique constraint).' }, { status: 409 })
  }
  return NextResponse.json({ error: fallbackMessage }, { status })
}
