export const PROOF_STATUSES = [
  'draft',
  'sent',
  'approved',
  'changes_requested',
  'superseded',
  'archived',
] as const

export type ProofStatus = (typeof PROOF_STATUSES)[number]

export const PROOF_METHODS = [
  'screenprint',
  'embroidery',
  'heat_press',
  'super_color',
  'other',
] as const

export type ProofMethod = (typeof PROOF_METHODS)[number]

export type ProofMockupAsset = {
  schema_version: 1
  product_id: string
  variant_id: string | null
  catalogue_item_id?: string | null
  product_view_key: string
  product_image_id?: string | null
  print_area_key: string
  artwork: { storage_path: string; preview_url: string; original_filename?: string }
  mockup: { storage_path: string; preview_url: string; width_px?: number; height_px?: number }
  placement_transform: {
    x: number
    y: number
    w: number
    h: number
    rotation?: number
    coordinate_space: 'print_area_normalized'
  }
  dimensions_mm: {
    artwork_w: number
    artwork_h: number
    print_area_w?: number
    print_area_h?: number
  }
  decoration: {
    method: ProofMethod
    pantones: string[]
    production_note?: string | null
    pricing_ref: {
      kind: 'product' | 'catalogue_item' | 'quote_builder_decoration'
      product_id: string
      catalogue_item_id?: string | null
      decoration_source_id?: number | null
      decoration_type?: string
      decoration_detail?: string
      location_key?: string
    }
  }
  quantities: { sizes: Record<string, number>; one_size_qty?: number | null; total_qty: number }
}

export const SIZE_COLUMNS = [
  'One Size',
  'Size 2',
  'Size 4',
  'XXS/6',
  'XS/8',
  'SML/10',
  'MED/12',
  'LRG/14',
  'XLG/16',
  '2XL/18',
  '3XL/20',
  '4XL/22',
  '5XL/24',
] as const

export type ProofSizeColumn = (typeof SIZE_COLUMNS)[number]

export interface ProofPrintArea {
  id: string
  label: string
  method: ProofMethod
  widthMm: string
  heightMm: string
  pantone: string
  pantoneHex: string
  artworkStatus: string
  productionNote: string
}

export interface ProofDesign {
  id: string
  index: number
  name: string
  subtitle: string
  garmentLabel: string
  colourName: string
  frontMockupUrl: string
  backMockupUrl: string
  artworkUrl: string
  artworkBackground: string
  artworkNotes: string
  printHeightsNote: string
  productionNote: string
  printAreas: ProofPrintArea[]
  mockupAssets?: ProofMockupAsset[]
}

export interface ProofOrderLine {
  id: string
  designIndex: number
  name: string
  isStaff: boolean
  brand: string
  garment: string
  sku: string
  colour: string
  productId?: string
  productVariantId?: string | null
  quantities: Record<string, string>
}

export interface ProofDocument {
  customerName: string
  customerEmail: string
  jobName: string
  jobReference: string
  preparedByName: string
  preparedByEmail: string
  preparedByPhone: string
  website: string
  deliveryDateLabel: string
  terms: string
  approvalCopy: string
  warning: string
  notes: string
  designs: ProofDesign[]
  orderLines: ProofOrderLine[]
}

export interface ProofSummary {
  id: string
  organizationId: string
  organizationName: string
  name: string
  customerEmail: string
  customerName: string
  status: ProofStatus
  currentVersionId: string | null
  versionNumber: number | null
  designCount: number
  orderLineCount: number
  createdAt: string
  updatedAt: string
}

export interface ProofDetail extends ProofSummary {
  document: ProofDocument
}

export interface ProofCreateInput {
  organizationId: string
  customerName: string
  customerEmail: string
  jobName: string
  jobReference?: string
}

export interface ProofUpdateInput {
  name?: string
  customerName?: string
  customerEmail?: string
  status?: ProofStatus
  document?: ProofDocument
}
