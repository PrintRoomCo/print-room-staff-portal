import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'
import type { VariantRow } from '@/components/inventory/VariantGrid'

export interface InventoryOrgBundle {
  org_id: string
  org_name: string
  variants: VariantRow[]
}

interface TrackingRow {
  organization_id: string
  organizations: { id: string; name: string } | { id: string; name: string }[] | null
  product_variants: { product_id: string } | { product_id: string }[] | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { id: productId } = await params

  // Phase 1: find orgs that track any variant of this product.
  const { data: trackingRows, error: trackErr } = await auth.admin
    .from('variant_inventory')
    .select(
      `organization_id,
       organizations ( id, name ),
       product_variants!inner ( product_id )`
    )
    .eq('product_variants.product_id', productId)

  if (trackErr) {
    console.error('[ProductInventoryByOrg API] tracking-orgs query failed:', trackErr.message)
    return NextResponse.json({ orgs: [] }, { status: 500 })
  }

  const uniqueOrgs = new Map<string, { org_id: string; org_name: string }>()
  for (const row of (trackingRows ?? []) as TrackingRow[]) {
    const orgRel = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
    if (!orgRel) continue
    if (!uniqueOrgs.has(orgRel.id)) {
      uniqueOrgs.set(orgRel.id, { org_id: orgRel.id, org_name: orgRel.name })
    }
  }

  // Phase 2: for each org, fetch full variant rows via the proven RPC.
  const orgs: InventoryOrgBundle[] = []
  for (const { org_id, org_name } of uniqueOrgs.values()) {
    const { data: variants, error: variantErr } = await auth.admin.rpc(
      'inventory_variants_for_org',
      { p_org_id: org_id, p_product_id: productId }
    )
    if (variantErr) {
      console.error(
        '[ProductInventoryByOrg API] variants RPC failed for org',
        org_id,
        variantErr.message
      )
      continue
    }
    orgs.push({ org_id, org_name, variants: (variants ?? []) as VariantRow[] })
  }

  orgs.sort((a, b) => a.org_name.localeCompare(b.org_name))

  return NextResponse.json({ orgs })
}
