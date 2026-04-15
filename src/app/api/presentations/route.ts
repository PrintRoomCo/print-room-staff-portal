import { NextRequest, NextResponse } from 'next/server'
import { createDefaultProposalSections, DEFAULT_PRESENTATION_TEMPLATE_KEY } from '@/lib/presentations/template'
import { presentationDbErrorResponse, requirePresentationStaffAccess } from '@/lib/presentations/server'
import {
  mapDbPresentationSummary,
  normalizePresentationCreateInput,
  validateRequiredCreateFields,
} from '@/lib/presentations/schema'

export async function GET() {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { admin, context } = access

  let query = admin
    .from('staff_presentations')
    .select('id, client_name, client_brand, proposal_title, season_label, cover_date_label, status, notes, template_key, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (!context.isAdmin) {
    query = query.eq('staff_user_id', context.staffId)
  }

  const { data: presentations, error } = await query

  if (error) {
    return presentationDbErrorResponse(error, 'Failed to fetch presentations')
  }

  const presentationIds = (presentations || []).map(item => item.id)
  let sectionCountByPresentation = new Map<string, number>()

  if (presentationIds.length > 0) {
    const { data: sections, error: sectionsError } = await admin
      .from('staff_presentation_sections')
      .select('presentation_id')
      .in('presentation_id', presentationIds)

    if (sectionsError) {
      return presentationDbErrorResponse(sectionsError, 'Failed to fetch presentation sections')
    }

    sectionCountByPresentation = (sections || []).reduce((acc, section) => {
      acc.set(section.presentation_id, (acc.get(section.presentation_id) || 0) + 1)
      return acc
    }, new Map<string, number>())
  }

  return NextResponse.json({
    presentations: (presentations || []).map(item =>
      mapDbPresentationSummary(item, sectionCountByPresentation.get(item.id) || 0)
    ),
  })
}

export async function POST(request: NextRequest) {
  const access = await requirePresentationStaffAccess()
  if (access.error) return access.error

  const { admin, context } = access
  const payload = normalizePresentationCreateInput(await request.json().catch(() => ({})))
  const missingFields = validateRequiredCreateFields(payload)

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required fields: ${missingFields.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const { data: presentation, error: createError } = await admin
    .from('staff_presentations')
    .insert({
      staff_user_id: context.staffId,
      client_name: payload.clientName,
      client_brand: payload.clientBrand,
      proposal_title: payload.proposalTitle,
      season_label: payload.seasonLabel,
      cover_date_label: payload.coverDateLabel,
      status: 'draft',
      notes: payload.notes || '',
      template_key: DEFAULT_PRESENTATION_TEMPLATE_KEY,
    })
    .select('id, client_name, client_brand, proposal_title, season_label, cover_date_label, status, notes, template_key, created_at, updated_at')
    .single()

  if (createError || !presentation) {
    return presentationDbErrorResponse(createError, 'Failed to create presentation')
  }

  const sections = createDefaultProposalSections(payload)
  const sectionRows = sections.map(section => ({
    id: section.id,
    presentation_id: presentation.id,
    kind: section.kind,
    title: section.title,
    body: section.body,
    sort_order: section.sortOrder,
    is_enabled: section.isEnabled,
    payload_json: section.payload,
  }))

  const { error: sectionsError } = await admin
    .from('staff_presentation_sections')
    .insert(sectionRows)

  if (sectionsError) {
    await admin.from('staff_presentations').delete().eq('id', presentation.id)
    return presentationDbErrorResponse(sectionsError, 'Failed to create presentation sections')
  }

  return NextResponse.json(
    {
      presentation: mapDbPresentationSummary(presentation, sections.length),
    },
    { status: 201 }
  )
}
