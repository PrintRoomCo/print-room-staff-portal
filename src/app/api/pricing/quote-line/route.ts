import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function POST(request: Request) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  let body: { product_id?: string; organization_id?: string; quantity?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { product_id, organization_id, quantity } = body
  if (
    !product_id ||
    !organization_id ||
    !quantity ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { error: 'product_id, organization_id, positive integer quantity required' },
      { status: 400 },
    )
  }

  const [priceResult, bracketResult, tierResult] = await Promise.all([
    auth.admin.rpc('get_unit_price', {
      p_product_id: product_id,
      p_org_id: organization_id,
      p_qty: quantity,
    }),
    auth.admin
      .from('product_pricing_tiers')
      .select('min_quantity, max_quantity, tier_level')
      .eq('product_id', product_id)
      .eq('is_active', true)
      .lte('min_quantity', quantity)
      .order('min_quantity', { ascending: false })
      .limit(1)
      .maybeSingle(),
    auth.admin
      .from('b2b_accounts')
      .select('tier_level')
      .eq('organization_id', organization_id)
      .maybeSingle(),
  ])
  if (priceResult.error) {
    return NextResponse.json({ error: priceResult.error.message }, { status: 500 })
  }

  const unit_price = Number(priceResult.data ?? 0)
  return NextResponse.json({
    unit_price,
    total: Number((unit_price * quantity).toFixed(2)),
    tier_level: tierResult.data?.tier_level ?? 3,
    bracket: bracketResult.data
      ? {
          min_quantity: bracketResult.data.min_quantity,
          max_quantity: bracketResult.data.max_quantity,
        }
      : null,
  })
}
