export type EcommerceImageType = 'lifestyle' | 'white-background' | 'hero' | 'size-guide'
export type EcommerceGenerationMode = 'separate-products' | 'multi-angle-product'

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

export interface EcommerceGenerationConfig {
  mode: EcommerceGenerationMode
  imageTypes: EcommerceImageType[]
  prompt: string
  inputs: EcommerceInputItem[]
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

export function isEcommerceGenerationConfig(value: unknown): value is EcommerceGenerationConfig {
  if (!value || typeof value !== 'object') return false

  const config = value as Partial<EcommerceGenerationConfig>
  return (
    typeof config.prompt === 'string' &&
    Array.isArray(config.imageTypes) &&
    Array.isArray(config.inputs) &&
    (config.mode === 'separate-products' || config.mode === 'multi-angle-product')
  )
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

export function getEcommerceJobSummary(config: EcommerceGenerationConfig): string {
  const sourceCount = getEcommerceSourceCount(config)
  const inputCount = getEcommerceInputCount(config)

  if (config.mode === 'multi-angle-product') {
    return `${sourceCount} uploads (${inputCount} product set${inputCount === 1 ? '' : 's'})`
  }

  return `${sourceCount} upload${sourceCount === 1 ? '' : 's'}`
}
