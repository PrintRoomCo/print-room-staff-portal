import { getSupabaseAdmin } from '@/lib/supabase-server'

type OrdersAdmin = ReturnType<typeof getSupabaseAdmin>

export interface OrdersListQuery {
  status?: string
  orgId?: string
  from?: string
  to?: string
  limit: number
  offset: number
}

export interface OrderListBaseRow {
  id: string
  status: string
  total_price: number | null
  placed_at: string | null
  quote_id: string | null
}

export interface OrderQuoteSummaryRow {
  id: string
  order_ref: string | null
  customer_name: string | null
  organization_id: string | null
  required_by: string | null
}

export interface OrderQuoteDetailRow extends OrderQuoteSummaryRow {
  customer_email: string | null
  customer_phone: string | null
  payment_terms: string | null
  notes: string | null
  internal_notes: string | null
  shipping_address: unknown
  monday_item_id: string | null
}

export interface OrderOrganizationRow {
  id: string
  name: string | null
  customer_code?: string | null
}

export interface OrderDetailBaseRow {
  id: string
  status: string
  total_price: number | null
  placed_at: string | null
  account_id: string | null
  quote_id: string | null
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

async function fetchOrganizationsByIds(admin: OrdersAdmin, organizationIds: string[]) {
  if (organizationIds.length === 0) {
    return { organizationsById: {} as Record<string, OrderOrganizationRow>, error: null as string | null }
  }

  const { data, error } = await admin
    .from('organizations')
    .select('id, name, customer_code')
    .in('id', organizationIds)

  if (error) {
    return { organizationsById: {} as Record<string, OrderOrganizationRow>, error: error.message }
  }

  const rows = (data ?? []) as OrderOrganizationRow[]
  return {
    organizationsById: Object.fromEntries(rows.map((row) => [row.id, row])),
    error: null as string | null,
  }
}

async function fetchQuoteItemCountsByQuoteIds(admin: OrdersAdmin, quoteIds: string[]) {
  if (quoteIds.length === 0) {
    return { lineCountsByQuoteId: {} as Record<string, number>, error: null as string | null }
  }

  const { data, error } = await admin
    .from('quote_items')
    .select('id, quote_id')
    .in('quote_id', quoteIds)

  if (error) {
    return { lineCountsByQuoteId: {} as Record<string, number>, error: error.message }
  }

  const lineCountsByQuoteId: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ id: string; quote_id: string }>) {
    lineCountsByQuoteId[row.quote_id] = (lineCountsByQuoteId[row.quote_id] ?? 0) + 1
  }

  return { lineCountsByQuoteId, error: null as string | null }
}

export async function fetchOrdersListData(admin: OrdersAdmin, query: OrdersListQuery) {
  let filteredQuoteIds: string[] | null = null

  if (query.orgId) {
    const { data, error } = await admin
      .from('quotes')
      .select('id')
      .eq('organization_id', query.orgId)

    if (error) {
      return {
        orders: [] as OrderListBaseRow[],
        count: 0,
        quotesById: {} as Record<string, OrderQuoteSummaryRow>,
        organizationsById: {} as Record<string, OrderOrganizationRow>,
        lineCountsByQuoteId: {} as Record<string, number>,
        error: error.message,
      }
    }

    filteredQuoteIds = (data ?? []).map((row) => String(row.id))
    if (filteredQuoteIds.length === 0) {
      return {
        orders: [] as OrderListBaseRow[],
        count: 0,
        quotesById: {} as Record<string, OrderQuoteSummaryRow>,
        organizationsById: {} as Record<string, OrderOrganizationRow>,
        lineCountsByQuoteId: {} as Record<string, number>,
        error: null as string | null,
      }
    }
  }

  let ordersQuery = admin
    .from('orders')
    .select('id, status, total_price, placed_at, quote_id', { count: 'exact' })
    .order('placed_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (query.status) ordersQuery = ordersQuery.eq('status', query.status)
  if (query.from) ordersQuery = ordersQuery.gte('placed_at', query.from)
  if (query.to) ordersQuery = ordersQuery.lte('placed_at', query.to)
  if (filteredQuoteIds) ordersQuery = ordersQuery.in('quote_id', filteredQuoteIds)

  const { data: orderData, count, error: ordersError } = await ordersQuery
  if (ordersError) {
    return {
      orders: [] as OrderListBaseRow[],
      count: 0,
      quotesById: {} as Record<string, OrderQuoteSummaryRow>,
      organizationsById: {} as Record<string, OrderOrganizationRow>,
      lineCountsByQuoteId: {} as Record<string, number>,
      error: ordersError.message,
    }
  }

  const orders = (orderData ?? []) as OrderListBaseRow[]
  const quoteIds = uniqueStrings(orders.map((row) => row.quote_id))

  let quotesById: Record<string, OrderQuoteSummaryRow> = {}
  if (quoteIds.length > 0) {
    const { data: quoteData, error: quotesError } = await admin
      .from('quotes')
      .select('id, order_ref, customer_name, organization_id, required_by')
      .in('id', quoteIds)

    if (quotesError) {
      return {
        orders,
        count: count ?? 0,
        quotesById,
        organizationsById: {} as Record<string, OrderOrganizationRow>,
        lineCountsByQuoteId: {} as Record<string, number>,
        error: quotesError.message,
      }
    }

    const quoteRows = (quoteData ?? []) as OrderQuoteSummaryRow[]
    quotesById = Object.fromEntries(quoteRows.map((row) => [row.id, row]))
  }

  const organizationIds = uniqueStrings(Object.values(quotesById).map((row) => row.organization_id))
  const { organizationsById, error: organizationsError } = await fetchOrganizationsByIds(admin, organizationIds)
  if (organizationsError) {
    return {
      orders,
      count: count ?? 0,
      quotesById,
      organizationsById: {} as Record<string, OrderOrganizationRow>,
      lineCountsByQuoteId: {} as Record<string, number>,
      error: organizationsError,
    }
  }

  const { lineCountsByQuoteId, error: lineCountsError } = await fetchQuoteItemCountsByQuoteIds(admin, quoteIds)
  if (lineCountsError) {
    return {
      orders,
      count: count ?? 0,
      quotesById,
      organizationsById,
      lineCountsByQuoteId: {} as Record<string, number>,
      error: lineCountsError,
    }
  }

  return {
    orders,
    count: count ?? 0,
    quotesById,
    organizationsById,
    lineCountsByQuoteId,
    error: null as string | null,
  }
}

export async function fetchOrderDetailData(admin: OrdersAdmin, orderId: string) {
  const { data: orderData, error: orderError } = await admin
    .from('orders')
    .select('id, status, total_price, placed_at, account_id, quote_id')
    .eq('id', orderId)
    .single()

  if (orderError || !orderData) {
    return {
      order: null as OrderDetailBaseRow | null,
      quote: null as OrderQuoteDetailRow | null,
      organization: null as OrderOrganizationRow | null,
      error: orderError?.message ?? 'Order not found',
    }
  }

  const order = orderData as OrderDetailBaseRow
  if (!order.quote_id) {
    return {
      order,
      quote: null as OrderQuoteDetailRow | null,
      organization: null as OrderOrganizationRow | null,
      error: 'Order is missing quote_id',
    }
  }

  const { data: quoteData, error: quoteError } = await admin
    .from('quotes')
    .select(`
      id, order_ref, customer_name, customer_email, customer_phone,
      organization_id, required_by, payment_terms, notes, internal_notes,
      shipping_address, monday_item_id
    `)
    .eq('id', order.quote_id)
    .single()

  if (quoteError || !quoteData) {
    return {
      order,
      quote: null as OrderQuoteDetailRow | null,
      organization: null as OrderOrganizationRow | null,
      error: quoteError?.message ?? 'Quote not found',
    }
  }

  const quote = quoteData as OrderQuoteDetailRow
  let organization: OrderOrganizationRow | null = null

  if (quote.organization_id) {
    const { data: organizationData, error: organizationError } = await admin
      .from('organizations')
      .select('id, name, customer_code')
      .eq('id', quote.organization_id)
      .single()

    if (organizationError) {
      return {
        order,
        quote,
        organization: null as OrderOrganizationRow | null,
        error: organizationError.message,
      }
    }

    organization = (organizationData ?? null) as OrderOrganizationRow | null
  }

  return {
    order,
    quote,
    organization,
    error: null as string | null,
  }
}
