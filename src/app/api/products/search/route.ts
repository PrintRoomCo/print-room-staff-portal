import { NextResponse } from 'next/server'
import { requireInventoryStaffAccess } from '@/lib/inventory/server'

export async function GET(request: Request) {
  const auth = await requireInventoryStaffAccess()
  if ('error' in auth) return auth.error

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  const { data, error } = await auth.admin
    .from('products')
    .select('id, name, image_url')
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}
