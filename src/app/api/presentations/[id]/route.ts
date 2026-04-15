import { NextRequest, NextResponse } from 'next/server'
import { presentationDbErrorResponse, requireAccessiblePresentation, requirePresentationStaffAccess } from '@/lib/presentations/server'
import {
  mapDbPresentationDetail,
  normalizePresentationUpdateInput,
  validatePresentationForReady,
} from '@/lib/presentations/schema'
import type { PresentationUpdateInput } from '@/types/presentations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const presentationAccess = await requireAccessiblePresentation(id, access.context)
  if (presentationAccess.error) return presentationAccess.error

  const { presentation } = presentationAccess
  const { data: sections, error: sectionsError } = await access.admin
    .from('staff_presentation_sections')
    .select('id, kind, title, body, sort_order, is_enabled, payload_json')
    .eq('presentation_id', presentation.id)
    .order('sort_order', { ascending: true })

  if (sectionsError) {
    return presentationDbErrorResponse(sectionsError, 'Failed to fetch presentation sections')
  }

  return NextResponse.json({
    presentation: mapDbPresentationDetail(presentation, sections || []),
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const presentationAccess = await requireAccessiblePresentation(id, access.context)
  if (presentationAccess.error) return presentationAccess.error

  let updates: PresentationUpdateInput
  try {
    updates = normalizePresentationUpdateInput(await request.json().catch(() => ({})))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }

  if (updates.status === 'ready') {
    const { data: sections, error: sectionsError } = await access.admin
      .from('staff_presentation_sections')
      .select('id, kind, title, body, sort_order, is_enabled, payload_json')
      .eq('presentation_id', id)
      .order('sort_order', { ascending: true })

    if (sectionsError) {
      return presentationDbErrorResponse(sectionsError, 'Failed to validate presentation')
    }

    const nextDetail = mapDbPresentationDetail(
      {
        ...presentationAccess.presentation,
        client_name: updates.clientName ?? presentationAccess.presentation.client_name,
        client_brand: updates.clientBrand ?? presentationAccess.presentation.client_brand,
        proposal_title: updates.proposalTitle ?? presentationAccess.presentation.proposal_title,
        season_label: updates.seasonLabel ?? presentationAccess.presentation.season_label,
        cover_date_label: updates.coverDateLabel ?? presentationAccess.presentation.cover_date_label,
      },
      sections || []
    )

    const validationErrors = validatePresentationForReady(nextDetail, nextDetail.sections)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0], validationErrors },
        { status: 400 }
      )
    }
  }

  const dbUpdates: Record<string, string> = {}
  if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName
  if (updates.clientBrand !== undefined) dbUpdates.client_brand = updates.clientBrand
  if (updates.proposalTitle !== undefined) dbUpdates.proposal_title = updates.proposalTitle
  if (updates.seasonLabel !== undefined) dbUpdates.season_label = updates.seasonLabel
  if (updates.coverDateLabel !== undefined) dbUpdates.cover_date_label = updates.coverDateLabel
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.status !== undefined) dbUpdates.status = updates.status

  const { data: updatedPresentation, error: updateError } = await access.admin
    .from('staff_presentations')
    .update(dbUpdates)
    .eq('id', id)
    .select('id, client_name, client_brand, proposal_title, season_label, cover_date_label, status, notes, template_key, created_at, updated_at')
    .single()

  if (updateError || !updatedPresentation) {
    return presentationDbErrorResponse(updateError, 'Failed to update presentation')
  }

  const { data: sections, error: sectionsError } = await access.admin
    .from('staff_presentation_sections')
    .select('id, kind, title, body, sort_order, is_enabled, payload_json')
    .eq('presentation_id', id)
    .order('sort_order', { ascending: true })

  if (sectionsError) {
    return presentationDbErrorResponse(sectionsError, 'Failed to fetch updated presentation sections')
  }

  return NextResponse.json({
    presentation: mapDbPresentationDetail(updatedPresentation, sections || []),
  })
}
