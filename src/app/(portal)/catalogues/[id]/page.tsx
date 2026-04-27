import { notFound, redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { CatalogueEditor } from '@/components/catalogues/CatalogueEditor'

export const dynamic = 'force-dynamic'

export default async function CatalogueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  if (!isAdmin && !perms.includes('catalogues') && !perms.includes('catalogues:write')) {
    notFound()
  }

  const { data: cat } = await admin
    .from('b2b_catalogues')
    .select('*')
    .eq('id', id)
    .single()
  if (!cat) notFound()

  const [{ data: items }, { data: org }] = await Promise.all([
    admin
      .from('b2b_catalogue_items')
      .select(
        '*, source:products(id, name, sku, base_cost, markup_multiplier, image_url, decoration_price, is_b2b_only)',
      )
      .eq('catalogue_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    admin
      .from('organizations')
      .select('id, name')
      .eq('id', cat.organization_id)
      .single(),
  ])

  return (
    <CatalogueEditor
      catalogue={cat}
      items={(items ?? []) as never[]}
      organization={org ?? null}
    />
  )
}
