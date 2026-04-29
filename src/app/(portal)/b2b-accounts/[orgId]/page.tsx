import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireB2BAccountsStaffAccess } from '@/lib/b2b-accounts/server'
import { AccountTermsCard, type AccountTerms } from '@/components/b2b-accounts/AccountTermsCard'
import { StoresPanel, type Store } from '@/components/b2b-accounts/StoresPanel'
import { CataloguesPanel, type CatalogueRow } from '@/components/b2b-accounts/CataloguesPanel'
import { InviteCustomerDialog } from '@/components/b2b-accounts/InviteCustomerDialog'

export const dynamic = 'force-dynamic'

interface OrgRow {
  id: string
  name: string
  customer_code: string | null
  domain: string | null
  settings: Record<string, unknown> | null
  created_at: string | null
}

interface VisibleProduct {
  id: string
  name: string
  sku: string | null
  image_url: string | null
}

export default async function B2BAccountPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) {
    redirect('/login?next=/b2b-accounts/' + orgId)
  }
  const { admin } = auth

  const [orgResult, accountResult, storesResult, cataloguesResult] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, customer_code, domain, settings, created_at')
      .eq('id', orgId)
      .maybeSingle(),
    admin
      .from('b2b_accounts')
      .select(
        'id, organization_id, tier_level, payment_terms, credit_limit, default_deposit_percent, is_trusted, platform, is_active, created_at',
      )
      .eq('organization_id', orgId)
      .maybeSingle(),
    admin
      .from('stores')
      .select(
        'id, name, location, address, city, state, country, postal_code, phone, email, manager_name',
      )
      .eq('organization_id', orgId)
      .order('name', { ascending: true }),
    admin
      .from('b2b_catalogues')
      .select('id, name, is_active, created_at, b2b_catalogue_items!left(id)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
  ])

  const org = orgResult.data as OrgRow | null
  if (!org) return notFound()

  const account = (accountResult.data ?? null) as AccountTerms | null
  const stores = (storesResult.data ?? []) as Store[]

  type RawCatalogue = {
    id: string
    name: string
    is_active: boolean
    created_at: string | null
    b2b_catalogue_items: { id: string }[] | null
  }
  const rawCatalogues = (cataloguesResult.data ?? []) as RawCatalogue[]
  const catalogues: CatalogueRow[] = rawCatalogues.map((c) => ({
    id: c.id,
    name: c.name,
    is_active: c.is_active,
    created_at: c.created_at,
    item_count: c.b2b_catalogue_items?.length ?? 0,
  }))

  const activeCatalogues = catalogues.filter((c) => c.is_active)
  const hasCatalogueScope = activeCatalogues.length > 0

  let visibleProducts: VisibleProduct[] = []
  let visibleScope: 'catalogue' | 'global' = 'global'

  if (hasCatalogueScope) {
    const activeIds = activeCatalogues.map((c) => c.id)
    const { data: items } = await admin
      .from('b2b_catalogue_items')
      .select('source_product_id, products!inner(id, name, sku, image_url)')
      .in('catalogue_id', activeIds)
      .eq('is_active', true)

    type ItemRow = {
      source_product_id: string
      products:
        | { id: string; name: string; sku: string | null; image_url: string | null }
        | { id: string; name: string; sku: string | null; image_url: string | null }[]
        | null
    }
    const seen = new Set<string>()
    for (const r of (items ?? []) as ItemRow[]) {
      const p = Array.isArray(r.products) ? r.products[0] : r.products
      if (!p) continue
      if (seen.has(p.id)) continue
      seen.add(p.id)
      visibleProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
      })
    }
    visibleProducts.sort((a, b) => a.name.localeCompare(b.name))
    visibleScope = 'catalogue'
  } else {
    const { data: globalProducts } = await admin
      .from('products')
      .select(
        'id, name, sku, image_url, _channel:product_type_activations!inner(product_type, is_active)',
      )
      .eq('is_active', true)
      .eq('_channel.product_type', 'b2b')
      .eq('_channel.is_active', true)
      .order('name')

    visibleProducts = ((globalProducts ?? []) as Array<{
      id: string
      name: string
      sku: string | null
      image_url: string | null
    }>).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
    }))
    visibleScope = 'global'
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{org.name}</h1>
            {org.customer_code && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                {org.customer_code}
              </span>
            )}
          </div>
          {org.domain && (
            <p className="mt-1 text-sm text-gray-500">{org.domain}</p>
          )}
        </div>
        <InviteCustomerDialog organizationId={org.id} organizationName={org.name} />
      </header>

      <div className="grid grid-cols-1 gap-4">
        <AccountTermsCard organizationId={orgId} account={account} />
        <StoresPanel organizationId={orgId} stores={stores} />
        <CataloguesPanel organizationId={orgId} catalogues={catalogues} />

        <section className="rounded border border-gray-200 p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              What this org sees ({visibleProducts.length})
            </h2>
            <span
              className={
                visibleScope === 'catalogue'
                  ? 'rounded bg-green-50 px-2 py-0.5 text-xs text-green-700'
                  : 'rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'
              }
            >
              {visibleScope === 'catalogue'
                ? 'Catalogue scope'
                : 'Global B2B fallback'}
            </span>
          </header>

          {visibleProducts.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              No products visible to this org.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {visibleProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-gray-100" />
                  )}
                  <div className="flex-1">
                    <Link
                      className="text-sm text-blue-600 underline"
                      href={`/products/${p.id}`}
                    >
                      {p.name}
                    </Link>
                    {p.sku && (
                      <div className="text-xs text-gray-500">{p.sku}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
