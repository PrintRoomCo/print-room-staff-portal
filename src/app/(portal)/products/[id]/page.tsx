import { notFound, redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { withUniformsScope } from '@/lib/products/scope'
import { rowsToChannelsMap } from '@/lib/products/channels'
import { ProductEditor } from '@/components/products/ProductEditor'
import type { BrandRef, CategoryRef, ProductDetail } from '@/types/products'

const DETAIL_SELECT = '*, channels:product_type_activations(product_type,is_active)'

export const dynamic = 'force-dynamic'

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
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
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Products is restricted</h1>
        <p className="text-sm text-gray-500 mt-2">
          Ask an admin to grant the <code>products</code> permission on your staff account.
        </p>
      </div>
    )
  }

  const { id } = await params
  const [productRes, brandsRes, categoriesRes] = await Promise.all([
    withUniformsScope(admin.from('products').select(DETAIL_SELECT).eq('id', id)).single(),
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
  ])

  if (productRes.error || !productRes.data) notFound()

  const { channels, ...rest } = productRes.data as Record<string, unknown>
  const product = { ...rest, channels: rowsToChannelsMap(channels) } as ProductDetail

  return (
    <ProductEditor
      product={product}
      brands={(brandsRes.data || []) as BrandRef[]}
      categories={(categoriesRes.data || []) as CategoryRef[]}
    />
  )
}
