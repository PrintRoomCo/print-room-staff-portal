import { NextRequest, NextResponse } from 'next/server'
import {
  presentationDbErrorResponse,
  requireAccessiblePresentation,
  requirePresentationStaffAccess,
} from '@/lib/presentations/server'
import {
  mapDbPresentationDetail,
  validatePresentationForReady,
} from '@/lib/presentations/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const presentationAccess = await requireAccessiblePresentation(id, access.context)
  if (presentationAccess.error) return presentationAccess.error

  const { data: sections, error: sectionsError } = await access.admin
    .from('staff_presentation_sections')
    .select('id, kind, title, body, sort_order, is_enabled, payload_json')
    .eq('presentation_id', presentationAccess.presentation.id)
    .order('sort_order', { ascending: true })

  if (sectionsError) {
    return presentationDbErrorResponse(sectionsError, 'Failed to prepare presentation export')
  }

  const detail = mapDbPresentationDetail(presentationAccess.presentation, sections || [])

  if (detail.status !== 'ready') {
    return NextResponse.json(
      { error: 'Only presentations marked ready can be exported.' },
      { status: 409 }
    )
  }

  const validationErrors = validatePresentationForReady(detail, detail.sections)
  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        error: validationErrors[0],
        validationErrors,
      },
      { status: 409 }
    )
  }

  return NextResponse.json({
    exportTitle: buildExportTitle(detail.clientBrand, detail.proposalTitle, detail.seasonLabel),
    slideCount: detail.sections.filter(section => section.isEnabled).length,
  })
}

function buildExportTitle(clientBrand: string, proposalTitle: string, seasonLabel: string) {
  const parts = [clientBrand, proposalTitle, seasonLabel]
    .map(value => value.trim())
    .filter(Boolean)

  const baseName = (parts.length > 0 ? parts.join(' - ') : 'presentation')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return `${baseName || 'presentation'}.pdf`
}
