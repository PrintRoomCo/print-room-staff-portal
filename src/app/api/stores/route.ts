import { NextResponse } from 'next/server'
import { requireB2BAccountsStaffAccess } from '@/lib/b2b-accounts/server'

export async function GET(request: Request) {
  const auth = await requireB2BAccountsStaffAccess()
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

interface CreateStoreBody {
  organization_id?: string
  name?: string
  location?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  phone?: string
  email?: string
  manager_name?: string
}

export async function POST(request: Request) {
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) return auth.error

  let body: CreateStoreBody = {}
  try {
    body = (await request.json()) as CreateStoreBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.name) {
    return NextResponse.json(
      { error: 'organization_id and name are required' },
      { status: 400 },
    )
  }

  const insertRow = {
    organization_id: body.organization_id,
    name: body.name,
    location: body.location ?? null,
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    country: body.country ?? null,
    postal_code: body.postal_code ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    manager_name: body.manager_name ?? null,
  }

  const { data, error } = await auth.admin
    .from('stores')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
