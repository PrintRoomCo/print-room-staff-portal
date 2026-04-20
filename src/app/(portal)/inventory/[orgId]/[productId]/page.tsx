import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { VariantGrid } from '@/components/inventory/VariantGrid'

export const dynamic = 'force-dynamic'

export default async function VariantGridPage({
  params,
}: {
  params: Promise<{ orgId: string; productId: string }>
}) {
  const { orgId, productId } = await params
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) redirect('/dashboard')

  const [{ data: product }, { data: org }, { data: variants }] = await Promise.all([
    auth.admin.from('products').select('id, name').eq('id', productId).single(),
    auth.admin.from('organizations').select('id, name').eq('id', orgId).single(),
    auth.admin.rpc('inventory_variants_for_org', {
      p_org_id: orgId,
      p_product_id: productId,
    }),
  ])

  if (!product || !org) redirect('/inventory')

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-500">
          <a href="/inventory" className="hover:underline">
            Inventory
          </a>{' '}
          ›{' '}
          <a href={`/inventory/${orgId}`} className="hover:underline">
            {org.name}
          </a>
        </div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
      </div>
      <VariantGrid orgId={orgId} productId={productId} variants={variants ?? []} />
    </div>
  )
}
