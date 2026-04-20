import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { OrderSubmitRequest, OrderSubmitResponse } from '@/types/orders'
import { pushProductionJob } from '@/lib/monday/production-job'

export async function submitB2BOrder(req: OrderSubmitRequest): Promise<OrderSubmitResponse> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin.rpc('submit_b2b_order', {
    p_idempotency_key: req.idempotency_key,
    p_organization_id: req.organization_id,
    p_customer_code: req.customer_code,
    p_customer_name: req.customer_name,
    p_customer_email: req.customer_email,
    p_customer_phone: req.customer_phone ?? null,
    p_shipping_address: req.shipping_address,
    p_payment_terms: req.payment_terms,
    p_required_by: req.required_by ?? null,
    p_notes: req.notes ?? null,
    p_internal_notes: req.internal_notes ?? null,
    p_lines: req.lines,
  })
  if (error) throw new Error(`submit_b2b_order failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  const { quote_id, order_id, order_ref } = row

  // Fetch full order + lines for Monday push.
  const pushResult = await tryPushMonday(admin, order_id, quote_id)

  return {
    quote_id,
    order_id,
    order_ref,
    monday_item_id: pushResult.monday_item_id,
    monday_push_error: pushResult.error,
  }
}

async function tryPushMonday(
  admin: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  quoteId: string
): Promise<{ monday_item_id: string | null; error: string | null }> {
  try {
    const { data: order } = await admin
      .from('quotes')
      .select('order_ref, customer_name, customer_email, total_amount, required_by, payment_terms, notes, monday_item_id')
      .eq('id', quoteId).single()
    if (!order) return { monday_item_id: null, error: 'quote not found' }

    const { data: lines } = await admin
      .from('quote_items')
      .select(`
        id, product_name, quantity, unit_price, customizations, monday_subitem_id,
        product_variants (
          color_swatch_id, size_id,
          product_color_swatches (label),
          sizes (label)
        )
      `)
      .eq('quote_id', quoteId)

    const productionOrder = {
      order_ref: order.order_ref,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      total_price: Number(order.total_amount),
      required_by: order.required_by,
      payment_terms: order.payment_terms,
      notes: order.notes,
      monday_item_id: order.monday_item_id,
    }

    const productionLines = (lines ?? []).map((l: any) => ({
      quote_item_id: l.id,
      product_name: l.product_name,
      variant_label: [
        l.product_variants?.product_color_swatches?.label,
        l.product_variants?.sizes?.label,
      ].filter(Boolean).join(' / ') || '—',
      quantity: l.quantity,
      unit_price: Number(l.unit_price),
      decoration_summary: null,
      existing_subitem_id: l.monday_subitem_id,
    }))

    const { itemId, subitemIds } = await pushProductionJob(productionOrder, productionLines)

    await admin.from('quotes').update({ monday_item_id: itemId }).eq('id', quoteId)
    for (const [quoteItemId, subitemId] of Object.entries(subitemIds)) {
      await admin.from('quote_items')
        .update({ monday_subitem_id: subitemId })
        .eq('id', quoteItemId)
    }
    return { monday_item_id: itemId, error: null }
  } catch (e) {
    return { monday_item_id: null, error: (e as Error).message }
  }
}

export async function retryMondayPush(orderId: string): Promise<{ monday_item_id: string | null; error: string | null }> {
  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('orders').select('quote_id').eq('id', orderId).single()
  if (!order) return { monday_item_id: null, error: 'order not found' }
  return tryPushMonday(admin, orderId, order.quote_id)
}
