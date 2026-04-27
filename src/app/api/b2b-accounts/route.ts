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

  const [accountResult, stockedResult] = await Promise.all([
    auth.admin
      .from('b2b_accounts')
      .select(
        'id, organization_id, tier_level, payment_terms, credit_limit, default_deposit_percent, is_trusted, platform, is_active, created_at',
      )
      .eq('organization_id', organizationId)
      .maybeSingle(),
    auth.admin
      .from('variant_inventory')
      .select('variant_id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ])

  if (accountResult.error) {
    return NextResponse.json({ error: accountResult.error.message }, { status: 500 })
  }

  const stocked = (stockedResult.count ?? 0) > 0

  return NextResponse.json({
    account: accountResult.data ?? null,
    stocked,
  })
}

interface CreateBody {
  organization_id?: string
  tier_level?: number
  payment_terms?: string
  default_deposit_percent?: number
  is_trusted?: boolean
  credit_limit?: number | null
  platform?: string
}

export async function POST(request: Request) {
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) return auth.error

  let body: CreateBody = {}
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const insertRow = {
    organization_id: body.organization_id,
    tier_level: body.tier_level ?? 3,
    payment_terms: body.payment_terms ?? 'net30',
    default_deposit_percent: body.default_deposit_percent ?? 0,
    is_trusted: body.is_trusted ?? false,
    credit_limit: body.credit_limit ?? null,
    platform: body.platform ?? 'print-room',
    is_active: true,
  }

  const { data, error } = await auth.admin
    .from('b2b_accounts')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
