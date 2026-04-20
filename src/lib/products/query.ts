import type { SupabaseClient } from '@supabase/supabase-js'
import { withUniformsScope } from './scope'
import { GARMENT_FAMILIES, type GarmentFamily } from './garment-families'
import type {
  ActiveFilter,
  ProductListFilters,
  ShopifyLiveFilter,
} from '@/types/products'
import { CHANNELS, type Channel } from '@/types/products'

export const PRODUCTS_PER_PAGE = 25

const SUMMARY_SELECT =
  'id, name, sku, supplier_code, base_cost, is_active, image_url, garment_family, tags, shopify_product_id, brand:brands!products_brand_id_fkey(id,name), category:categories!products_category_id_fkey(id,name), channels:product_type_activations(product_type,is_active)'

export function defaultListFilters(): ProductListFilters {
  return {
    search: '',
    brand_id: null,
    category_id: null,
    garment_family: null,
    channel: null,
    tags_filter: [],
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

  const channelRaw = get('channel')
  const channelSet: ReadonlySet<string> = new Set(CHANNELS)
  const channel: Channel | null =
    channelRaw && channelSet.has(channelRaw) ? (channelRaw as Channel) : null

  const tagsFilterRaw = getAll('tag')
  const tagsFilter = tagsFilterRaw
    .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter(t => t.length > 0)

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
    channel,
    tags_filter: tagsFilter,
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
  if (filters.channel) sp.set('channel', filters.channel)
  for (const tag of filters.tags_filter) sp.append('tag', tag)
  if (filters.shopify !== 'all') sp.set('shopify', filters.shopify)
  if (filters.active !== 'all') sp.set('active', filters.active)
  if (filters.page > 1) sp.set('page', String(filters.page))
  return sp
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildListQuery(client: SupabaseClient<any, any, any>, filters: ProductListFilters) {
  // When a channel filter is active, we add a second alias on the same
  // relation using !inner so the parent product rows are restricted to
  // those with a matching channel. The primary `channels` alias in
  // SUMMARY_SELECT continues to hydrate ALL channel rows for each
  // returned product, so the ChannelsCell can show the full picture.
  const selectClause = filters.channel
    ? `${SUMMARY_SELECT}, _channel_filter:product_type_activations!inner(product_type)`
    : SUMMARY_SELECT

  let query = withUniformsScope(
    client.from('products').select(selectClause, { count: 'exact' }).order('name')
  )

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.brand_id) query = query.eq('brand_id', filters.brand_id)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.garment_family) query = query.eq('garment_family', filters.garment_family)

  if (filters.channel) {
    query = query.eq('_channel_filter.product_type', filters.channel)
  }

  if (filters.tags_filter.length > 0) {
    query = query.contains('tags', filters.tags_filter)
  }

  if (filters.shopify === 'live') query = query.not('shopify_product_id', 'is', null)
  else if (filters.shopify === 'not-live') query = query.is('shopify_product_id', null)

  if (filters.active === 'active') query = query.eq('is_active', true)
  else if (filters.active === 'inactive') query = query.eq('is_active', false)

  return query
}
