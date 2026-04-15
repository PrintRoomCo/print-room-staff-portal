function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const GENERATED_ASSET_STATUSES = ['generated', 'selected', 'approved', 'archived'] as const

export type GeneratedAssetStatus = (typeof GENERATED_ASSET_STATUSES)[number]

export interface GeneratedImageAsset {
  id: string
  sourceRecordId: string
  jobId: string
  jobType: string
  sourceItemId: string
  sourceItemName: string
  productLabel: string
  assetType: string
  workflowType?: string
  presetKey?: string
  destinationTags: string[]
  status: GeneratedAssetStatus
  storageUrl: string
  replicateOutputUrl?: string
  briefSummary?: string
  sourcePortal?: string
  userId?: string
  userEmail?: string
  userDisplayName?: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function normalizeGeneratedAsset(value: unknown): GeneratedImageAsset | null {
  if (!isRecord(value)) return null

  const id = toStringValue(value.id)
  const sourceRecordId = toStringValue(value.sourceRecordId) || toStringValue(value.source_record_id)
  const jobId = toStringValue(value.jobId) || toStringValue(value.job_id)
  const jobType = toStringValue(value.jobType) || toStringValue(value.job_type)
  const sourceItemId = toStringValue(value.sourceItemId) || toStringValue(value.source_item_id)
  const sourceItemName = toStringValue(value.sourceItemName) || toStringValue(value.source_item_name)
  const productLabel = toStringValue(value.productLabel) || toStringValue(value.product_label)
  const assetType = toStringValue(value.assetType) || toStringValue(value.asset_type)
  const storageUrl = toStringValue(value.storageUrl) || toStringValue(value.storage_url)
  const createdAt = toStringValue(value.createdAt) || toStringValue(value.created_at)
  const updatedAt = toStringValue(value.updatedAt) || toStringValue(value.updated_at)

  if (
    !id ||
    !sourceRecordId ||
    !jobId ||
    !jobType ||
    !sourceItemId ||
    !sourceItemName ||
    !productLabel ||
    !assetType ||
    !storageUrl ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  const rawStatus = toStringValue(value.status)
  const status = GENERATED_ASSET_STATUSES.includes(rawStatus as GeneratedAssetStatus)
    ? (rawStatus as GeneratedAssetStatus)
    : 'generated'

  return {
    id,
    sourceRecordId,
    jobId,
    jobType,
    sourceItemId,
    sourceItemName,
    productLabel,
    assetType,
    workflowType: toStringValue(value.workflowType) || toStringValue(value.workflow_type),
    presetKey: toStringValue(value.presetKey) || toStringValue(value.preset_key),
    destinationTags: toStringArray(value.destinationTags ?? value.destination_tags),
    status,
    storageUrl,
    replicateOutputUrl: toStringValue(value.replicateOutputUrl) || toStringValue(value.replicate_output_url),
    briefSummary: toStringValue(value.briefSummary) || toStringValue(value.brief_summary),
    sourcePortal: toStringValue(value.sourcePortal) || toStringValue(value.source_portal),
    userId: toStringValue(value.userId) || toStringValue(value.user_id),
    userEmail: toStringValue(value.userEmail) || toStringValue(value.user_email),
    userDisplayName: toStringValue(value.userDisplayName) || toStringValue(value.user_display_name),
    metadata: isRecord(value.metadata) ? value.metadata : {},
    createdAt,
    updatedAt,
  }
}

export function normalizeGeneratedAssets(value: unknown): GeneratedImageAsset[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeGeneratedAsset)
    .filter((asset): asset is GeneratedImageAsset => asset !== null)
}
