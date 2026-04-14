export type ViewType = 'front' | 'back' | 'left' | 'right' | 'label' | 'neck'

export interface ViewGenerationRequest {
  productId: string
  viewsToGenerate: ViewType[]
  applyPrintAreaTemplate: boolean
}

export interface GeneratedView {
  view: ViewType
  replicateOutputUrl: string
  storageUrl: string
  productImageId: string
}

export interface ViewGenerationResult {
  productId: string
  productName: string
  generatedViews: GeneratedView[]
  errors: string[]
}

export interface GenerateViewOptions {
  colorDescription?: string
  brand?: string
  productDescription?: string
  enableBackgroundRemoval?: boolean
}

export interface ViewPromptTemplate {
  view: ViewType
  promptSuffix: string
  negativePrompt?: string
}

export interface CategoryPromptTemplates {
  basePrompt: string
  views: ViewPromptTemplate[]
}
