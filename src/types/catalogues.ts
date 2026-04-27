export type CatalogueRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  discount_pct: number
  is_active: boolean
  created_at: string
  created_by_user_id: string | null
  updated_at: string
}

export type CatalogueItemRow = {
  id: string
  catalogue_id: string
  source_product_id: string
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
  sort_order: number | null
  created_at: string
  updated_at: string
}

export type CatalogueItemPricingTierRow = {
  id: string
  catalogue_item_id: string
  min_quantity: number
  max_quantity: number | null
  unit_price: number
  created_at: string
}

export type CreateCatalogueBody = {
  organization_id: string
  name: string
  description?: string
  discount_pct?: number
  product_ids?: string[]
}

export type AddFromMasterBody = { source_product_id: string }

export type CreateB2BOnlyItemBody = {
  name: string
  base_cost: number
  decoration_eligible?: boolean
  decoration_price?: number
  image_url?: string
  category_id?: string
  brand_id?: string
}

export type UpdateCatalogueItemBody = Partial<{
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  metafields: Record<string, unknown>
  is_active: boolean
  sort_order: number
}>
