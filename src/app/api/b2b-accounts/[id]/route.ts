import { NextResponse } from 'next/server'
import { requireB2BAccountsStaffAccess } from '@/lib/b2b-accounts/server'

const ALLOWED_PAYMENT_TERMS = ['prepay', 'net20', 'net30'] as const
const ALLOWED_DEPOSIT_PERCENTS = [0, 30, 40, 50, 100] as const

interface PatchBody {
  tier_level?: number
  payment_terms?: string
  default_deposit_percent?: number
  is_trusted?: boolean
  credit_limit?: number | null
  is_active?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) return auth.error

  const { id } = await params

  let body: PatchBody = {}
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (body.tier_level !== undefined) {
    if (![1, 2, 3].includes(body.tier_level)) {
      return NextResponse.json({ error: 'tier_level must be 1, 2, or 3' }, { status: 400 })
    }
    update.tier_level = body.tier_level
  }

  if (body.payment_terms !== undefined) {
    if (!ALLOWED_PAYMENT_TERMS.includes(body.payment_terms as 'prepay' | 'net20' | 'net30')) {
      return NextResponse.json(
        { error: `payment_terms must be one of ${ALLOWED_PAYMENT_TERMS.join(', ')}` },
        { status: 400 },
      )
    }
    update.payment_terms = body.payment_terms
  }

  if (body.default_deposit_percent !== undefined) {
    if (
      !ALLOWED_DEPOSIT_PERCENTS.includes(
        body.default_deposit_percent as 0 | 30 | 40 | 50 | 100,
      )
    ) {
      return NextResponse.json(
        {
          error: `default_deposit_percent must be one of ${ALLOWED_DEPOSIT_PERCENTS.join(', ')}`,
        },
        { status: 400 },
      )
    }
    update.default_deposit_percent = body.default_deposit_percent
  }

  if (body.is_trusted !== undefined) update.is_trusted = body.is_trusted
  if (body.credit_limit !== undefined) update.credit_limit = body.credit_limit
  if (body.is_active !== undefined) update.is_active = body.is_active

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  const { error } = await auth.admin
    .from('b2b_accounts')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
