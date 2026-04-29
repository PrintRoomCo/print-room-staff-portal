import { NextResponse } from 'next/server'
import { requireB2BAccountsStaffAccess } from '@/lib/b2b-accounts/server'

const ALLOWED_ROLES = ['member'] as const

interface InviteBody {
  email?: string
  first_name?: string
  last_name?: string
  role?: string
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireB2BAccountsStaffAccess()
  if ('error' in auth) return auth.error

  const { id } = await params
  let body: InviteBody
  try {
    body = (await request.json()) as InviteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const firstName = body.first_name?.trim() ?? ''
  const lastName = body.last_name?.trim() ?? ''
  const role = body.role ?? 'member'

  if (!validEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!firstName) {
    return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.includes(role as 'member')) {
    return NextResponse.json({ error: 'Phase A invites use member role only' }, { status: 400 })
  }

  const { data: org } = await auth.admin
    .from('organizations')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: profile } = await auth.admin
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()

  if (profile?.id) {
    const { data: existingMembership } = await auth.admin
      .from('user_organizations')
      .select('user_id')
      .eq('user_id', profile.id)
      .eq('organization_id', id)
      .maybeSingle()

    if (existingMembership) {
      return NextResponse.json({ error: 'This user is already invited to this organization' }, { status: 409 })
    }
  }

  const portalUrl =
    process.env.CUSTOMER_PORTAL_URL ??
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL ??
    'https://portal.theprint-room.co.nz'

  const { data: inviteData, error: inviteError } =
    await auth.admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${portalUrl}/callback?next=/welcome`,
      data: {
        first_name: firstName,
        last_name: lastName,
        invited_org_id: id,
      },
    })

  if (inviteError) {
    const duplicate = inviteError.message.toLowerCase().includes('already')
    return NextResponse.json(
      { error: inviteError.message },
      { status: duplicate ? 409 : 500 },
    )
  }

  const userId = inviteData.user?.id ?? profile?.id
  if (!userId) {
    return NextResponse.json({ error: 'Invite did not return a user id' }, { status: 500 })
  }

  const { error: membershipError } = await auth.admin
    .from('user_organizations')
    .insert({
      user_id: userId,
      organization_id: id,
      role,
    })

  if (membershipError) {
    const duplicate = membershipError.code === '23505'
    return NextResponse.json(
      { error: duplicate ? 'This user is already invited to this organization' : membershipError.message },
      { status: duplicate ? 409 : 500 },
    )
  }

  return NextResponse.json({ user_id: userId, email_sent: true }, { status: 201 })
}
