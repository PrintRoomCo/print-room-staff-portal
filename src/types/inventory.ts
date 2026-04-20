export type InventoryEventReason =
  | 'intake'
  | 'count_correction'
  | 'damage_writeoff'
  | 'order_commit'
  | 'order_release'
  | 'order_ship'

export type StaffAdjustmentReason =
  | 'intake'
  | 'count_correction'
  | 'damage_writeoff'

export interface ProductVariantRow {
  id: string
  product_id: string
  color_swatch_id: string | null
  size_id: number | null
  sku_suffix: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VariantInventoryRow {
  id: string
  variant_id: string
  organization_id: string
  stock_qty: number
  committed_qty: number
  reorder_point: number | null
  updated_at: string
}

export interface VariantAvailabilityRow {
  variant_id: string
  organization_id: string
  stock_qty: number
  committed_qty: number
  available_qty: number
}

export interface VariantEventRow {
  id: string
  variant_id: string
  organization_id: string
  delta_stock: number
  delta_committed: number
  reason: InventoryEventReason
  note: string | null
  reference_quote_item_id: string | null
  staff_user_id: string | null
  created_at: string
}
