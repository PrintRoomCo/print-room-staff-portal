import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params
  let body: { customer_code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const code = body.customer_code?.trim()
  if (!code || !/^[A-Z0-9]{2,6}$/.test(code)) {
    return NextResponse.json(
      { error: 'customer_code must be 2-6 uppercase letters or digits' },
      { status: 400 },
    )
  }

  const { error } = await auth.admin
    .from('organizations')
    .update({ customer_code: code })
    .eq('id', id)
  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ ok: true, customer_code: code })
}
