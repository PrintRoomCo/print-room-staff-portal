import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { data, error } = await admin
    .from('b2b_catalogues')
    .select('id, name, is_active, created_at, items:b2b_catalogue_items(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ catalogues: data ?? [] })
}
