import type {
  ProofCreateInput,
  ProofDetail,
  ProofDocument,
  ProofMethod,
  ProofMockupAsset,
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

function toNumberValue(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
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
    mockupAssets: [],
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

export function normalizeProofMockupAssets(value: unknown): ProofMockupAsset[] {
  return asArray(value)
    .map(normalizeProofMockupAsset)
    .filter((asset): asset is ProofMockupAsset => Boolean(asset))
}

function normalizeProofMockupAsset(value: unknown): ProofMockupAsset | null {
  const record = asObject(value)
  const artwork = asObject(record.artwork)
  const mockup = asObject(record.mockup)
  const placement = asObject(record.placement_transform)
  const dimensions = asObject(record.dimensions_mm)
  const decoration = asObject(record.decoration)
  const pricingRef = asObject(decoration.pricing_ref)
  const quantities = asObject(record.quantities)
  const decorationSourceId = pricingRef.decoration_source_id
  const oneSizeQty = quantities.one_size_qty

  const productId = toStringValue(record.product_id).trim()
  const productViewKey = toStringValue(record.product_view_key).trim()
  const printAreaKey = toStringValue(record.print_area_key).trim()
  const artworkPath = toStringValue(artwork.storage_path).trim()
  const artworkUrl = toStringValue(artwork.preview_url).trim()
  const mockupPath = toStringValue(mockup.storage_path).trim()
  const mockupUrl = toStringValue(mockup.preview_url).trim()

  if (!productId || !productViewKey || !printAreaKey || !mockupPath) return null

  const method = normalizeMethod(decoration.method)
  const pricingKind = toStringValue(pricingRef.kind).trim()
  const kind =
    pricingKind === 'catalogue_item' || pricingKind === 'quote_builder_decoration'
      ? pricingKind
      : 'product'

  return {
    schema_version: 1,
    product_id: productId,
    variant_id: toStringValue(record.variant_id).trim() || null,
    catalogue_item_id: toStringValue(record.catalogue_item_id).trim() || null,
    product_view_key: productViewKey,
    product_image_id: toStringValue(record.product_image_id).trim() || null,
    print_area_key: printAreaKey,
    artwork: {
      storage_path: artworkPath,
      preview_url: artworkUrl,
      original_filename: toStringValue(artwork.original_filename).trim() || undefined,
    },
    mockup: {
      storage_path: mockupPath,
      preview_url: mockupUrl,
      width_px: mockup.width_px === undefined ? undefined : toNumberValue(mockup.width_px),
      height_px: mockup.height_px === undefined ? undefined : toNumberValue(mockup.height_px),
    },
    placement_transform: {
      x: toNumberValue(placement.x),
      y: toNumberValue(placement.y),
      w: toNumberValue(placement.w),
      h: toNumberValue(placement.h),
      rotation: placement.rotation === undefined ? undefined : toNumberValue(placement.rotation),
      coordinate_space: 'print_area_normalized',
    },
    dimensions_mm: {
      artwork_w: toNumberValue(dimensions.artwork_w),
      artwork_h: toNumberValue(dimensions.artwork_h),
      print_area_w: dimensions.print_area_w === undefined ? undefined : toNumberValue(dimensions.print_area_w),
      print_area_h: dimensions.print_area_h === undefined ? undefined : toNumberValue(dimensions.print_area_h),
    },
    decoration: {
      method,
      pantones: asArray(decoration.pantones).map(item => toStringValue(item).trim()).filter(Boolean),
      production_note: toStringValue(decoration.production_note).trim() || null,
      pricing_ref: {
        kind,
        product_id: toStringValue(pricingRef.product_id, productId).trim() || productId,
        catalogue_item_id: toStringValue(pricingRef.catalogue_item_id).trim() || null,
        decoration_source_id: decorationSourceId === undefined || decorationSourceId === null || decorationSourceId === ''
          ? null
          : toNumberValue(decorationSourceId),
        decoration_type: toStringValue(pricingRef.decoration_type).trim() || undefined,
        decoration_detail: toStringValue(pricingRef.decoration_detail).trim() || undefined,
        location_key: toStringValue(pricingRef.location_key, printAreaKey).trim() || printAreaKey,
      },
    },
    quantities: {
      sizes: normalizeQuantitySizes(quantities.sizes),
      one_size_qty: oneSizeQty === undefined || oneSizeQty === null || oneSizeQty === ''
        ? null
        : toNumberValue(oneSizeQty),
      total_qty: toNumberValue(quantities.total_qty),
    },
  }
}

function normalizeQuantitySizes(value: unknown) {
  const source = asObject(value)
  return Object.entries(source).reduce<Record<string, number>>((acc, [key, raw]) => {
    const qty = toNumberValue(raw)
    if (key && qty > 0) acc[key] = qty
    return acc
  }, {})
}

function normalizeSizeColumn(key: string) {
  const trimmed = key.trim()
  if ((SIZE_COLUMNS as readonly string[]).includes(trimmed)) return trimmed
  const normalized = trimmed.toLowerCase().replace(/\s+/g, '')
  const aliases: Record<string, string> = {
    os: 'One Size',
    onesize: 'One Size',
    xxs: 'XXS/6',
    xs: 'XS/8',
    s: 'SML/10',
    sml: 'SML/10',
    small: 'SML/10',
    m: 'MED/12',
    med: 'MED/12',
    medium: 'MED/12',
    l: 'LRG/14',
    lrg: 'LRG/14',
    large: 'LRG/14',
    xl: 'XLG/16',
    xlg: 'XLG/16',
    '2xl': '2XL/18',
    xxl: '2XL/18',
    '3xl': '3XL/20',
    '4xl': '4XL/22',
    '5xl': '5XL/24',
  }
  return aliases[normalized] ?? trimmed
}

export function normalizeProofDocument(value: unknown, fallback?: Partial<ProofDocument>): ProofDocument {
  const record = asObject(value)

  if ('customer' in record || 'job' in record || 'line_items' in record) {
    return normalizeLegacySnapshot(record, fallback)
  }

  const designs = asArray(record.designs)
    .map((item, index) => normalizeDesign(item, index))
    .filter(design => (
      design.name ||
      design.frontMockupUrl ||
      design.backMockupUrl ||
      design.artworkUrl ||
      (design.mockupAssets?.length ?? 0) > 0
    ))

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
  const mockupAssets = normalizeProofMockupAssets(record.mockupAssets || record.mockup_assets)
  const frontAssetUrl = firstAssetUrlForView(mockupAssets, 'front')
  const backAssetUrl = firstAssetUrlForView(mockupAssets, 'back')
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
    frontMockupUrl: frontAssetUrl || toStringValue(record.frontMockupUrl || mockupPaths.front).trim(),
    backMockupUrl: backAssetUrl || toStringValue(record.backMockupUrl || mockupPaths.back).trim(),
    artworkUrl: toStringValue(record.artworkUrl || artwork.preview_url).trim(),
    artworkBackground: cleanHex(record.artworkBackground || artwork.background_colour),
    artworkNotes: toStringValue(record.artworkNotes || artwork.notes).trim(),
    printHeightsNote: toStringValue(record.printHeightsNote || record.print_heights_note, 'IF GARMENTS DIFFER').trim(),
    productionNote: toStringValue(record.productionNote || record.production_note, 'N/A').trim(),
    mockupAssets,
    printAreas: printAreas.length > 0 ? printAreas : printAreasFromAssets(mockupAssets),
  }
}

function firstAssetUrlForView(assets: ProofMockupAsset[], view: string) {
  const match = assets.find(asset => asset.product_view_key.toLowerCase() === view)
  return match?.mockup.preview_url || match?.mockup.storage_path || ''
}

function printAreasFromAssets(assets: ProofMockupAsset[]): ProofPrintArea[] {
  const unique = new Map<string, ProofMockupAsset>()
  assets.forEach(asset => {
    if (!unique.has(asset.print_area_key)) unique.set(asset.print_area_key, asset)
  })

  const areas = Array.from(unique.values()).map((asset, index) => ({
    id: createProofItemId('area'),
    label: asset.print_area_key || (index === 0 ? 'LEFT CHEST' : 'PRINT AREA'),
    method: asset.decoration.method,
    widthMm: toStringValue(asset.dimensions_mm.artwork_w || asset.dimensions_mm.print_area_w),
    heightMm: toStringValue(asset.dimensions_mm.artwork_h || asset.dimensions_mm.print_area_h),
    pantone: asset.decoration.pantones.join(', '),
    pantoneHex: '#ffffff',
    artworkStatus: 'NEW',
    productionNote: asset.decoration.production_note || 'N/A',
  }))

  return areas.length > 0 ? areas : [createDefaultPrintArea()]
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

  Object.entries(sourceQuantities).forEach(([sourceColumn, raw]) => {
    const column = normalizeSizeColumn(sourceColumn)
    if (column in quantities) {
      quantities[column] = toStringValue(raw).trim()
    }
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
    productId: toStringValue(record.productId || record.product_id).trim() || undefined,
    productVariantId: toStringValue(record.productVariantId || record.product_variant_id).trim() || null,
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

export function mergeProofMockupAssets(document: ProofDocument, rawAssets: unknown): ProofDocument {
  const assets = normalizeProofMockupAssets(rawAssets)
  if (assets.length === 0) return document

  const groups = groupAssetsByArtwork(assets)
  const designs = document.designs.length > 0 ? [...document.designs] : [createDefaultDesign(1)]
  const orderLines = [...document.orderLines]

  groups.forEach((group, groupIndex) => {
    const designIndex = findDesignIndexForAssets(designs, group, groupIndex)
    const currentDesign = designs[designIndex] ?? createDefaultDesign(designs.length + 1)
    const mergedAssets = dedupeAssets([...(currentDesign.mockupAssets ?? []), ...group])
    const firstAsset = mergedAssets[0]

    designs[designIndex] = {
      ...currentDesign,
      name: currentDesign.name || `Design ${designIndex + 1}`,
      artworkUrl: currentDesign.artworkUrl || firstAsset?.artwork.preview_url || '',
      frontMockupUrl: firstAssetUrlForView(mergedAssets, 'front') || currentDesign.frontMockupUrl,
      backMockupUrl: firstAssetUrlForView(mergedAssets, 'back') || currentDesign.backMockupUrl,
      mockupAssets: mergedAssets,
      printAreas: mergePrintAreas(currentDesign.printAreas, printAreasFromAssets(group)),
    }

    const assetLine = orderLineFromAsset(group[0], designs[designIndex].index)
    if (assetLine) {
      const existingLineIndex = orderLines.findIndex(line => line.designIndex === assetLine.designIndex)
      if (existingLineIndex >= 0) {
        orderLines[existingLineIndex] = {
          ...orderLines[existingLineIndex],
          productId: orderLines[existingLineIndex].productId || assetLine.productId,
          productVariantId: orderLines[existingLineIndex].productVariantId ?? assetLine.productVariantId,
          quantities: mergeQuantities(orderLines[existingLineIndex].quantities, assetLine.quantities),
        }
      } else {
        orderLines.push(assetLine)
      }
    }
  })

  return {
    ...document,
    designs: reindexDesigns(designs),
    orderLines: orderLines.length > 0 ? orderLines : document.orderLines,
  }
}

function groupAssetsByArtwork(assets: ProofMockupAsset[]) {
  const grouped = new Map<string, ProofMockupAsset[]>()
  assets.forEach(asset => {
    const key = asset.artwork.storage_path || asset.artwork.preview_url || asset.product_id
    grouped.set(key, [...(grouped.get(key) ?? []), asset])
  })
  return Array.from(grouped.values())
}

function findDesignIndexForAssets(designs: ProofDocument['designs'], assets: ProofMockupAsset[], fallbackIndex: number) {
  const first = assets[0]
  const byArtwork = designs.findIndex(design => (
    Boolean(design.artworkUrl) &&
    (design.artworkUrl === first.artwork.preview_url || design.artworkUrl === first.artwork.storage_path)
  ))
  if (byArtwork >= 0) return byArtwork
  return fallbackIndex
}

function dedupeAssets(assets: ProofMockupAsset[]) {
  const byKey = new Map<string, ProofMockupAsset>()
  assets.forEach(asset => {
    const key = [
      asset.product_id,
      asset.variant_id ?? '',
      asset.product_view_key,
      asset.print_area_key,
      asset.mockup.storage_path,
    ].join('|')
    byKey.set(key, asset)
  })
  return Array.from(byKey.values())
}

function mergePrintAreas(current: ProofPrintArea[], imported: ProofPrintArea[]) {
  const byLabel = new Map<string, ProofPrintArea>()
  current.forEach(area => byLabel.set(area.label.toLowerCase(), area))
  imported.forEach(area => {
    const key = area.label.toLowerCase()
    if (!byLabel.has(key)) byLabel.set(key, area)
  })
  return Array.from(byLabel.values())
}

function orderLineFromAsset(asset: ProofMockupAsset | undefined, designIndex: number): ProofOrderLine | null {
  if (!asset || asset.quantities.total_qty <= 0) return null
  const quantities = createDefaultQuantities()
  Object.entries(asset.quantities.sizes).forEach(([size, qty]) => {
    const column = normalizeSizeColumn(size)
    if (column in quantities) quantities[column] = String(qty)
  })
  if (asset.quantities.one_size_qty && !quantities['One Size']) {
    quantities['One Size'] = String(asset.quantities.one_size_qty)
  }
  return {
    ...createDefaultOrderLine(designIndex),
    name: `Design ${designIndex}`,
    productId: asset.product_id,
    productVariantId: asset.variant_id,
    quantities,
  }
}

function mergeQuantities(current: Record<string, string>, imported: Record<string, string>) {
  return Object.entries(imported).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = acc[key] || value
    return acc
  }, { ...current })
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
