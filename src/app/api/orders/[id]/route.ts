import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  const { data: order, error } = await auth.admin
    .from('orders')
    .select(`
      id, status, total_price, placed_at, account_id,
      quotes!inner (
        id, order_ref, customer_name, customer_email, customer_phone,
        organization_id, required_by, payment_terms, notes, internal_notes,
        shipping_address, monday_item_id,
        organizations:organization_id ( id, name, customer_code )
      )
    `)
    .eq('id', id)
    .single()
  if (error || !order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: lines } = await auth.admin
    .from('quote_items')
    .select(`
      id, product_id, product_name, quantity, unit_price, total_price,
      variant_id, monday_subitem_id, customizations,
      product_variants (
        color_swatch_id, size_id,
        product_color_swatches (label, hex),
        sizes (label, order_index)
      )
    `)
    .eq('quote_id', (order.quotes as any).id)

  return NextResponse.json({ order, lines: lines ?? [] })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params

  const { data: order } = await auth.admin
    .from('orders')
    .select('quote_id, status')
    .eq('id', id)
    .single()
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ ok: true, note: 'already cancelled' })
  }

  const { data: lines } = await auth.admin
    .from('quote_items')
    .select('id')
    .eq('quote_id', order.quote_id)
  const lineIds = (lines ?? []).map((l) => l.id)

  // Block cancel if any line has already shipped (order_ship event exists).
  const { count } = await auth.admin
    .from('variant_inventory_events')
    .select('*', { count: 'exact', head: true })
    .in('reference_quote_item_id', lineIds)
    .eq('reason', 'order_ship')
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot cancel — some lines have shipped' },
      { status: 409 }
    )
  }

  for (const lineId of lineIds) {
    const { error: rErr } = await auth.admin.rpc('release_quote_line', {
      p_quote_item_id: lineId,
      p_reason: 'cancelled',
    })
    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }
  }
  await auth.admin.from('orders').update({ status: 'cancelled' }).eq('id', id)
  return NextResponse.json({ ok: true })
}
