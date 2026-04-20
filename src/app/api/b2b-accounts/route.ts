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

  const [accountResult, stockedResult] = await Promise.all([
    auth.admin
      .from('b2b_accounts')
      .select('tier_level, payment_terms, credit_limit, default_deposit_percent')
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
