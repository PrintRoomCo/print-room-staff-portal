import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Get the user from the session cookie / auth header
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  })

  // Try to get user from cookie-based session
  const cookieHeader = request.headers.get('cookie')
  let userId: string | null = null

  // Use service role to look up by cookie session
  if (cookieHeader) {
    // Extract the access token from cookies
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )

    // Supabase stores tokens in cookies with project ref prefix
    const accessTokenKey = Object.keys(cookies).find(k =>
      k.includes('auth-token') || k.includes('access-token')
    )

    if (accessTokenKey) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(cookies[accessTokenKey]))
        const accessToken = Array.isArray(tokenData) ? tokenData[0] : tokenData
        const { data: { user } } = await supabaseAuth.auth.getUser(accessToken)
        userId = user?.id ?? null
      } catch {
        // Token parsing failed
      }
    }
  }

  // Fallback: try auth header
  if (!userId && authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAuth.auth.getUser(token)
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up staff_users record using service role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { data: staff, error } = await supabaseAdmin
    .from('staff_users')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !staff) {
    return NextResponse.json(
      { error: 'Access denied. No staff account found.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ staff })
}
