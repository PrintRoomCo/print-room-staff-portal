function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export interface PipelineSourceImage {
  id: string
  url: string
  name: string
  isPrimary?: boolean
}

export interface PipelineGeneratedItem {
  type: string
  replicateOutputUrl: string
  storageUrl: string
  recordId: string
  assetId?: string
  assetStatus?: string
  workflowType?: string
  presetKey?: string
  destinationTags?: string[]
}

export interface PipelineResult {
  itemId: string
  itemName: string
  generatedItems: PipelineGeneratedItem[]
  errors: string[]
  sourceImages?: PipelineSourceImage[]
  prompt?: string
  mode?: string
  workflowType?: string
  presetKey?: string
  briefSummary?: string
  destinationTags?: string[]
}

function normalizePipelineSourceImage(value: unknown): PipelineSourceImage | null {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' ? value.id : null
  const url =
    typeof value.url === 'string'
      ? value.url
      : typeof value.storageUrl === 'string'
        ? value.storageUrl
        : null
  const name =
    typeof value.name === 'string'
      ? value.name
      : typeof value.originalFilename === 'string'
        ? value.originalFilename
        : null

  if (!id || !url || !name) return null

  return {
    id,
    url,
    name,
    isPrimary: value.isPrimary === true ? true : undefined,
  }
}

function normalizePipelineGeneratedItem(value: unknown): PipelineGeneratedItem | null {
  if (!isRecord(value)) return null

  const type =
    typeof value.type === 'string'
      ? value.type
      : typeof value.imageType === 'string'
        ? value.imageType
        : null
  const replicateOutputUrl =
    typeof value.replicateOutputUrl === 'string' ? value.replicateOutputUrl : ''
  const storageUrl = typeof value.storageUrl === 'string' ? value.storageUrl : null
  const recordId = typeof value.recordId === 'string' ? value.recordId : ''

  if (!type || !storageUrl) return null

  return {
    type,
    replicateOutputUrl,
    storageUrl,
    recordId,
    assetId: typeof value.assetId === 'string' ? value.assetId : undefined,
    assetStatus: typeof value.assetStatus === 'string' ? value.assetStatus : undefined,
    workflowType: typeof value.workflowType === 'string' ? value.workflowType : undefined,
    presetKey: typeof value.presetKey === 'string' ? value.presetKey : undefined,
    destinationTags: toStringArray(value.destinationTags),
  }
}

function normalizePipelineResult(value: unknown): PipelineResult | null {
  if (!isRecord(value)) return null

  const itemId = typeof value.itemId === 'string' ? value.itemId : null
  const itemName = typeof value.itemName === 'string' ? value.itemName : null

  if (!itemId || !itemName) return null

  const generatedItemsSource = Array.isArray(value.generatedItems)
    ? value.generatedItems
    : Array.isArray(value.generatedImages)
      ? value.generatedImages
      : []
  const sourceImages = Array.isArray(value.sourceImages)
    ? value.sourceImages
        .map(normalizePipelineSourceImage)
        .filter((image): image is PipelineSourceImage => image !== null)
    : undefined

  return {
    itemId,
    itemName,
    generatedItems: generatedItemsSource
      .map(normalizePipelineGeneratedItem)
      .filter((item): item is PipelineGeneratedItem => item !== null),
    errors: Array.isArray(value.errors)
      ? value.errors.filter((error): error is string => typeof error === 'string')
      : [],
    sourceImages: sourceImages && sourceImages.length > 0 ? sourceImages : undefined,
    prompt: typeof value.prompt === 'string' ? value.prompt : undefined,
    mode: typeof value.mode === 'string' ? value.mode : undefined,
    workflowType: typeof value.workflowType === 'string' ? value.workflowType : undefined,
    presetKey: typeof value.presetKey === 'string' ? value.presetKey : undefined,
    briefSummary: typeof value.briefSummary === 'string' ? value.briefSummary : undefined,
    destinationTags: toStringArray(value.destinationTags),
  }
}

function parsePipelineResults(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

export function normalizePipelineResults(value: unknown): PipelineResult[] {
  const parsedValue = typeof value === 'string' ? parsePipelineResults(value) : value
  if (!Array.isArray(parsedValue)) return []

  return parsedValue
    .map(normalizePipelineResult)
    .filter((result): result is PipelineResult => result !== null)
}
