import type {
  ProofCreateInput,
  ProofDetail,
  ProofDocument,
  ProofMethod,
  ProofOrderLine,
  ProofPrintArea,
  ProofStatus,
  ProofSummary,
  ProofUpdateInput,
} from '@/types/proofs'
import {
  PROOF_METHODS,
  PROOF_STATUSES,
  SIZE_COLUMNS,
} from '@/types/proofs'

type UnknownRecord = Record<string, unknown>

interface OrganizationSummary {
  id: string
  name: string
  customer_code?: string | null
}

interface ProofRow {
  id: string
  organization_id: string
  name: string
  customer_email: string
  customer_name: string | null
  status: ProofStatus
  current_version_id: string | null
  created_at: string
  updated_at: string
}

interface VersionRow {
  id: string
  proof_id?: string
  version_number: number
  status?: string
  snapshot_data: unknown
  created_at?: string
}

const DEFAULT_TERMS = [
  'Please check all spelling, layout, garment colour, artwork size, print placement, and quantities before approval.',
  'Production will not begin until this proof is approved. Any changes after approval may affect delivery date and incur additional cost.',
].join(' ')

const DEFAULT_APPROVAL_COPY =
  'I confirm the artwork, garment details, and quantities shown in this proof are approved for production.'

const DEFAULT_WARNING =
  'Important: extra garments are recommended for screen printed jobs to cover setup, test prints, or garment faults.'

export function createProofItemId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function asObject(value: unknown): UnknownRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toStringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function toBooleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function cleanHex(value: unknown, fallback = '#1f2a44') {
  const hex = toStringValue(value).trim()
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback
}

function isProofStatus(value: string): value is ProofStatus {
  return PROOF_STATUSES.includes(value as ProofStatus)
}

function isProofMethod(value: string): value is ProofMethod {
  return PROOF_METHODS.includes(value as ProofMethod)
}

function normalizeMethod(value: unknown): ProofMethod {
  const method = toStringValue(value).trim()
  return isProofMethod(method) ? method : 'screenprint'
}

export function createDefaultQuantities() {
  return SIZE_COLUMNS.reduce<Record<string, string>>((acc, column) => {
    acc[column] = ''
    return acc
  }, {})
}

export function createDefaultPrintArea(label = 'LEFT CHEST'): ProofPrintArea {
  return {
    id: createProofItemId('area'),
    label,
    method: 'screenprint',
    widthMm: '90',
    heightMm: '55',
    pantone: 'White',
    pantoneHex: '#ffffff',
    artworkStatus: 'NEW',
    productionNote: 'N/A',
  }
}

export function createDefaultDesign(index: number) {
  return {
    id: createProofItemId('design'),
    index,
    name: `Design ${index}`,
    subtitle: '',
    garmentLabel: '',
    colourName: '',
    frontMockupUrl: '',
    backMockupUrl: '',
    artworkUrl: '',
    artworkBackground: '#1f2a44',
    artworkNotes: '',
    printHeightsNote: 'IF GARMENTS DIFFER',
    productionNote: 'N/A',
    printAreas: [
      createDefaultPrintArea('LEFT CHEST'),
      createDefaultPrintArea('CENTRE BACK'),
    ],
  }
}

export function createDefaultOrderLine(designIndex = 1): ProofOrderLine {
  return {
    id: createProofItemId('line'),
    designIndex,
    name: '',
    isStaff: false,
    brand: '',
    garment: '',
    sku: '',
    colour: '',
    quantities: createDefaultQuantities(),
  }
}

export function createDefaultProofDocument(input: ProofCreateInput & { organizationName: string; preparedByName?: string }): ProofDocument {
  const firstDesign = createDefaultDesign(1)
  return {
    customerName: input.customerName || input.organizationName,
    customerEmail: input.customerEmail,
    jobName: input.jobName,
    jobReference: input.jobReference || '',
    preparedByName: input.preparedByName || '',
    preparedByEmail: '',
    preparedByPhone: '',
    website: 'printroom.studio',
    deliveryDateLabel: '',
    terms: DEFAULT_TERMS,
    approvalCopy: DEFAULT_APPROVAL_COPY,
    warning: DEFAULT_WARNING,
    notes: '',
    designs: [firstDesign],
    orderLines: [
      {
        ...createDefaultOrderLine(1),
        name: input.customerName || input.organizationName,
      },
    ],
  }
}

export function normalizeProofCreateInput(value: unknown): ProofCreateInput {
  const record = asObject(value)
  return {
    organizationId: toStringValue(record.organizationId || record.organization_id).trim(),
    customerName: toStringValue(record.customerName || record.customer_name).trim(),
    customerEmail: toStringValue(record.customerEmail || record.customer_email).trim(),
    jobName: toStringValue(record.jobName || record.name || record.job_name).trim(),
    jobReference: toStringValue(record.jobReference || record.job_reference).trim(),
  }
}

export function validateProofCreateInput(input: ProofCreateInput) {
  const missingFields: string[] = []
  if (!input.organizationId) missingFields.push('organizationId')
  if (!input.customerEmail) missingFields.push('customerEmail')
  if (!input.jobName) missingFields.push('jobName')
  return missingFields
}

export function normalizeProofUpdateInput(value: unknown): ProofUpdateInput {
  const record = asObject(value)
  const update: ProofUpdateInput = {}

  if ('name' in record) update.name = toStringValue(record.name).trim()
  if ('customerName' in record || 'customer_name' in record) {
    update.customerName = toStringValue(record.customerName || record.customer_name).trim()
  }
  if ('customerEmail' in record || 'customer_email' in record) {
    update.customerEmail = toStringValue(record.customerEmail || record.customer_email).trim()
  }
  if ('status' in record) {
    const status = toStringValue(record.status).trim()
    if (!isProofStatus(status)) throw new Error('Invalid proof status')
    update.status = status
  }
  if ('document' in record) update.document = normalizeProofDocument(record.document)

  return update
}

export function normalizeProofDocument(value: unknown, fallback?: Partial<ProofDocument>): ProofDocument {
  const record = asObject(value)

  if ('customer' in record || 'job' in record || 'line_items' in record) {
    return normalizeLegacySnapshot(record, fallback)
  }

  const designs = asArray(record.designs)
    .map((item, index) => normalizeDesign(item, index))
    .filter(design => design.name || design.frontMockupUrl || design.backMockupUrl || design.artworkUrl)

  const orderLines = asArray(record.orderLines)
    .map(item => normalizeOrderLine(item))
    .filter(line => line.name || line.brand || line.garment || line.sku || calculateLineTotal(line) > 0)

  return {
    customerName: toStringValue(record.customerName, fallback?.customerName || '').trim(),
    customerEmail: toStringValue(record.customerEmail, fallback?.customerEmail || '').trim(),
    jobName: toStringValue(record.jobName, fallback?.jobName || '').trim(),
    jobReference: toStringValue(record.jobReference, fallback?.jobReference || '').trim(),
    preparedByName: toStringValue(record.preparedByName, fallback?.preparedByName || '').trim(),
    preparedByEmail: toStringValue(record.preparedByEmail, fallback?.preparedByEmail || '').trim(),
    preparedByPhone: toStringValue(record.preparedByPhone, fallback?.preparedByPhone || '').trim(),
    website: toStringValue(record.website, fallback?.website || 'printroom.studio').trim(),
    deliveryDateLabel: toStringValue(record.deliveryDateLabel, fallback?.deliveryDateLabel || '').trim(),
    terms: toStringValue(record.terms, fallback?.terms || DEFAULT_TERMS).trim(),
    approvalCopy: toStringValue(record.approvalCopy, fallback?.approvalCopy || DEFAULT_APPROVAL_COPY).trim(),
    warning: toStringValue(record.warning, fallback?.warning || DEFAULT_WARNING).trim(),
    notes: toStringValue(record.notes, fallback?.notes || '').trim(),
    designs: reindexDesigns(designs.length > 0 ? designs : fallback?.designs || [createDefaultDesign(1)]),
    orderLines: orderLines.length > 0 ? orderLines : fallback?.orderLines || [createDefaultOrderLine(1)],
  }
}

function normalizeLegacySnapshot(record: UnknownRecord, fallback?: Partial<ProofDocument>): ProofDocument {
  const customer = asObject(record.customer)
  const job = asObject(record.job)
  const preparedBy = asObject(job.prepared_by)
  const designs = asArray(record.designs)
    .map((item, index) => normalizeDesign(item, index))
  const orderLines = asArray(record.line_items)
    .map(item => normalizeOrderLine(item))

  return normalizeProofDocument(
    {
      customerName: customer.organization_name || customer.customer_name || fallback?.customerName,
      customerEmail: customer.customer_email || fallback?.customerEmail,
      jobName: job.name || fallback?.jobName,
      jobReference: job.reference || fallback?.jobReference,
      preparedByName: preparedBy.name || fallback?.preparedByName,
      preparedByEmail: preparedBy.email || fallback?.preparedByEmail,
      preparedByPhone: preparedBy.phone || fallback?.preparedByPhone,
      deliveryDateLabel: job.delivery_date || fallback?.deliveryDateLabel,
      notes: job.additional_notes || fallback?.notes,
      designs,
      orderLines,
    },
    fallback
  )
}

function normalizeDesign(value: unknown, index: number) {
  const record = asObject(value)
  const artwork = asObject(record.artwork)
  const applications = asArray(record.garment_applications)
  const firstApplication = asObject(applications[0])
  const mockupPaths = asObject(firstApplication.mockup_paths)
  const printAreas = asArray(record.printAreas || firstApplication.print_areas)
    .map((item, areaIndex) => normalizePrintArea(item, areaIndex))
    .filter(area => area.label)

  return {
    id: toStringValue(record.id).trim() || createProofItemId('design'),
    index: index + 1,
    name: toStringValue(record.name, `Design ${index + 1}`).trim() || `Design ${index + 1}`,
    subtitle: toStringValue(record.subtitle).trim(),
    garmentLabel: toStringValue(record.garmentLabel || firstApplication.product_name).trim(),
    colourName: toStringValue(record.colourName || firstApplication.colour_label || firstApplication.colour_code).trim(),
    frontMockupUrl: toStringValue(record.frontMockupUrl || mockupPaths.front).trim(),
    backMockupUrl: toStringValue(record.backMockupUrl || mockupPaths.back).trim(),
    artworkUrl: toStringValue(record.artworkUrl || artwork.preview_url).trim(),
    artworkBackground: cleanHex(record.artworkBackground || artwork.background_colour),
    artworkNotes: toStringValue(record.artworkNotes || artwork.notes).trim(),
    printHeightsNote: toStringValue(record.printHeightsNote || record.print_heights_note, 'IF GARMENTS DIFFER').trim(),
    productionNote: toStringValue(record.productionNote || record.production_note, 'N/A').trim(),
    printAreas: printAreas.length > 0 ? printAreas : [createDefaultPrintArea()],
  }
}

function normalizePrintArea(value: unknown, index: number): ProofPrintArea {
  const record = asObject(value)
  const width = record.widthMm ?? record.dimensions_w_mm
  const height = record.heightMm ?? record.dimensions_h_mm

  return {
    id: toStringValue(record.id).trim() || createProofItemId('area'),
    label: toStringValue(record.label, index === 0 ? 'LEFT CHEST' : 'PRINT AREA').trim(),
    method: normalizeMethod(record.method),
    widthMm: toStringValue(width).trim(),
    heightMm: toStringValue(height).trim(),
    pantone: toStringValue(record.pantone, 'White').trim(),
    pantoneHex: cleanHex(record.pantoneHex, '#ffffff'),
    artworkStatus: toStringValue(record.artworkStatus, 'NEW').trim(),
    productionNote: toStringValue(record.productionNote || record.production_note, 'N/A').trim(),
  }
}

function normalizeOrderLine(value: unknown): ProofOrderLine {
  const record = asObject(value)
  const quantities = createDefaultQuantities()
  const sourceQuantities = asObject(record.quantities || record.sizes)

  SIZE_COLUMNS.forEach(column => {
    quantities[column] = toStringValue(sourceQuantities[column]).trim()
  })

  if ('one_size_qty' in record && !quantities['One Size']) {
    quantities['One Size'] = toStringValue(record.one_size_qty).trim()
  }

  return {
    id: toStringValue(record.id).trim() || createProofItemId('line'),
    designIndex: Number(toStringValue(record.designIndex || record.design_index, '1')) || 1,
    name: toStringValue(record.name || record.label).trim(),
    isStaff: toBooleanValue(record.isStaff || record.is_staff_subtotal, false),
    brand: toStringValue(record.brand || record.brand_name).trim(),
    garment: toStringValue(record.garment || record.garment_label).trim(),
    sku: toStringValue(record.sku).trim(),
    colour: toStringValue(record.colour || record.colour_code).trim(),
    quantities,
  }
}

export function reindexDesigns<T extends { index: number }>(designs: T[]) {
  return designs.map((design, index) => ({ ...design, index: index + 1 }))
}

export function calculateLineTotal(line: ProofOrderLine) {
  return SIZE_COLUMNS.reduce((total, column) => {
    const value = Number.parseInt(line.quantities[column] || '0', 10)
    return total + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)
}

export function mapDbProofSummary(
  row: ProofRow,
  organization: OrganizationSummary | null,
  version?: VersionRow | null
): ProofSummary {
  const document = version ? normalizeProofDocument(version.snapshot_data, {
    customerName: row.customer_name || organization?.name || '',
    customerEmail: row.customer_email,
    jobName: row.name,
  }) : null

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: organization?.name || 'Unknown organization',
    name: row.name,
    customerEmail: row.customer_email,
    customerName: row.customer_name || '',
    status: row.status,
    currentVersionId: row.current_version_id,
    versionNumber: version?.version_number ?? null,
    designCount: document?.designs.length ?? 0,
    orderLineCount: document?.orderLines.length ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapDbProofDetail(
  row: ProofRow,
  organization: OrganizationSummary | null,
  version?: VersionRow | null
): ProofDetail {
  const fallback = createDefaultProofDocument({
    organizationId: row.organization_id,
    organizationName: organization?.name || row.customer_name || 'Client',
    customerName: row.customer_name || organization?.name || '',
    customerEmail: row.customer_email,
    jobName: row.name,
  })
  const document = version
    ? normalizeProofDocument(version.snapshot_data, fallback)
    : fallback

  return {
    ...mapDbProofSummary(row, organization, version),
    document: {
      ...document,
      customerName: document.customerName || row.customer_name || organization?.name || '',
      customerEmail: document.customerEmail || row.customer_email,
      jobName: document.jobName || row.name,
    },
  }
}

export function validateProofForExport(proof: ProofDetail) {
  const errors: string[] = []
  const document = proof.document

  if (!document.customerName) errors.push('Customer name is required.')
  if (!document.customerEmail) errors.push('Customer email is required.')
  if (!document.jobName) errors.push('Job name is required.')
  if (document.designs.length === 0) errors.push('At least one design is required.')
  if (document.orderLines.length === 0) errors.push('At least one garment/order line is required.')

  document.designs.forEach(design => {
    if (!design.name) errors.push(`Design ${design.index} needs a name.`)
    if (!design.frontMockupUrl && !design.backMockupUrl && !design.artworkUrl) {
      errors.push(`Design ${design.index} needs at least one mockup or artwork image.`)
    }
    if (design.printAreas.length === 0) {
      errors.push(`Design ${design.index} needs at least one print area.`)
    }
  })

  document.orderLines.forEach((line, index) => {
    if (!line.name && !line.garment) {
      errors.push(`Order line ${index + 1} needs a name or garment.`)
    }
    if (calculateLineTotal(line) <= 0) {
      errors.push(`Order line ${index + 1} needs at least one quantity.`)
    }
  })

  return errors
}

export function buildProofExportTitle(proof: Pick<ProofDetail, 'organizationName' | 'name'>) {
  const baseName = [proof.organizationName, proof.name]
    .map(value => value.trim())
    .filter(Boolean)
    .join(' proof ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return `${baseName || 'design proof'}.pdf`
}
