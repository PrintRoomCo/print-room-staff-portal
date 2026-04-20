import { NextRequest, NextResponse } from 'next/server'
import { requireProductsStaffAccess } from '@/lib/products/server'
import { readTagCatalog } from '@/lib/products/tag-catalog'

export async function GET(request: NextRequest) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const prefix = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const names = await readTagCatalog(access.admin, prefix || null)
  return NextResponse.json({ tags: names })
}
