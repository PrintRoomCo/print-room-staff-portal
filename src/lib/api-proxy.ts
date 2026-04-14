import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  }

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

async function verifyStaffAuth(
  request: NextRequest,
  requiredPermission: string
): Promise<{ error?: string; status: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Extract access token from cookies
  const cookieHeader = request.headers.get('cookie') ?? ''
  let userId: string | null = null

  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )

    const accessTokenKey = Object.keys(cookies).find(k =>
      k.includes('auth-token') || k.includes('access-token')
    )

    if (accessTokenKey) {
      try {
        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
        const tokenData = JSON.parse(decodeURIComponent(cookies[accessTokenKey]))
        const accessToken = Array.isArray(tokenData) ? tokenData[0] : tokenData
        const { data: { user } } = await supabaseAuth.auth.getUser(accessToken)
        userId = user?.id ?? null
      } catch {
        // Token parsing failed
      }
    }
  }

  if (!userId) {
    return { error: 'Unauthorized', status: 401 }
  }

  // Check staff permissions
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { data: staff } = await supabaseAdmin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!staff) {
    return { error: 'Access denied', status: 403 }
  }

  // Super admins have all permissions
  if (staff.role === 'super_admin') {
    return { status: 200 }
  }

  const permissions = staff.permissions as string[]
  if (!permissions.includes(requiredPermission)) {
    return { error: 'Insufficient permissions', status: 403 }
  }

  return { status: 200 }
}
