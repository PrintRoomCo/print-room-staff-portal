import { NextRequest, NextResponse } from 'next/server'
import { proofDbErrorResponse, requireProofsStaffAccess } from '@/lib/proofs/server'
import {
  createDefaultProofDocument,
  mapDbProofDetail,
  mapDbProofSummary,
  normalizeProofCreateInput,
  validateProofCreateInput,
} from '@/lib/proofs/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function GET() {
  const access = await requireProofsStaffAccess()
  if ('error' in access) return access.error

  const { admin, context } = access
  let query = admin
    .from('design_proofs')
    .select('id, organization_id, name, customer_email, customer_name, status, current_version_id, created_at, updated_at, archived_at, created_by_user_id')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (!context.isAdmin) {
    query = query.eq('created_by_user_id', context.userId)
  }

  const { data: proofs, error } = await query
  if (error) return proofDbErrorResponse(error, 'Failed to fetch proofs')

  const proofRows = proofs || []
  const organizationIds = Array.from(new Set(proofRows.map(proof => proof.organization_id).filter(Boolean)))
  const versionIds = proofRows
    .map(proof => proof.current_version_id)
    .filter((id): id is string => Boolean(id))

  let organizationsById = new Map<string, OrganizationRow>()
  if (organizationIds.length > 0) {
    const { data: organizations, error: organizationError } = await admin
      .from('organizations')
      .select('id, name, customer_code')
      .in('id', organizationIds)

    if (organizationError) {
      return proofDbErrorResponse(organizationError, 'Failed to fetch proof organizations')
    }

    organizationsById = (organizations || []).reduce((acc, organization) => {
      acc.set(organization.id, organization as OrganizationRow)
      return acc
    }, new Map<string, OrganizationRow>())
  }

  let versionsById = new Map<string, VersionRow>()
  if (versionIds.length > 0) {
    const { data: versions, error: versionError } = await admin
      .from('design_proof_versions')
      .select('id, proof_id, version_number, snapshot_data, created_at')
      .in('id', versionIds)

    if (versionError) {
      return proofDbErrorResponse(versionError, 'Failed to fetch proof versions')
    }

    versionsById = (versions || []).reduce((acc, version) => {
      acc.set(version.id, version as VersionRow)
      return acc
    }, new Map<string, VersionRow>())
  }

  return NextResponse.json({
    proofs: proofRows.map(proof =>
      mapDbProofSummary(
        proof,
        organizationsById.get(proof.organization_id) || null,
        proof.current_version_id ? versionsById.get(proof.current_version_id) || null : null
      )
    ),
  })
}

export async function POST(request: NextRequest) {
  const access = await requireProofsStaffAccess()
  if ('error' in access) return access.error

  const { admin, context } = access
  const payload = normalizeProofCreateInput(await request.json().catch(() => ({})))
  const missingFields = validateProofCreateInput(payload)

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missingFields.join(', ')}` },
      { status: 400 }
    )
  }

  if (!UUID_RE.test(payload.organizationId)) {
    return NextResponse.json(
      { error: 'Select an organization from the list before creating a proof.' },
      { status: 400 }
    )
  }

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id, name, customer_code')
    .eq('id', payload.organizationId)
    .maybeSingle()

  if (organizationError) {
    return proofDbErrorResponse(organizationError, 'Failed to fetch organization')
  }

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const customerName = payload.customerName || organization.name
  const document = createDefaultProofDocument({
    ...payload,
    customerName,
    organizationName: organization.name,
    preparedByName: context.displayName,
  })

  const { data: proof, error: createError } = await admin
    .from('design_proofs')
    .insert({
      organization_id: payload.organizationId,
      name: payload.jobName,
      customer_email: payload.customerEmail,
      customer_name: customerName,
      status: 'draft',
      created_by_user_id: context.userId,
    })
    .select('id, organization_id, name, customer_email, customer_name, status, current_version_id, created_at, updated_at')
    .single()

  if (createError || !proof) {
    return proofDbErrorResponse(createError, 'Failed to create proof')
  }

  const { data: version, error: versionError } = await admin
    .from('design_proof_versions')
    .insert({
      proof_id: proof.id,
      version_number: 1,
      status: 'draft',
      snapshot_data: document,
      change_order_fee_amount: 0,
      created_by_user_id: context.userId,
    })
    .select('id, proof_id, version_number, snapshot_data, created_at')
    .single()

  if (versionError || !version) {
    await admin.from('design_proofs').delete().eq('id', proof.id)
    return proofDbErrorResponse(versionError, 'Failed to create proof version')
  }

  const { data: updatedProof, error: updateError } = await admin
    .from('design_proofs')
    .update({ current_version_id: version.id })
    .eq('id', proof.id)
    .select('id, organization_id, name, customer_email, customer_name, status, current_version_id, created_at, updated_at')
    .single()

  if (updateError || !updatedProof) {
    await admin.from('design_proof_versions').delete().eq('id', version.id)
    await admin.from('design_proofs').delete().eq('id', proof.id)
    return proofDbErrorResponse(updateError, 'Failed to finish proof setup')
  }

  return NextResponse.json(
    {
      proof: mapDbProofDetail(updatedProof, organization as OrganizationRow, version as VersionRow),
    },
    { status: 201 }
  )
}
