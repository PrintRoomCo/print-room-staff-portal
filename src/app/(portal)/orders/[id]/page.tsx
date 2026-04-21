import { notFound, redirect } from 'next/navigation'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { fetchOrderDetailData } from '@/lib/orders/read'
import {
  OrderDetailClient,
  type OrderDetailHeader,
} from '@/components/orders/OrderDetailClient'
import type { OrderLine } from '@/components/orders/LineEditRow'

export const dynamic = 'force-dynamic'

interface RawLineRow {
  id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number | null
  total_price: number | null
  variant_id: string | null
  monday_subitem_id: string | null
  customizations: unknown
  product_variants: {
    color_swatch_id: string | null
    size_id: number | null
    product_color_swatches: { label: string | null; hex: string | null } | null
    sizes: { label: string | null; order_index: number | null } | null
  } | null
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) {
    redirect('/dashboard')
  }

  const { order, quote, organization, error } = await fetchOrderDetailData(auth.admin, id)

  if (error || !order || !quote) {
    notFound()
  }

  const { data: rawLines } = await auth.admin
    .from('quote_items')
    .select(
      `
      id, product_id, product_name, quantity, unit_price, total_price,
      variant_id, monday_subitem_id, customizations,
      product_variants (
        color_swatch_id, size_id,
        product_color_swatches (label, hex),
        sizes (label, order_index)
      )
    `,
    )
    .eq('quote_id', quote.id)

  const lineRows = (rawLines ?? []) as unknown as RawLineRow[]
  const lineIds = lineRows.map((l) => l.id)

  let isShipped = false
  if (lineIds.length > 0) {
    const { count } = await auth.admin
      .from('variant_inventory_events')
      .select('*', { count: 'exact', head: true })
      .in('reference_quote_item_id', lineIds)
      .eq('reason', 'order_ship')
    isShipped = (count ?? 0) > 0
  }

  const lines: OrderLine[] = lineRows.map((l) => ({
    id: l.id,
    product_id: l.product_id,
    product_name: l.product_name,
    quantity: l.quantity,
    unit_price: l.unit_price === null ? null : Number(l.unit_price),
    total_price: l.total_price === null ? null : Number(l.total_price),
    variant_id: l.variant_id,
    variant: l.product_variants
      ? {
          color_label: l.product_variants.product_color_swatches?.label ?? null,
          color_hex: l.product_variants.product_color_swatches?.hex ?? null,
          size_label: l.product_variants.sizes?.label ?? null,
        }
      : null,
  }))

  const header: OrderDetailHeader = {
    id: order.id,
    order_ref: quote.order_ref ?? null,
    org_name: organization?.name ?? null,
    status: order.status,
    placed_at: order.placed_at,
    total_price: order.total_price === null ? null : Number(order.total_price),
    monday_item_id: quote.monday_item_id ?? null,
  }

  return (
    <OrderDetailClient order={header} lines={lines} isShipped={isShipped} />
  )
}
