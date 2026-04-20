import type { ProductTypeTag } from '@/lib/products/tags'
import type { GarmentFamily } from '@/lib/products/garment-families'

export interface BrandRef {
  id: string
  name: string
}

export interface CategoryRef {
  id: string
  name: string
}

export interface ProductSummary {
  id: string
  name: string
  sku: string | null
  supplier_code: string | null
  base_cost: number | null
  is_active: boolean
  image_url: string | null
  garment_family: GarmentFamily | null
  tags: string[]
  shopify_product_id: string | null
  brand: BrandRef | null
  category: CategoryRef | null
}

export interface ProductDetail {
  id: string
  name: string
  sku: string | null
  supplier_code: string | null
  code: string | null
  description: string | null
  brand_id: string
  category_id: string
  garment_family: GarmentFamily | null
  industry: string[] | null
  default_sizes: string[] | null
  tags: string[]
  base_cost: number | null
  markup_pct: number
  decoration_eligible: boolean
  decoration_price: number
  specs: unknown
  safety_standard: string | null
  moq: number
  lead_time_days: number
  sizing_type: string
  supports_labels: boolean
  is_hero: boolean
  is_active: boolean
  shopify_product_id: string | null
  platform: string
  created_at: string | null
  updated_at: string
}

export interface SwatchRow {
  id: string
  product_id: string
  label: string
  hex: string
  position: number
  is_active: boolean
  image_url: string | null
}

export interface SizeRow {
  id: number
  product_id: string
  label: string
  order_index: number
}

export interface ImageRow {
  id: string
  product_id: string
  file_url: string
  view: string | null
  position: number
  alt_text: string | null
  image_type: string
}

export interface PricingTierRow {
  id: string
  product_id: string
  min_quantity: number
  max_quantity: number | null
  unit_price: number
  currency: string
  tier_level: number
  is_active: boolean
}

export type ShopifyLiveFilter = 'all' | 'live' | 'not-live'
export type ActiveFilter = 'all' | 'active' | 'inactive'

export interface ProductListFilters {
  search: string
  brand_id: string | null
  category_id: string | null
  garment_family: GarmentFamily | null
  type_tags: ProductTypeTag[]
  shopify: ShopifyLiveFilter
  active: ActiveFilter
  page: number
}

export interface ProductListResponse {
  products: ProductSummary[]
  total: number
  page: number
  perPage: number
}
