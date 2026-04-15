import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import type { StaffPermission, StaffRole } from '@/types/staff'

interface StaffRow {
  id: string
  role: StaffRole
  permissions: StaffPermission[] | string[] | null
  display_name: string
}

export interface PresentationStaffContext {
  userId: string
  staffId: string
  role: StaffRole
  isAdmin: boolean
  displayName: string
}

export async function requirePresentationStaffAccess(requiredPermission: StaffPermission = 'presentations') {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const admin = getSupabaseAdmin()
  const { data: staff, error: staffError } = await admin
    .from('staff_users')
    .select('id, role, permissions, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return {
      error: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    }
  }

  const typedStaff = staff as StaffRow
  const permissions = Array.isArray(typedStaff.permissions) ? typedStaff.permissions : []
  const isAdmin = typedStaff.role === 'admin' || typedStaff.role === 'super_admin'

  if (!isAdmin && !permissions.includes(requiredPermission)) {
    return {
      error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    }
  }

  return {
    admin,
    context: {
      userId: user.id,
      staffId: typedStaff.id,
      role: typedStaff.role,
      isAdmin,
      displayName: typedStaff.display_name,
    } satisfies PresentationStaffContext,
  }
}

export async function requireAccessiblePresentation(
  presentationId: string,
  context: PresentationStaffContext
) {
  const admin = getSupabaseAdmin()
  let query = admin
    .from('staff_presentations')
    .select('*')
    .eq('id', presentationId)

  if (!context.isAdmin) {
    query = query.eq('staff_user_id', context.staffId)
  }

  const { data: presentation, error } = await query.single()

  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return {
      error: presentationDbErrorResponse(error, 'Presentations is not set up in Supabase yet.'),
    }
  }

  if (error || !presentation) {
    return {
      error: NextResponse.json({ error: 'Presentation not found' }, { status: 404 }),
    }
  }

  return { presentation }
}

export function presentationDbErrorResponse(error: { code?: string; message?: string } | null, fallbackMessage: string) {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return NextResponse.json(
      {
        error: 'Presentations is not set up in Supabase yet. Run sql/002_staff_presentations.sql and refresh.',
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
