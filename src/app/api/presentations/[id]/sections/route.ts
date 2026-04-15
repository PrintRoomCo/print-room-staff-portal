import { NextRequest, NextResponse } from 'next/server'
import { presentationDbErrorResponse, requireAccessiblePresentation, requirePresentationStaffAccess } from '@/lib/presentations/server'
import {
  mapDbPresentationDetail,
  normalizePresentationSectionsInput,
  reindexSections,
  validatePresentationForReady,
} from '@/lib/presentations/schema'
import type { PresentationSection } from '@/types/presentations'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { id } = await params
  const presentationAccess = await requireAccessiblePresentation(id, access.context)
  if (presentationAccess.error) return presentationAccess.error

  let sections: PresentationSection[]
  try {
    const body = await request.json().catch(() => ({}))
    sections = reindexSections(normalizePresentationSectionsInput(body.sections))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid sections payload' },
      { status: 400 }
    )
  }

  if (presentationAccess.presentation.status === 'ready') {
    const validationErrors = validatePresentationForReady(
      {
        clientName: presentationAccess.presentation.client_name,
        clientBrand: presentationAccess.presentation.client_brand,
        proposalTitle: presentationAccess.presentation.proposal_title,
        seasonLabel: presentationAccess.presentation.season_label,
        coverDateLabel: presentationAccess.presentation.cover_date_label,
      },
      sections
    )

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0], validationErrors },
        { status: 400 }
      )
    }
  }

  const rows = sections.map(section => ({
    id: section.id,
    presentation_id: id,
    kind: section.kind,
    title: section.title,
    body: section.body,
    sort_order: section.sortOrder,
    is_enabled: section.isEnabled,
    payload_json: section.payload,
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await access.admin
      .from('staff_presentation_sections')
      .upsert(rows, { onConflict: 'id' })

    if (upsertError) {
      return presentationDbErrorResponse(upsertError, 'Failed to save presentation sections')
    }

    const keepIds = rows.map(row => `"${row.id}"`).join(',')
    const { error: deleteError } = await access.admin
      .from('staff_presentation_sections')
      .delete()
      .eq('presentation_id', id)
      .not('id', 'in', `(${keepIds})`)

    if (deleteError) {
      return presentationDbErrorResponse(deleteError, 'Failed to remove deleted presentation sections')
    }
  } else {
    const { error: deleteError } = await access.admin
      .from('staff_presentation_sections')
      .delete()
      .eq('presentation_id', id)

    if (deleteError) {
      return presentationDbErrorResponse(deleteError, 'Failed to clear presentation sections')
    }
  }

  const { data: savedSections, error: savedSectionsError } = await access.admin
    .from('staff_presentation_sections')
    .select('id, kind, title, body, sort_order, is_enabled, payload_json')
    .eq('presentation_id', id)
    .order('sort_order', { ascending: true })

  if (savedSectionsError) {
    return presentationDbErrorResponse(savedSectionsError, 'Failed to fetch saved presentation sections')
  }

  return NextResponse.json({
    sections: mapDbPresentationDetail(presentationAccess.presentation, savedSections || []).sections,
  })
}
