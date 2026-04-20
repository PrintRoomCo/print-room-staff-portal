export type OrderStatus =
  | 'awaiting-production'
  | 'in-production'
  | 'fulfilled'
  | 'shipped'
  | 'cancelled'

export interface OrderLineInput {
  product_id: string
  product_name: string
  variant_id: string | null
  quantity: number
  unit_price: number
  customizations?: Record<string, unknown> | null
}

export interface OrderSubmitRequest {
  idempotency_key: string
  organization_id: string
  customer_code: string
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  shipping_address: Record<string, unknown>
  payment_terms: string
  required_by?: string | null
  notes?: string | null
  internal_notes?: string | null
  lines: OrderLineInput[]
}

export interface OrderSubmitResponse {
  quote_id: string
  order_id: string
  order_ref: string
  monday_item_id: string | null
  monday_push_error: string | null
}
