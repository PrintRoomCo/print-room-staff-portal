export type EcommerceImageType = 'lifestyle' | 'white-background' | 'hero' | 'size-guide'
export type EcommerceGenerationMode =
  | 'single-product'
  | 'multi-angle-product'
  | 'multi-product'
  | 'separate-products'
export type EcommerceWorkflowType = 'proposal' | 'web'
export type EcommerceDestinationTag = 'proposal' | 'web'
export type EcommerceWorkflowPreset =
  | 'proposal-hero'
  | 'proposal-lifestyle'
  | 'proposal-comparison'
  | 'proposal-packaging'
  | 'web-listing'
  | 'web-hero'
  | 'web-lifestyle'
  | 'web-collection'
  | 'web-size-guide'

export interface UploadedEcommerceSourceImage {
  id: string
  clientId?: string
  originalFilename: string
  storageUrl: string
  mimeType: string
  sizeBytes: number
  isPrimary?: boolean
}

export interface EcommerceInputItem {
  id: string
  label: string
  primarySourceId: string
  sources: UploadedEcommerceSourceImage[]
}

export interface EcommerceGenerationBrief {
  workflowType?: EcommerceWorkflowType
  presetKey?: EcommerceWorkflowPreset
  projectName?: string
  clientName?: string
  clientBrand?: string
  audience?: string
  tone?: string
  usageContext?: string
  merchandisingGoal?: string
  channel?: string
  pageType?: string
  backgroundStyle?: string
  outputIntent?: string
  destinationTags?: EcommerceDestinationTag[]
  customNote?: string
}

export interface EcommerceGenerationConfig {
  mode: EcommerceGenerationMode
  imageTypes: EcommerceImageType[]
  prompt: string
  inputs: EcommerceInputItem[]
  brief?: EcommerceGenerationBrief
}

export interface GeneratedEcommerceImage {
  imageType: EcommerceImageType
  replicateOutputUrl: string
  storageUrl: string
  recordId: string
}

export interface EcommerceGenerationResult {
  itemId: string
  itemName: string
  generatedImages: GeneratedEcommerceImage[]
  errors: string[]
  sourceImages: UploadedEcommerceSourceImage[]
  mode: EcommerceGenerationMode
  prompt: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMode(value: unknown): value is EcommerceGenerationMode {
  return (
    value === 'single-product' ||
    value === 'multi-angle-product' ||
    value === 'multi-product' ||
    value === 'separate-products'
  )
}

export function isEcommerceGenerationConfig(value: unknown): value is EcommerceGenerationConfig {
  if (!isObject(value)) return false

  const config = value as Partial<EcommerceGenerationConfig>
  return (
    typeof config.prompt === 'string' &&
    Array.isArray(config.imageTypes) &&
    Array.isArray(config.inputs) &&
    isMode(config.mode)
  )
}

export function getEcommerceBrief(config: EcommerceGenerationConfig): EcommerceGenerationBrief | null {
  return config.brief && isObject(config.brief) ? config.brief : null
}

export function getEcommerceWorkflowType(config: EcommerceGenerationConfig): EcommerceWorkflowType {
  return getEcommerceBrief(config)?.workflowType === 'proposal' ? 'proposal' : 'web'
}

export function getEcommercePresetKey(config: EcommerceGenerationConfig): EcommerceWorkflowPreset | undefined {
  const brief = getEcommerceBrief(config)
  return typeof brief?.presetKey === 'string' ? brief.presetKey : undefined
}

export function getEcommerceDestinationTags(config: EcommerceGenerationConfig): EcommerceDestinationTag[] {
  const tags = getEcommerceBrief(config)?.destinationTags
  if (!Array.isArray(tags) || tags.length === 0) {
    return [getEcommerceWorkflowType(config)]
  }

  return tags.filter((tag): tag is EcommerceDestinationTag => tag === 'proposal' || tag === 'web')
}

export function getEcommerceInputCount(config: EcommerceGenerationConfig): number {
  return config.inputs.length
}

export function getEcommerceSourceCount(config: EcommerceGenerationConfig): number {
  return config.inputs.reduce((total, input) => total + input.sources.length, 0)
}

export function getEcommerceTotalImages(config: EcommerceGenerationConfig): number {
  return getEcommerceInputCount(config) * config.imageTypes.length
}

export function getEcommerceModeLabel(mode: EcommerceGenerationMode): string {
  switch (mode) {
    case 'single-product':
      return 'single product'
    case 'multi-angle-product':
      return 'one product, multiple angles'
    case 'multi-product':
      return 'multiple products'
    case 'separate-products':
    default:
      return 'separate products'
  }
}

export function getEcommercePresetLabel(presetKey?: EcommerceWorkflowPreset): string | undefined {
  switch (presetKey) {
    case 'proposal-hero':
      return 'Proposal hero'
    case 'proposal-lifestyle':
      return 'Proposal lifestyle'
    case 'proposal-comparison':
      return 'Proposal comparison'
    case 'proposal-packaging':
      return 'Proposal packaging'
    case 'web-listing':
      return 'Web listing'
    case 'web-hero':
      return 'Web hero'
    case 'web-lifestyle':
      return 'Web lifestyle'
    case 'web-collection':
      return 'Collection asset'
    case 'web-size-guide':
      return 'Size guide'
    default:
      return undefined
  }
}

export function getEcommerceBriefSummary(config: EcommerceGenerationConfig): string {
  const brief = getEcommerceBrief(config)
  const workflow = getEcommerceWorkflowType(config) === 'proposal' ? 'Proposal visuals' : 'Web assets'
  const preset = getEcommercePresetLabel(getEcommercePresetKey(config))
  const brand = brief?.clientBrand?.trim() || brief?.projectName?.trim()
  const parts = [workflow, preset, brand].filter(Boolean)

  if (parts.length > 0) {
    return parts.join(' · ')
  }

  return config.prompt.trim() || workflow
}

export function getEcommerceJobSummary(config: EcommerceGenerationConfig): string {
  const sourceCount = getEcommerceSourceCount(config)
  const summary = getEcommerceBriefSummary(config)

  return `${sourceCount} upload${sourceCount === 1 ? '' : 's'} · ${summary}`
}
