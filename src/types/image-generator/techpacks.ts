export type TechpackAssetType = 'flat-drawing' | 'construction-detail' | 'measurement-diagram' | 'fabric-callout' | 'color-spec'

export interface TechpackGenerationConfig {
  assetTypes: TechpackAssetType[]
}

export interface GeneratedTechpackAsset {
  assetType: TechpackAssetType
  replicateOutputUrl: string
  storageUrl: string
  recordId: string
}

export interface TechpackGenerationResult {
  productId: string
  productName: string
  generatedAssets: GeneratedTechpackAsset[]
  errors: string[]
}
