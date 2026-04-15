export type QuoteStatus =
  | 'created'
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'archived'

export type QuoteItemSource = 'catalog' | 'mto' | 'custom'

export type ExtraPriceType = 'multiplier' | 'fixed' | 'lump'

export interface Brand {
  id: number
  name: string
  active: boolean
}

export interface Product {
  id: string
  sku: string | null
  brand: string | null
  name: string
  category: string | null
  base_cost: number
  active: boolean
  image_url: string | null
  product_url: string | null
  sourcing_type: string
  sourcing: string | null
  notes: string | null
}

export interface MtoProduct {
  id: string
  sku: string | null
  brand: string | null
  name: string
  category: string | null
  min_qty: number | null
  max_qty: number | null
  base_cost: number
  active: boolean
  image_url: string | null
  product_url: string | null
  add_air_shipping: number | null
  add_sea_shipping: number | null
  sourcing_type: string
  notes: string | null
}

export interface Decoration {
  id: number
  sourcing_type: string | null
  decoration_type: string
  decoration_detail: string
  min_qty: number | null
  max_qty: number | null
  price: number
  setup_fee: number | null
  active: boolean
  product_category: string | null
  applicable_product_types: string[]
  not_applicable_product_types: string[]
}

export interface Finish {
  id: number
  finish_type: string
  sourcing_type: string | null
  min_qty: number | null
  max_qty: number | null
  price: number
  active: boolean
  applicable_product_types: string[]
  not_applicable_product_types: string[]
}

export interface Extra {
  id: number
  name: string
  sourcing_type: string | null
  applies_to: string | null
  min_qty: number | null
  max_qty: number | null
  price: string
  pricing_structure: string | null
  category: 'decoration' | 'order' | string
  active: boolean
  applicable_product_types: string[]
  not_applicable_product_types: string[]
}

export interface Multiplier {
  id: number
  sourcing_type: string | null
  category: string | null
  min_qty: number | null
  max_qty: number | null
  multiplier: number
  shipping: number | null
  add_air_shipping: number | null
  add_sea_shipping: number | null
}

export interface PriceTier {
  tier_id: string
  tier_name: string
  discount: number | null
}

export interface Location {
  id: number
  sourcing_type: string | null
  location: string
  active: boolean
}

export interface Template {
  id: string
  name: string
  filename: string
}

export interface QuoteHistory {
  id: string
  quote_id: string
  date: string
  user_name: string
  action: string
  detail: string
}

export interface QuoteExtra {
  id: string
  sourceId?: number | null
  name: string
  price: string
  pricingStructure?: string | null
  category: 'decoration' | 'order' | string
  appliesTo?: string | null
  sourcingType?: string | null
  customAmount?: number | null
  isCustom?: boolean
}

export interface QuoteDecoration {
  id: string
  sourceId?: number | null
  decorationType: string
  decorationDetail: string
  location: string
  price?: number | null
  setupFee?: number | null
  extras: QuoteExtra[]
}

export interface QuoteFinish {
  id: string
  sourceId?: number | null
  finishType: string
  price?: number | null
}

export interface QuoteItem {
  id: string
  source: QuoteItemSource
  productId?: string | null
  sku?: string | null
  brand?: string | null
  name: string
  category?: string | null
  sourcingType: string
  sourcing?: string | null
  productType?: string | null
  quantity: number
  minQty?: number | null
  maxQty?: number | null
  baseCost: number
  imageUrl?: string | null
  productUrl?: string | null
  designGroupName?: string | null
  notes?: string | null
  decorations: QuoteDecoration[]
  finishes: QuoteFinish[]
  extras: QuoteExtra[]
}

export interface QuoteDraft {
  id?: string
  quoteReference: string
  customerName: string
  customerEmail: string
  customerCompany?: string
  customerPhone?: string
  accountManager: string
  inHandDate: string
  expiryDate: string
  priceTier: string
  templateId: string
  customDiscount: number | null
  status: QuoteStatus
  items: QuoteItem[]
  orderExtras: QuoteExtra[]
  notes: string
  includeGst: boolean
  showTotal: boolean
  subtotal?: number | null
  total?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface QuoteListItem {
  id: string
  quoteReference: string
  customerName: string
  customerEmail?: string
  accountManager: string
  status: QuoteStatus | string
  subtotal: number
  total: number
  createdAt: string
  updatedAt: string
}

export interface QuoteBuilderDashboardCounts {
  total: number
  created: number
  accepted: number
  declined: number
}

export interface QuoteBuilderDashboardPayload {
  quotes: QuoteListItem[]
  counts?: Partial<QuoteBuilderDashboardCounts>
  managers?: string[]
  totalCount?: number
}

export interface QuoteBuilderStaffOption {
  id: string
  displayName: string
  email: string
}

export interface QuoteBuilderReferenceData {
  brands: Brand[]
  products: Product[]
  mtoProducts: MtoProduct[]
  decorations: Decoration[]
  finishes: Finish[]
  extras: Extra[]
  multipliers: Multiplier[]
  priceTiers: PriceTier[]
  locations: Location[]
  templates: Template[]
  staffUsers: QuoteBuilderStaffOption[]
}

export interface ParsedExtraPrice {
  type: ExtraPriceType
  value: number
}

export interface PriceBreakdownLine {
  label: string
  amount: number
  detail?: string
}

export interface ItemPricingBreakdown {
  productUnitPrice: number
  decorationUnitPrice: number
  finishUnitPrice: number
  itemExtrasTotal: number
  subtotal: number
  unitPrice: number
  breakdown: PriceBreakdownLine[]
}

export interface QuotePricingBreakdown {
  items: Record<string, ItemPricingBreakdown>
  subtotal: number
  discountRate: number
  discountAmount: number
  orderExtrasTotal: number
  total: number
  totalInclGst: number
}

export interface QuoteValidationIssue {
  field: string
  message: string
}

export interface QuoteValidationState {
  isReady: boolean
  issues: QuoteValidationIssue[]
  itemIssues: Record<string, QuoteValidationIssue[]>
}

export const QUANTITY_BREAKS = [24, 50, 100, 250, 500] as const

export const EXPIRY_PRESET_DAYS = [0, 7, 14, 30] as const

export const DEFAULT_PRICE_TIER_ID = 'tier-1'

export const QUOTE_STATUS_OPTIONS: Array<{ label: string; value: QuoteStatus }> = [
  { label: 'Created', value: 'created' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Expired', value: 'expired' },
]

export const ITEM_SOURCE_OPTIONS: Array<{ label: string; value: QuoteItemSource }> = [
  { label: 'Catalog Product', value: 'catalog' },
  { label: 'MTO Product', value: 'mto' },
  { label: 'Custom Product', value: 'custom' },
]

export const ORDER_EXTRA_NAMES = [
  'Rush Fee',
  'Individual Fulfilment',
  'NFP Fulfilment',
  'Split Shipping',
  'Individual Fold',
  'Other',
]

export const GST_RATE = 0.15
