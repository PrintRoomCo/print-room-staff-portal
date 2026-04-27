import { NextRequest, NextResponse } from 'next/server'
import { requireCataloguesStaffAccess } from '@/lib/catalogues/server'
import type { CreateCatalogueBody } from '@/types/catalogues'

export async function POST(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin, context } = auth
  const body = (await request.json()) as CreateCatalogueBody

  if (!body.organization_id || !body.name) {
    return NextResponse.json({ error: 'organization_id and name required' }, { status: 400 })
  }

  const { data: cat, error: cErr } = await admin
    .from('b2b_catalogues')
    .insert({
      organization_id: body.organization_id,
      name: body.name,
      description: body.description ?? null,
      discount_pct: body.discount_pct ?? 0,
      created_by_user_id: context.userId,
    })
    .select('id')
    .single()
  if (cErr || !cat) {
    return NextResponse.json({ error: cErr?.message ?? 'create failed' }, { status: 500 })
  }

  if (body.product_ids?.length) {
    const itemRows = body.product_ids.map((pid, i) => ({
      catalogue_id: cat.id,
      source_product_id: pid,
      sort_order: i,
    }))
    const { data: insertedItems, error: iErr } = await admin
      .from('b2b_catalogue_items')
      .insert(itemRows)
      .select('id, source_product_id')
    if (iErr || !insertedItems) {
      await admin.from('b2b_catalogues').delete().eq('id', cat.id)
      return NextResponse.json({ error: iErr?.message ?? 'item insert failed' }, { status: 500 })
    }

    const { data: masterTiers, error: mErr } = await admin
      .from('product_pricing_tiers')
      .select('product_id, min_quantity, max_quantity, unit_price')
      .eq('is_active', true)
      .in('product_id', body.product_ids)
    if (mErr) {
      await admin.from('b2b_catalogues').delete().eq('id', cat.id)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    if (masterTiers && masterTiers.length > 0) {
      const itemByProduct = new Map(insertedItems.map((it) => [it.source_product_id, it.id]))
      const tierRows = masterTiers
        .map((t) => ({
          catalogue_item_id: itemByProduct.get(t.product_id as string)!,
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity,
          unit_price: t.unit_price,
        }))
        .filter((r) => r.catalogue_item_id)
      if (tierRows.length > 0) {
        const { error: tErr } = await admin
          .from('b2b_catalogue_item_pricing_tiers')
          .insert(tierRows)
        if (tErr) {
          await admin.from('b2b_catalogues').delete().eq('id', cat.id)
          return NextResponse.json({ error: tErr.message }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ id: cat.id }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await requireCataloguesStaffAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const url = new URL(request.url)
  const orgId = url.searchParams.get('organization_id')

  let q = admin
    .from('b2b_catalogues')
    .select('id, organization_id, name, discount_pct, is_active, created_at, items:b2b_catalogue_items(count)')
    .order('created_at', { ascending: false })
  if (orgId) q = q.eq('organization_id', orgId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ catalogues: data ?? [] })
}
