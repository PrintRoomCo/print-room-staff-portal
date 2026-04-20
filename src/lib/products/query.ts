import type { SupabaseClient } from '@supabase/supabase-js'
import { withUniformsScope } from './scope'
import { PRODUCT_TYPE_TAGS, type ProductTypeTag } from './tags'
import { GARMENT_FAMILIES, type GarmentFamily } from './garment-families'
import type {
  ActiveFilter,
  ProductListFilters,
  ShopifyLiveFilter,
} from '@/types/products'

export const PRODUCTS_PER_PAGE = 25

const SUMMARY_SELECT =
  'id, name, sku, supplier_code, base_cost, is_active, image_url, garment_family, tags, shopify_product_id, brand:brands!products_brand_id_fkey(id,name), category:categories!products_category_id_fkey(id,name)'

export function defaultListFilters(): ProductListFilters {
  return {
    search: '',
    brand_id: null,
    category_id: null,
    garment_family: null,
    type_tags: [],
    shopify: 'all',
    active: 'all',
    page: 1,
  }
}

export function parseListSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProductListFilters {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined
    const v = params[key]
    if (Array.isArray(v)) return v[0]
    return v
  }
  const getAll = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key)
    const v = params[key]
    if (Array.isArray(v)) return v
    if (typeof v === 'string') return [v]
    return []
  }

  const garmentFamilyRaw = get('garment_family')
  const garmentFamily =
    garmentFamilyRaw && (GARMENT_FAMILIES as readonly string[]).includes(garmentFamilyRaw)
      ? (garmentFamilyRaw as GarmentFamily)
      : null

  const typeTagsRaw = getAll('tag')
  const validTagSet: ReadonlySet<string> = new Set(PRODUCT_TYPE_TAGS)
  const typeTags = typeTagsRaw.filter((t): t is ProductTypeTag => validTagSet.has(t))

  const shopifyRaw = get('shopify')
  const shopify: ShopifyLiveFilter =
    shopifyRaw === 'live' || shopifyRaw === 'not-live' ? shopifyRaw : 'all'

  const activeRaw = get('active')
  const active: ActiveFilter =
    activeRaw === 'active' || activeRaw === 'inactive' ? activeRaw : 'all'

  const pageRaw = parseInt(get('page') || '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  return {
    search: (get('search') || '').trim(),
    brand_id: get('brand_id') || null,
    category_id: get('category_id') || null,
    garment_family: garmentFamily,
    type_tags: typeTags,
    shopify,
    active,
    page,
  }
}

export function listFiltersToSearchParams(filters: ProductListFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (filters.search) sp.set('search', filters.search)
  if (filters.brand_id) sp.set('brand_id', filters.brand_id)
  if (filters.category_id) sp.set('category_id', filters.category_id)
  if (filters.garment_family) sp.set('garment_family', filters.garment_family)
  for (const tag of filters.type_tags) sp.append('tag', tag)
  if (filters.shopify !== 'all') sp.set('shopify', filters.shopify)
  if (filters.active !== 'all') sp.set('active', filters.active)
  if (filters.page > 1) sp.set('page', String(filters.page))
  return sp
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildListQuery(client: SupabaseClient<any, any, any>, filters: ProductListFilters) {
  let query = withUniformsScope(
    client.from('products').select(SUMMARY_SELECT, { count: 'exact' }).order('name')
  )

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.garment_family) query = query.eq('garment_family', filters.garment_family)
  if (filters.type_tags.length > 0) query = query.contains('tags', filters.type_tags)

  if (filters.shopify === 'live') query = query.not('shopify_product_id', 'is', null)
  else if (filters.shopify === 'not-live') query = query.is('shopify_product_id', null)

  if (filters.active === 'active') query = query.eq('is_active', true)
  else if (filters.active === 'inactive') query = query.eq('is_active', false)

  return query
}
