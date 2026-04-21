import { redirect } from 'next/navigation'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { fetchOrdersListData } from '@/lib/orders/read'
import {
  ORDERS_PAGE_SIZE,
  OrdersList,
  type OrdersListFilters,
  type OrdersListRow,
} from '@/components/orders/OrdersList'

export const dynamic = 'force-dynamic'

function firstString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

function parseFilters(sp: Record<string, string | string[] | undefined>): OrdersListFilters {
  const page = Math.max(1, Number(firstString(sp.page)) || 1)
  return {
    status: firstString(sp.status),
    org_id: firstString(sp.org_id),
    from: firstString(sp.from),
    to: firstString(sp.to),
    page,
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) {
    redirect('/dashboard')
  }

  const sp = await searchParams
  const filters = parseFilters(sp)
  const offset = (filters.page - 1) * ORDERS_PAGE_SIZE

  const { orders, count, quotesById, organizationsById, lineCountsByQuoteId, error } = await fetchOrdersListData(auth.admin, {
    status: filters.status || undefined,
    orgId: filters.org_id || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: ORDERS_PAGE_SIZE,
    offset,
  })

  if (error) {
    console.error('Orders list query failed:', error)
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load orders</h1>
        <p className="text-sm text-gray-500 mt-2">
          The query failed. Check server logs for details.
        </p>
      </div>
    )
  }

  const rows: OrdersListRow[] = orders.map((order) => {
    const quote = order.quote_id ? quotesById[order.quote_id] : undefined
    const organization = quote?.organization_id ? organizationsById[quote.organization_id] : undefined

    return {
      id: order.id,
      status: order.status,
      total_price: order.total_price,
      placed_at: order.placed_at,
      order_ref: quote?.order_ref ?? null,
      org_name: organization?.name ?? null,
      required_by: quote?.required_by ?? null,
      line_count: order.quote_id ? lineCountsByQuoteId[order.quote_id] ?? null : null,
    }
  })

  return <OrdersList rows={rows} total={count ?? 0} filters={filters} />
}
