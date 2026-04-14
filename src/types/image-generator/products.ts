import type { ViewType } from './views'

export interface ProductBrand {
  id: string
  name: string
}

export interface ProductWithViews {
  id: string
  name: string
  description: string | null
  category: string
  brand: ProductBrand | null
  frontImageUrl: string | null
  hasFrontImage: boolean
  existingViews: ViewType[]
  missingViews: ViewType[]
}
