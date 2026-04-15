export const PRESENTATION_STATUSES = ['draft', 'ready', 'archived'] as const

export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number]

export const PRESENTATION_SECTION_KINDS = [
  'cover',
  'brand-intro',
  'brand-context',
  'product-story',
  'product-pricing',
  'product-packaging',
  'supporting-idea',
  'commercial-terms',
] as const

export type PresentationSectionKind = (typeof PRESENTATION_SECTION_KINDS)[number]

export interface PricingRow {
  label: string
  details: string[]
  values: string[]
}

export interface PackagingIdea {
  title: string
  body: string
}

export interface PresentationAssetReference {
  assetId: string
  label: string
  type: string
  url: string
  workflowType?: string
  status?: string
  briefSummary?: string
}

export interface ProductStoryPayload {
  productName: string
  tagline: string
  storyCopy: string
  mockupCaption: string
  mockupNote: string
  featuredAsset?: PresentationAssetReference | null
  supportingAssets: PresentationAssetReference[]
}

export interface ProductPricingPayload {
  productName: string
  customisationOptions: string[]
  leadTime: string
  pricingTitle: string
  pricingColumns: string[]
  pricingRows: PricingRow[]
  pricingDisclaimer: string
  recommendationTitle: string
  recommendationBody: string
  retailNote: string
  certifications: string[]
}

export interface ProductPackagingPayload {
  productName: string
  intro: string
  packagingIdeas: PackagingIdea[]
  footerNote: string
}

export interface SupportingIdeaPayload {
  eyebrow: string
  headline: string
  body: string
}

export interface CommercialTermsPayload {
  shippingTerms: string
  paymentTerms: string
  disclaimer: string
}

export type PresentationSectionPayload =
  | Record<string, never>
  | ProductStoryPayload
  | ProductPricingPayload
  | ProductPackagingPayload
  | SupportingIdeaPayload
  | CommercialTermsPayload

export interface PresentationSection {
  id: string
  kind: PresentationSectionKind
  title: string
  body: string
  sortOrder: number
  isEnabled: boolean
  payload: PresentationSectionPayload
}

export interface PresentationSummary {
  id: string
  clientName: string
  clientBrand: string
  proposalTitle: string
  seasonLabel: string
  coverDateLabel: string
  status: PresentationStatus
  notes: string
  templateKey: string
  sectionCount: number
  createdAt: string
  updatedAt: string
}

export interface PresentationDetail extends PresentationSummary {
  sections: PresentationSection[]
}

export interface PresentationCreateInput {
  clientName: string
  clientBrand: string
  proposalTitle: string
  seasonLabel: string
  coverDateLabel: string
  notes?: string
}

export interface PresentationUpdateInput {
  clientName?: string
  clientBrand?: string
  proposalTitle?: string
  seasonLabel?: string
  coverDateLabel?: string
  notes?: string
  status?: PresentationStatus
}
