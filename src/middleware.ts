import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/callback') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // Check for Supabase auth cookie
  const cookieHeader = request.headers.get('cookie') ?? ''
  const hasAuthCookie = cookieHeader.includes('auth-token') || cookieHeader.includes('sb-')

  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
