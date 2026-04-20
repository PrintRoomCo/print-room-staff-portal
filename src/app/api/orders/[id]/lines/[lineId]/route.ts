import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

async function isShipped(admin: any, lineId: string) {
  const { count } = await admin
    .from('variant_inventory_events')
    .select('*', { count: 'exact', head: true })
    .eq('reference_quote_item_id', lineId)
    .eq('reason', 'order_ship')
  return (count ?? 0) > 0
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { lineId } = await params
  if (await isShipped(auth.admin, lineId)) {
    return NextResponse.json(
      { error: 'Line already shipped — edits disabled' },
      { status: 409 },
    )
  }

  let body: { quantity?: number; variant_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: line, error: lErr } = await auth.admin
    .from('quote_items')
    .select('quantity, unit_price, variant_id')
    .eq('id', lineId)
    .single()
  if (lErr || !line) {
    return NextResponse.json({ error: 'Line not found' }, { status: 404 })
  }

  if (typeof body.quantity === 'number' && body.quantity !== line.quantity) {
    if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be positive int' },
        { status: 400 },
      )
    }
    const { error: rErr } = await auth.admin.rpc('adjust_quote_line_delta', {
      p_quote_item_id: lineId,
      p_old_qty: line.quantity,
      p_new_qty: body.quantity,
    })
    if (rErr) {
      const status = rErr.message?.includes('OUT_OF_STOCK') ? 409 : 500
      return NextResponse.json({ error: rErr.message }, { status })
    }
    await auth.admin
      .from('quote_items')
      .update({
        quantity: body.quantity,
        total_price: Number(line.unit_price) * body.quantity,
      })
      .eq('id', lineId)
  }

  if (body.variant_id && body.variant_id !== line.variant_id) {
    const { error: relErr } = await auth.admin.rpc('release_quote_line', {
      p_quote_item_id: lineId,
      p_reason: 'variant_change',
    })
    if (relErr) {
      return NextResponse.json({ error: relErr.message }, { status: 500 })
    }
    await auth.admin
      .from('quote_items')
      .update({ variant_id: body.variant_id })
      .eq('id', lineId)
    const { error: resErr } = await auth.admin.rpc('reserve_quote_line', {
      p_quote_item_id: lineId,
    })
    if (resErr) {
      // Roll back: flip variant_id back and re-reserve old variant.
      await auth.admin
        .from('quote_items')
        .update({ variant_id: line.variant_id })
        .eq('id', lineId)
      await auth.admin.rpc('reserve_quote_line', { p_quote_item_id: lineId })
      const status = resErr.message?.includes('OUT_OF_STOCK') ? 409 : 500
      return NextResponse.json({ error: resErr.message }, { status })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { lineId } = await params
  if (await isShipped(auth.admin, lineId)) {
    return NextResponse.json({ error: 'Line already shipped' }, { status: 409 })
  }
  const { error: rErr } = await auth.admin.rpc('release_quote_line', {
    p_quote_item_id: lineId,
    p_reason: 'line_removed',
  })
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }
  const { error: dErr } = await auth.admin
    .from('quote_items')
    .delete()
    .eq('id', lineId)
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
