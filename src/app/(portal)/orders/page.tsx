import { redirect } from 'next/navigation'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import {
  ORDERS_PAGE_SIZE,
  OrdersList,
  type OrdersListFilters,
  type OrdersListRow,
} from '@/components/orders/OrdersList'

export const dynamic = 'force-dynamic'

interface OrderRow {
  id: string
  status: string
  total_price: number | null
  placed_at: string | null
  quote_id: string | null
  quotes: {
    order_ref: string | null
    customer_name: string | null
    organization_id: string | null
    required_by: string | null
    organizations: { name: string | null } | null
    quote_items: { count: number }[] | null
  } | null
}

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

  let q = auth.admin
    .from('orders')
    .select(
      `
      id, status, total_price, placed_at, quote_id,
      quotes!inner (
        order_ref, customer_name, organization_id, required_by,
        organizations:organization_id ( name ),
        quote_items ( count )
      )
    `,
      { count: 'exact' }
    )
    .order('placed_at', { ascending: false })
    .range(offset, offset + ORDERS_PAGE_SIZE - 1)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.org_id) q = q.eq('quotes.organization_id', filters.org_id)
  if (filters.from) q = q.gte('placed_at', filters.from)
  if (filters.to) q = q.lte('placed_at', filters.to)

  const { data, count, error } = await q

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

  const rawRows = (data ?? []) as unknown as OrderRow[]
  const rows: OrdersListRow[] = rawRows.map((r) => ({
    id: r.id,
    status: r.status,
    total_price: r.total_price,
    placed_at: r.placed_at,
    order_ref: r.quotes?.order_ref ?? null,
    org_name: r.quotes?.organizations?.name ?? null,
    required_by: r.quotes?.required_by ?? null,
    line_count:
      Array.isArray(r.quotes?.quote_items) && r.quotes!.quote_items!.length > 0
        ? Number(r.quotes!.quote_items![0].count)
        : null,
  }))

  return <OrdersList rows={rows} total={count ?? 0} filters={filters} />
}
