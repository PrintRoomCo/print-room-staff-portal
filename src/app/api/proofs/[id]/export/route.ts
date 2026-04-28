import { NextRequest, NextResponse } from 'next/server'
import {
  proofDbErrorResponse,
  requireAccessibleProof,
  requireProofsStaffAccess,
} from '@/lib/proofs/server'
import {
  buildProofExportTitle,
  mapDbProofDetail,
  validateProofForExport,
} from '@/lib/proofs/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProofsStaffAccess()
  if ('error' in access) return access.error

  const { id } = await params
  const proofAccess = await requireAccessibleProof(id, access.context)
  if ('error' in proofAccess) return proofAccess.error

  if (!proofAccess.proof.current_version_id) {
    return NextResponse.json(
      { error: 'Save the proof before exporting.' },
      { status: 409 }
    )
  }

  const [{ data: organization, error: organizationError }, { data: version, error: versionError }] = await Promise.all([
    access.admin
      .from('organizations')
      .select('id, name, customer_code')
      .eq('id', proofAccess.proof.organization_id)
      .maybeSingle(),
    access.admin
      .from('design_proof_versions')
      .select('id, proof_id, version_number, snapshot_data, created_at')
      .eq('id', proofAccess.proof.current_version_id)
      .maybeSingle(),
  ])

  if (organizationError) {
    return proofDbErrorResponse(organizationError, 'Failed to fetch proof organization')
  }

  if (versionError) {
    return proofDbErrorResponse(versionError, 'Failed to prepare proof export')
  }

  if (!version) {
    return NextResponse.json(
      { error: 'Save the proof before exporting.' },
      { status: 409 }
    )
  }

  const detail = mapDbProofDetail(proofAccess.proof, organization, version)
  const validationErrors = validateProofForExport(detail)

  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: validationErrors[0], validationErrors },
      { status: 409 }
    )
  }

  return NextResponse.json({
    exportTitle: buildProofExportTitle(detail),
    pageCount: 1 + detail.document.designs.length * 2,
  })
}
