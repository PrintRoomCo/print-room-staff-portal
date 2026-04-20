import { redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { ProductCreateForm } from '@/components/products/ProductCreateForm'
import type { BrandRef, CategoryRef } from '@/types/products'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
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
    redirect('/dashboard')
  }

  const [brandsRes, categoriesRes] = await Promise.all([
    admin.from('brands').select('id, name').order('name'),
    admin.from('categories').select('id, name').order('name'),
  ])

  return (
    <ProductCreateForm
      brands={(brandsRes.data || []) as BrandRef[]}
      categories={(categoriesRes.data || []) as CategoryRef[]}
    />
  )
}
