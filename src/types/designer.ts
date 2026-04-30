// DTOs for the designer sub-app — shared between Add Product modal,
// auto-swatch endpoint, and (later) the submissions endpoint.

export interface AutoSwatchRequest {
  image_url: string
}

export interface AutoSwatch {
  label: string
  hex: string
}

export interface AutoSwatchResponse {
  swatches: AutoSwatch[]
}

export interface CatalogProduct {
  id: string
  name: string
  brand_name: string | null
  category_name: string | null
  primary_image_url: string | null
}
