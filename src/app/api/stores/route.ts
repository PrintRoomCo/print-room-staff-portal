import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function GET(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error

  const organizationId = new URL(request.url).searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id query parameter is required' },
      { status: 400 },
    )
  }

  const { data, error } = await auth.admin
    .from('stores')
    .select(
      'id, name, location, address, city, state, country, postal_code, phone, email, manager_name',
    )
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ stores: data ?? [] })
}
