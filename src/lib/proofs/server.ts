import { NextResponse } from 'next/server'
import { requireCataloguesStaffAccess, type CataloguesStaffContext } from '@/lib/catalogues/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export type ProofsStaffContext = CataloguesStaffContext

export async function requireProofsStaffAccess() {
  return requireCataloguesStaffAccess()
}

export async function requireAccessibleProof(
  proofId: string,
  context: ProofsStaffContext
) {
  const admin = getSupabaseAdmin()
  let query = admin
    .from('design_proofs')
    .select('id, organization_id, name, customer_email, customer_name, status, current_version_id, created_at, updated_at, archived_at, created_by_user_id')
    .eq('id', proofId)

  if (!context.isAdmin) {
    query = query.eq('created_by_user_id', context.userId)
  }

  const { data: proof, error } = await query.maybeSingle()

  if (isMissingTableError(error)) {
    return {
      error: proofDbErrorResponse(error, 'Design proofs are not set up in Supabase yet.'),
    }
  }

  if (error || !proof || proof.archived_at) {
    return {
      error: NextResponse.json({ error: 'Proof not found' }, { status: 404 }),
    }
  }

  return { proof }
}

export function proofDbErrorResponse(error: { code?: string; message?: string } | null, fallbackMessage: string) {
  if (isMissingTableError(error)) {
    return NextResponse.json(
      {
        error: 'Design proofs are not set up in Supabase yet. Run the design_proofs migration and refresh.',
      },
      { status: 503 }
    )
  }

  return NextResponse.json(
    { error: error?.message || fallbackMessage },
    { status: 500 }
  )
}

export function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
