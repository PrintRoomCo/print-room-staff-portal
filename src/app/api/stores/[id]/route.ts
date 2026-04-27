import { NextResponse } from 'next/server'
import { requireB2BAccountsStaffAccess } from '@/lib/b2b-accounts/server'

const EDITABLE_FIELDS = [
  'name',
  'location',
  'address',
  'city',
  'state',
  'country',
  'postal_code',
  'phone',
  'email',
  'manager_name',
] as const

type StorePatch = Partial<Record<(typeof EDITABLE_FIELDS)[number], string | null>>

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) return auth.error

  const { id } = await params

  let body: StorePatch = {}
  try {
    body = (await request.json()) as StorePatch
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  const { error } = await auth.admin.from('stores').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
