import { NextResponse } from 'next/server'
import { approveQuote } from '@/lib/quotes/approve'
import { requireQuotesStaffAccess } from '@/lib/quotes/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireQuotesStaffAccess({ needApproval: true })
  if ('error' in auth) return auth.error

  const { id } = await params
  const result = await approveQuote(auth.admin, id, auth.context.staffId)

  if (!result.quote) {
    return NextResponse.json({ error: result.error ?? 'Quote not found' }, { status: 404 })
  }

  if (result.error === 'VALIDATION') {
    return NextResponse.json(
      { error: 'Not ready to approve', issues: result.issues ?? [] },
      { status: 400 }
    )
  }

  return NextResponse.json({
    quote: result.quote,
    push_status: result.pushStatus,
    already_approved: result.alreadyApproved ?? false,
    error: result.error ?? null,
  })
}
