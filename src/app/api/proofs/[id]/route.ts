import { NextRequest, NextResponse } from 'next/server'
import {
  proofDbErrorResponse,
  requireAccessibleProof,
  requireProofsStaffAccess,
} from '@/lib/proofs/server'
import {
  mapDbProofDetail,
  normalizeProofUpdateInput,
  validateProofForExport,
} from '@/lib/proofs/schema'
import type { ProofDetail, ProofDocument, ProofStatus } from '@/types/proofs'

type OrganizationRow = {
  id: string
  name: string
  customer_code: string | null
}

type VersionRow = {
  id: string
  proof_id: string
  version_number: number
  snapshot_data: unknown
  created_at: string
}

type ProofDbRow = {
  id: string
  organization_id: string
  name: string
  customer_email: string
  customer_name: string | null
  status: ProofStatus
  current_version_id: string | null
  created_at: string
  updated_at: string
  archived_at?: string | null
  created_by_user_id?: string | null
}

type ApiErrorResult = { error: NextResponse }
type DetailResult = { proof: ProofDetail; version: VersionRow | null } | ApiErrorResult
type VersionResult = { version: VersionRow | null } | ApiErrorResult
type SaveVersionResult = { version: VersionRow } | ApiErrorResult

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProofsStaffAccess()
  if ('error' in access) return access.error

  const { id } = await params
  const proofAccess = await requireAccessibleProof(id, access.context)
  if ('error' in proofAccess) return proofAccess.error

  const detailResult = await fetchProofDetail(access.admin, proofAccess.proof)
  if ('error' in detailResult) return detailResult.error

  return NextResponse.json({ proof: detailResult.proof })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProofsStaffAccess()
  if ('error' in access) return access.error

  const { id } = await params
  const proofAccess = await requireAccessibleProof(id, access.context)
  if ('error' in proofAccess) return proofAccess.error

  let updates
  try {
    updates = normalizeProofUpdateInput(await request.json().catch(() => ({})))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }

  const currentDetail = await fetchProofDetail(access.admin, proofAccess.proof)
  if ('error' in currentDetail) return currentDetail.error

  const nextDocument = updates.document || currentDetail.proof.document
  const nextStatus = updates.status || currentDetail.proof.status
  const nextProofForValidation = {
    ...currentDetail.proof,
    status: nextStatus,
    document: nextDocument,
  }

  if (nextStatus === 'sent' || nextStatus === 'approved') {
    const validationErrors = validateProofForExport(nextProofForValidation)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0], validationErrors },
        { status: 400 }
      )
    }
  }

  const proofUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.name !== undefined) proofUpdates.name = updates.name
  if (updates.customerEmail !== undefined) proofUpdates.customer_email = updates.customerEmail
  if (updates.customerName !== undefined) proofUpdates.customer_name = updates.customerName
  if (updates.status !== undefined) {
    proofUpdates.status = updates.status
    if (updates.status === 'archived') proofUpdates.archived_at = new Date().toISOString()
  }

  if (updates.document) {
    proofUpdates.name = updates.name ?? updates.document.jobName
    proofUpdates.customer_email = updates.customerEmail ?? updates.document.customerEmail
    proofUpdates.customer_name = updates.customerName ?? updates.document.customerName
  }

  const { data: updatedProof, error: updateError } = await access.admin
    .from('design_proofs')
    .update(proofUpdates)
    .eq('id', id)
    .select('id, organization_id, name, customer_email, customer_name, status, current_version_id, created_at, updated_at, archived_at, created_by_user_id')
    .single()

  if (updateError || !updatedProof) {
    return proofDbErrorResponse(updateError, 'Failed to update proof')
  }

  let savedVersionId = updatedProof.current_version_id
  if (updates.document) {
    const savedVersion = await saveCurrentVersion(
      access.admin,
      updatedProof.id,
      updatedProof.current_version_id,
      updates.document,
      access.context.userId
    )

    if ('error' in savedVersion) return savedVersion.error
    savedVersionId = savedVersion.version.id
  }

  const detailResult = await fetchProofDetail(access.admin, {
    ...updatedProof,
    current_version_id: savedVersionId,
  })
  if ('error' in detailResult) return detailResult.error

  return NextResponse.json({ proof: detailResult.proof })
}

async function fetchProofDetail(
  admin: ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>,
  proof: ProofDbRow
): Promise<DetailResult> {
  const [{ data: organization, error: organizationError }, versionResult] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, customer_code')
      .eq('id', proof.organization_id)
      .maybeSingle(),
    fetchCurrentVersion(admin, proof.id, proof.current_version_id),
  ])

  if (organizationError) {
    return {
      error: proofDbErrorResponse(organizationError, 'Failed to fetch proof organization'),
    }
  }

  if ('error' in versionResult) return versionResult

  return {
    proof: mapDbProofDetail(
      proof,
      (organization as OrganizationRow | null) || null,
      versionResult.version
    ),
    version: versionResult.version,
  }
}

async function fetchCurrentVersion(
  admin: ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>,
  proofId: string,
  currentVersionId: string | null
): Promise<VersionResult> {
  if (currentVersionId) {
    const { data, error } = await admin
      .from('design_proof_versions')
      .select('id, proof_id, version_number, snapshot_data, created_at')
      .eq('id', currentVersionId)
      .maybeSingle()

    if (error) {
      return { error: proofDbErrorResponse(error, 'Failed to fetch current proof version') }
    }

    if (data) return { version: data as VersionRow }
  }

  const { data, error } = await admin
    .from('design_proof_versions')
    .select('id, proof_id, version_number, snapshot_data, created_at')
    .eq('proof_id', proofId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: proofDbErrorResponse(error, 'Failed to fetch latest proof version') }
  }

  return { version: (data as VersionRow | null) || null }
}

async function saveCurrentVersion(
  admin: ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>,
  proofId: string,
  currentVersionId: string | null,
  document: ProofDocument,
  userId: string
): Promise<SaveVersionResult> {
  if (currentVersionId) {
    const { data, error } = await admin
      .from('design_proof_versions')
      .update({
        snapshot_data: document,
      })
      .eq('id', currentVersionId)
      .select('id, proof_id, version_number, snapshot_data, created_at')
      .single()

    if (error || !data) {
      return { error: proofDbErrorResponse(error, 'Failed to save proof version') }
    }

    return { version: data as VersionRow }
  }

  const { data: latest, error: latestError } = await admin
    .from('design_proof_versions')
    .select('version_number')
    .eq('proof_id', proofId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    return { error: proofDbErrorResponse(latestError, 'Failed to prepare proof version') }
  }

  const { data, error } = await admin
    .from('design_proof_versions')
    .insert({
      proof_id: proofId,
      version_number: (latest?.version_number || 0) + 1,
      status: 'draft',
      snapshot_data: document,
      change_order_fee_amount: 0,
      created_by_user_id: userId,
    })
    .select('id, proof_id, version_number, snapshot_data, created_at')
    .single()

  if (error || !data) {
    return { error: proofDbErrorResponse(error, 'Failed to create proof version') }
  }

  const { error: proofUpdateError } = await admin
    .from('design_proofs')
    .update({ current_version_id: data.id, updated_at: new Date().toISOString() })
    .eq('id', proofId)

  if (proofUpdateError) {
    return { error: proofDbErrorResponse(proofUpdateError, 'Failed to attach proof version') }
  }

  return { version: data as VersionRow }
}
