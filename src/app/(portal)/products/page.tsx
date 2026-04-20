import { redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import {
  PRODUCTS_PER_PAGE,
  buildListQuery,
  parseListSearchParams,
} from '@/lib/products/query'
import { ProductList } from '@/components/products/ProductList'
import type { BrandRef, CategoryRef, ProductListResponse } from '@/types/products'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = getSupabaseAdmin()

  const { data: staff } = await admin
    .from('staff_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'
  const perms = Array.isArray(staff?.permissions) ? staff!.permissions : []
  if (!isAdmin && !perms.includes('products') && !perms.includes('products:write')) {
    redirect('/dashboard')
  }

  const sp = await searchParams
  const filters = parseListSearchParams(sp)
  const offset = (filters.page - 1) * PRODUCTS_PER_PAGE

  const [productsResult, brandsResult, categoriesResult] = await Promise.all([
    buildListQuery(admin, filters).range(offset, offset + PRODUCTS_PER_PAGE - 1),
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
  ])

  const initial: ProductListResponse = {
    products: (productsResult.data || []) as unknown as ProductListResponse['products'],
    total: productsResult.count || 0,
    page: filters.page,
    perPage: PRODUCTS_PER_PAGE,
  }

  const brands: BrandRef[] = (brandsResult.data || []) as BrandRef[]
  const categories: CategoryRef[] = (categoriesResult.data || []) as CategoryRef[]

  return <ProductList initial={initial} brands={brands} categories={categories} />
}
