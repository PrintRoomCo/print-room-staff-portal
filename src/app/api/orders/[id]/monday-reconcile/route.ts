import { NextResponse } from 'next/server'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { retryMondayPush } from '@/lib/orders/submit'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) return auth.error
  const { id } = await params
  const result = await retryMondayPush(id)
  return NextResponse.json(result)
}
