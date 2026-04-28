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
