import { redirect } from 'next/navigation'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { CataloguesTable } from '@/components/catalogues/CataloguesTable'

export const dynamic = 'force-dynamic'

export default async function CataloguesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; org?: string; active?: string; page?: string }>
}) {
  const sp = await searchParams
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
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold">Catalogues is restricted</h1>
        <p className="mt-2 text-sm text-gray-500">
          Ask an admin to grant the <code>catalogues</code> permission on your staff account.
        </p>
      </div>
    )
  }

  const limit = 25
  const page = Math.max(1, Number(sp.page ?? 1))
  const offset = (page - 1) * limit

  let q = admin
    .from('b2b_catalogues')
    .select(
      'id, name, organization_id, discount_pct, is_active, created_at, organizations!inner(name), items:b2b_catalogue_items(count)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (sp.q) q = q.ilike('name', `%${sp.q}%`)
  if (sp.org) q = q.eq('organization_id', sp.org)
  if (sp.active === 'yes') q = q.eq('is_active', true)
  else if (sp.active === 'no') q = q.eq('is_active', false)

  const { data, count } = await q

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Catalogues</h1>
        <p className="text-sm text-gray-500">
          New catalogues are created from the Products list — multi-select rows then click <em>Create B2B catalogue from selected</em>.
        </p>
      </div>
      <CataloguesTable rows={(data ?? []) as never[]} count={count ?? 0} page={page} limit={limit} />
    </div>
  )
}
