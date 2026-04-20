import { redirect } from 'next/navigation'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import { TrackedProductsTable } from '@/components/inventory/TrackedProductsTable'
import { TrackProductPicker } from '@/components/inventory/TrackProductPicker'

export const dynamic = 'force-dynamic'

interface ProductSummaryRow {
  id: string
  name: string
  image_url: string | null
  variant_count: number | string
  total_stock: number | string
  total_committed: number | string
}

export default async function OrgInventoryPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) {
    redirect('/dashboard')
  }

  const { data: org } = await auth.admin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single()

  if (!org) {
    redirect('/inventory')
  }

  const { data } = await auth.admin.rpc('inventory_products_summary', {
    p_org_id: orgId,
  })

  const rows = (data ?? []) as ProductSummaryRow[]
  const products = rows.map((r) => ({
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    variantCount: Number(r.variant_count),
    totalStock: Number(r.total_stock),
    totalCommitted: Number(r.total_committed),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Inventory</div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
        </div>
        <TrackProductPicker orgId={orgId} />
      </div>

      <TrackedProductsTable orgId={orgId} products={products} />
    </div>
  )
}
