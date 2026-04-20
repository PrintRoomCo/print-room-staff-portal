import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params

  let body: { delta?: number; reason?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body.delta !== 'number' ||
    !Number.isInteger(body.delta) ||
    body.delta === 0
  ) {
    return NextResponse.json(
      { error: 'delta must be a nonzero integer' },
      { status: 400 }
    )
  }
  if (body.reason !== 'intake' && body.reason !== 'damage_writeoff') {
    return NextResponse.json(
      { error: 'reason must be intake or damage_writeoff' },
      { status: 400 }
    )
  }
  if (body.reason === 'intake' && body.delta <= 0) {
    return NextResponse.json(
      { error: 'intake delta must be positive' },
      { status: 400 }
    )
  }
  if (body.reason === 'damage_writeoff' && body.delta >= 0) {
    return NextResponse.json(
      { error: 'damage_writeoff delta must be negative' },
      { status: 400 }
    )
  }

  const { error } = await auth.admin.rpc('apply_staff_adjustment', {
    p_variant_id: variantId,
    p_org_id: orgId,
    p_delta: body.delta,
    p_reason: body.reason,
    p_note: body.note ?? null,
    p_staff_id: auth.context.staffId,
  })
  if (error) {
    const status = error.message?.includes('NOT_TRACKED')
      ? 404
      : error.message?.includes('stock_qty')
        ? 409
        : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ ok: true })
}
