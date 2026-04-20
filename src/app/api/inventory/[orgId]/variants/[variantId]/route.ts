import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params
  let body: { absolute_stock_qty?: number; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (
    typeof body.absolute_stock_qty !== 'number' ||
    !Number.isInteger(body.absolute_stock_qty) ||
    body.absolute_stock_qty < 0
  ) {
    return NextResponse.json(
      { error: 'absolute_stock_qty must be a non-negative integer' },
      { status: 400 }
    )
  }
  if (!body.note || !body.note.trim()) {
    return NextResponse.json({ error: 'note is required for recount' }, { status: 400 })
  }

  const { data: inv, error: fErr } = await auth.admin
    .from('variant_inventory')
    .select('stock_qty')
    .eq('variant_id', variantId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  if (!inv) return NextResponse.json({ error: 'Not tracked' }, { status: 404 })

  const delta = body.absolute_stock_qty - inv.stock_qty
  if (delta === 0) {
    return NextResponse.json({ ok: true, note: 'no change' })
  }

  const { error: rErr } = await auth.admin.rpc('apply_staff_adjustment', {
    p_variant_id: variantId,
    p_org_id: orgId,
    p_delta: delta,
    p_reason: 'count_correction',
    p_note: body.note,
    p_staff_id: auth.context.staffId,
  })
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, delta })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; variantId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId, variantId } = await params

  const { data: inv } = await auth.admin
    .from('variant_inventory')
    .select('id, committed_qty')
    .eq('variant_id', variantId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Not tracked' }, { status: 404 })
  if ((inv.committed_qty ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot untrack — committed_qty > 0 (in-flight orders)' },
      { status: 409 }
    )
  }

  const { error } = await auth.admin
    .from('variant_inventory')
    .delete()
    .eq('id', inv.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
