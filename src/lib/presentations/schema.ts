import type {
  CommercialTermsPayload,
  PackagingIdea,
  PresentationAssetReference,
  PresentationCreateInput,
  PresentationDetail,
  PresentationSection,
  PresentationSectionKind,
  PresentationSectionPayload,
  PresentationStatus,
  PresentationUpdateInput,
  PricingRow,
  ProductPackagingPayload,
  ProductPricingPayload,
  ProductStoryPayload,
  SupportingIdeaPayload,
} from '@/types/presentations'
import {
  PRESENTATION_SECTION_KINDS,
  PRESENTATION_STATUSES,
} from '@/types/presentations'

type UnknownRecord = Record<string, unknown>

export function createSectionId() {
  return globalThis.crypto?.randomUUID?.() ?? `section-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function asObject(value: unknown): UnknownRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toBooleanValue(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback
}

function toStringArray(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, limit)
}

function normalizePackagingIdeas(value: unknown): PackagingIdea[] {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      const record = asObject(item)
      return {
        title: toStringValue(record.title).trim(),
        body: toStringValue(record.body).trim(),
      }
    })
    .filter(item => item.title || item.body)
    .slice(0, 8)
}

function normalizePricingRows(value: unknown): PricingRow[] {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      const record = asObject(item)
      return {
        label: toStringValue(record.label).trim(),
        details: toStringArray(record.details, 8),
        values: toStringArray(record.values, 8),
      }
    })
    .filter(item => item.label || item.details.length > 0 || item.values.length > 0)
    .slice(0, 16)
}

function normalizePresentationAssetReference(value: unknown): PresentationAssetReference | null {
  const record = asObject(value)
  const assetId = toStringValue(record.assetId).trim()
  const label = toStringValue(record.label).trim()
  const type = toStringValue(record.type).trim()
  const url = toStringValue(record.url).trim()

  if (!assetId || !label || !type || !url) {
    return null
  }

  return {
    assetId,
    label,
    type,
    url,
    workflowType: toStringValue(record.workflowType).trim() || undefined,
    status: toStringValue(record.status).trim() || undefined,
    briefSummary: toStringValue(record.briefSummary).trim() || undefined,
  }
}

function normalizePresentationAssetReferences(value: unknown, limit = 4): PresentationAssetReference[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizePresentationAssetReference)
    .filter((asset): asset is PresentationAssetReference => asset !== null)
    .slice(0, limit)
}

export function isPresentationSectionKind(value: string): value is PresentationSectionKind {
  return PRESENTATION_SECTION_KINDS.includes(value as PresentationSectionKind)
}

export function isPresentationStatus(value: string): value is PresentationStatus {
  return PRESENTATION_STATUSES.includes(value as PresentationStatus)
}

export function createEmptySectionPayload(kind: PresentationSectionKind): PresentationSectionPayload {
  switch (kind) {
    case 'product-story':
      return {
        productName: '',
        tagline: '',
        storyCopy: '',
        mockupCaption: '',
        mockupNote: '',
        featuredAsset: null,
        supportingAssets: [],
      } satisfies ProductStoryPayload
    case 'product-pricing':
      return {
        productName: '',
        customisationOptions: [],
        leadTime: '',
        pricingTitle: 'Indicative pricing',
        pricingColumns: ['Option', 'Price'],
        pricingRows: [],
        pricingDisclaimer: '',
        recommendationTitle: 'Our recommendation',
        recommendationBody: '',
        retailNote: '',
        certifications: [],
      } satisfies ProductPricingPayload
    case 'product-packaging':
      return {
        productName: '',
        intro: '',
        packagingIdeas: [],
        footerNote: '',
      } satisfies ProductPackagingPayload
    case 'supporting-idea':
      return {
        eyebrow: '',
        headline: '',
        body: '',
      } satisfies SupportingIdeaPayload
    case 'commercial-terms':
      return {
        shippingTerms: '',
        paymentTerms: '',
        disclaimer: '',
      } satisfies CommercialTermsPayload
    default:
      return {}
  }
}

export function createBlankSection(kind: PresentationSectionKind, sortOrder: number): PresentationSection {
  const titles: Record<PresentationSectionKind, string> = {
    cover: 'Cover',
    'brand-intro': 'Print Room introduction',
    'brand-context': 'Client context',
    'product-story': 'Product story',
    'product-pricing': 'Product pricing',
    'product-packaging': 'Packaging ideas',
    'supporting-idea': 'Supporting idea',
    'commercial-terms': 'Commercial terms',
  }

  const bodies: Record<PresentationSectionKind, string> = {
    cover: 'Create a proposal that feels tailored, clear, and commercially grounded.',
    'brand-intro': '',
    'brand-context': '',
    'product-story': '',
    'product-pricing': '',
    'product-packaging': '',
    'supporting-idea': '',
    'commercial-terms': '',
  }

  return {
    id: createSectionId(),
    kind,
    title: titles[kind],
    body: bodies[kind],
    sortOrder,
    isEnabled: true,
    payload: createEmptySectionPayload(kind),
  }
}

export function reindexSections(sections: PresentationSection[]) {
  return sections.map((section, index) => ({
    ...section,
    sortOrder: index,
  }))
}

export function normalizePresentationCreateInput(value: unknown): PresentationCreateInput {
  const record = asObject(value)

  return {
    clientName: toStringValue(record.clientName).trim(),
    clientBrand: toStringValue(record.clientBrand).trim(),
    proposalTitle: toStringValue(record.proposalTitle).trim(),
    seasonLabel: toStringValue(record.seasonLabel).trim(),
    coverDateLabel: toStringValue(record.coverDateLabel).trim(),
    notes: toStringValue(record.notes).trim(),
  }
}

export function normalizePresentationUpdateInput(value: unknown): PresentationUpdateInput {
  const record = asObject(value)
  const next: PresentationUpdateInput = {}

  if ('clientName' in record) next.clientName = toStringValue(record.clientName).trim()
  if ('clientBrand' in record) next.clientBrand = toStringValue(record.clientBrand).trim()
  if ('proposalTitle' in record) next.proposalTitle = toStringValue(record.proposalTitle).trim()
  if ('seasonLabel' in record) next.seasonLabel = toStringValue(record.seasonLabel).trim()
  if ('coverDateLabel' in record) next.coverDateLabel = toStringValue(record.coverDateLabel).trim()
  if ('notes' in record) next.notes = toStringValue(record.notes).trim()
  if ('status' in record) {
    const status = toStringValue(record.status).trim()
    if (!isPresentationStatus(status)) {
      throw new Error('Invalid presentation status')
    }
    next.status = status
  }

  return next
}

export function normalizePresentationSectionsInput(value: unknown): PresentationSection[] {
  if (!Array.isArray(value)) {
    throw new Error('Sections must be an array')
  }

  return value.map((item, index) => normalizeSection(item, index))
}

function normalizeSection(value: unknown, index: number): PresentationSection {
  const record = asObject(value)
  const kindValue = toStringValue(record.kind).trim()

  if (!isPresentationSectionKind(kindValue)) {
    throw new Error(`Invalid section kind: ${kindValue || 'unknown'}`)
  }

  return {
    id: toStringValue(record.id).trim() || createSectionId(),
    kind: kindValue,
    title: toStringValue(record.title).trim(),
    body: toStringValue(record.body).trim(),
    sortOrder: index,
    isEnabled: toBooleanValue(record.isEnabled, true),
    payload: normalizeSectionPayload(kindValue, record.payload),
  }
}

function normalizeSectionPayload(kind: PresentationSectionKind, value: unknown): PresentationSectionPayload {
  const record = asObject(value)

  switch (kind) {
    case 'product-story':
      return {
        productName: toStringValue(record.productName).trim(),
        tagline: toStringValue(record.tagline).trim(),
        storyCopy: toStringValue(record.storyCopy).trim(),
        mockupCaption: toStringValue(record.mockupCaption).trim(),
        mockupNote: toStringValue(record.mockupNote).trim(),
        featuredAsset: normalizePresentationAssetReference(record.featuredAsset),
        supportingAssets: normalizePresentationAssetReferences(record.supportingAssets),
      } satisfies ProductStoryPayload
    case 'product-pricing':
      return {
        productName: toStringValue(record.productName).trim(),
        customisationOptions: toStringArray(record.customisationOptions, 12),
        leadTime: toStringValue(record.leadTime).trim(),
        pricingTitle: toStringValue(record.pricingTitle, 'Indicative pricing').trim() || 'Indicative pricing',
        pricingColumns: toStringArray(record.pricingColumns, 6),
        pricingRows: normalizePricingRows(record.pricingRows),
        pricingDisclaimer: toStringValue(record.pricingDisclaimer).trim(),
        recommendationTitle: toStringValue(record.recommendationTitle, 'Our recommendation').trim() || 'Our recommendation',
        recommendationBody: toStringValue(record.recommendationBody).trim(),
        retailNote: toStringValue(record.retailNote).trim(),
        certifications: toStringArray(record.certifications, 10),
      } satisfies ProductPricingPayload
    case 'product-packaging':
      return {
        productName: toStringValue(record.productName).trim(),
        intro: toStringValue(record.intro).trim(),
        packagingIdeas: normalizePackagingIdeas(record.packagingIdeas),
        footerNote: toStringValue(record.footerNote).trim(),
      } satisfies ProductPackagingPayload
    case 'supporting-idea':
      return {
        eyebrow: toStringValue(record.eyebrow).trim(),
        headline: toStringValue(record.headline).trim(),
        body: toStringValue(record.body).trim(),
      } satisfies SupportingIdeaPayload
    case 'commercial-terms':
      return {
        shippingTerms: toStringValue(record.shippingTerms).trim(),
        paymentTerms: toStringValue(record.paymentTerms).trim(),
        disclaimer: toStringValue(record.disclaimer).trim(),
      } satisfies CommercialTermsPayload
    default:
      return {}
  }
}

export function validateRequiredCreateFields(input: PresentationCreateInput) {
  const missingFields: string[] = []

  if (!input.clientName) missingFields.push('clientName')
  if (!input.clientBrand) missingFields.push('clientBrand')
  if (!input.proposalTitle) missingFields.push('proposalTitle')
  if (!input.seasonLabel) missingFields.push('seasonLabel')
  if (!input.coverDateLabel) missingFields.push('coverDateLabel')

  return missingFields
}

export function validatePresentationForReady(
  presentation: Pick<PresentationDetail, 'clientName' | 'clientBrand' | 'proposalTitle' | 'seasonLabel' | 'coverDateLabel'>,
  sections: PresentationSection[]
) {
  const errors: string[] = []
  const enabledSections = sections.filter(section => section.isEnabled)

  if (!presentation.clientName) errors.push('Client name is required.')
  if (!presentation.clientBrand) errors.push('Client brand is required.')
  if (!presentation.proposalTitle) errors.push('Proposal title is required.')
  if (!presentation.seasonLabel) errors.push('Season label is required.')
  if (!presentation.coverDateLabel) errors.push('Cover date is required.')
  if (!enabledSections.some(section => section.kind === 'cover')) {
    errors.push('At least one cover section must remain enabled.')
  }
  if (!enabledSections.some(section => section.kind === 'commercial-terms')) {
    errors.push('Commercial terms must be included before marking a proposal ready.')
  }
  if (!enabledSections.some(section => section.kind === 'product-story' || section.kind === 'product-pricing')) {
    errors.push('Add at least one product section before marking a proposal ready.')
  }

  enabledSections.forEach(section => {
    if ((section.kind === 'brand-intro' || section.kind === 'brand-context') && !section.body.trim()) {
      errors.push(`${section.title || section.kind} needs body copy.`)
    }

    if (section.kind === 'product-story') {
      const payload = section.payload as ProductStoryPayload
      if (!payload.productName) errors.push('Each product story requires a product name.')
      if (!payload.storyCopy) errors.push(`The ${payload.productName || 'product story'} section needs narrative copy.`)
    }

    if (section.kind === 'product-pricing') {
      const payload = section.payload as ProductPricingPayload
      if (!payload.productName) errors.push('Each product pricing section requires a product name.')
      if (payload.pricingColumns.length === 0) {
        errors.push(`The ${payload.productName || 'product pricing'} section needs at least one pricing column.`)
      }
      if (payload.pricingRows.length === 0) {
        errors.push(`The ${payload.productName || 'product pricing'} section needs at least one pricing row.`)
      }
    }

    if (section.kind === 'commercial-terms') {
      const payload = section.payload as CommercialTermsPayload
      if (!payload.shippingTerms) errors.push('Shipping terms are required.')
      if (!payload.paymentTerms) errors.push('Payment terms are required.')
    }
  })

  return errors
}

export function mapDbPresentationSummary(
  row: {
    id: string
    client_name: string
    client_brand: string
    proposal_title: string
    season_label: string
    cover_date_label: string
    status: PresentationStatus
    notes: string | null
    template_key: string
    created_at: string
    updated_at: string
  },
  sectionCount: number
) {
  return {
    id: row.id,
    clientName: row.client_name,
    clientBrand: row.client_brand,
    proposalTitle: row.proposal_title,
    seasonLabel: row.season_label,
    coverDateLabel: row.cover_date_label,
    status: row.status,
    notes: row.notes || '',
    templateKey: row.template_key,
    sectionCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapDbPresentationDetail(
  row: {
    id: string
    client_name: string
    client_brand: string
    proposal_title: string
    season_label: string
    cover_date_label: string
    status: PresentationStatus
    notes: string | null
    template_key: string
    created_at: string
    updated_at: string
  },
  sections: Array<{
    id: string
    kind: string
    title: string
    body: string
    sort_order: number
    is_enabled: boolean
    payload_json: unknown
  }>
) {
  return {
    id: row.id,
    clientName: row.client_name,
    clientBrand: row.client_brand,
    proposalTitle: row.proposal_title,
    seasonLabel: row.season_label,
    coverDateLabel: row.cover_date_label,
    status: row.status,
    notes: row.notes || '',
    templateKey: row.template_key,
    sectionCount: sections.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sections: sections
      .map((section, index) =>
        normalizeSection(
          {
            id: section.id,
            kind: section.kind,
            title: section.title,
            body: section.body,
            sortOrder: section.sort_order,
            isEnabled: section.is_enabled,
            payload: section.payload_json,
          },
          index
        )
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}
