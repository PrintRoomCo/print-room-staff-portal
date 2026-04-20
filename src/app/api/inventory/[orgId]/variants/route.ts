import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error
  const { orgId } = await params
  const url = new URL(request.url)
  const productId = url.searchParams.get('product_id')
  const { data, error } = await auth.admin.rpc('inventory_variants_for_org', {
    p_org_id: orgId,
    p_product_id: productId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data ?? [] })
}
