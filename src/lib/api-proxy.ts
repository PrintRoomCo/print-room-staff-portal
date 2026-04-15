import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

/**
 * Validates that the request comes from an authenticated staff user
 * with the required permission, then proxies the request to the target API.
 */
export async function proxyRequest(
  request: NextRequest,
  targetBaseUrl: string,
  path: string,
  requiredPermission: string
): Promise<NextResponse> {
  // Verify staff auth
  const authResult = await verifyStaffAuth(request, requiredPermission)
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  // Build target URL
  const targetUrl = new URL(`/api/${path}`, targetBaseUrl)
  const searchParams = request.nextUrl.searchParams
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value)
  })

  // Forward the request
  const headers: Record<string, string> = {
    'X-Internal-API-Key': process.env.INTERNAL_API_KEY!,
    'X-Source-Portal': 'staff-portal',
  }

  if (authResult.userId) headers['X-Staff-User-Id'] = authResult.userId
  if (authResult.userEmail) headers['X-Staff-User-Email'] = authResult.userEmail
  if (authResult.displayName) headers['X-Staff-User-Name'] = authResult.displayName

  // Forward content-type for POST/PUT/PATCH
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers['Content-Type'] = contentType
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  }

  // Forward body for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Handle both JSON and FormData
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData()
      fetchOptions.body = formData
      // Remove content-type so fetch can set it with boundary
      delete headers['Content-Type']
    } else {
      fetchOptions.body = await request.text()
    }
  }

  try {
    const response = await fetch(targetUrl.toString(), fetchOptions)
    const data = await response.text()

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reach upstream service' },
      { status: 502 }
    )
  }
}

interface StaffAuthResult {
  error?: string
  status: number
  userId?: string
  userEmail?: string
  displayName?: string
}

async function verifyStaffAuth(
  _request: NextRequest,
  requiredPermission: string
): Promise<StaffAuthResult> {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const admin = getSupabaseAdmin()
  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) {
    return { error: 'Access denied', status: 403 }
  }

  // Super admins have all permissions
  if (staff.role === 'super_admin') {
    return { status: 200, userId: user.id, userEmail: user.email, displayName: staff.display_name }
  }

  const permissions = staff.permissions as string[]
  if (!permissions.includes(requiredPermission)) {
    return { error: 'Insufficient permissions', status: 403 }
  }

  return { status: 200, userId: user.id, userEmail: user.email, displayName: staff.display_name }
}
