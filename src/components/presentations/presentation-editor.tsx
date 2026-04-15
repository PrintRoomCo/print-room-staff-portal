'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { PresentationPreview } from '@/components/presentations/presentation-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createBlankSection, reindexSections } from '@/lib/presentations/schema'
import type {
  CommercialTermsPayload,
  PackagingIdea,
  PresentationDetail,
  PresentationSection,
  PresentationSectionKind,
  PricingRow,
  ProductPackagingPayload,
  ProductPricingPayload,
  ProductStoryPayload,
  SupportingIdeaPayload,
} from '@/types/presentations'

interface PresentationEditorProps {
  presentationId: string
}

const STATUS_VARIANT: Record<PresentationDetail['status'], 'gray' | 'info' | 'success'> = {
  draft: 'gray',
  ready: 'success',
  archived: 'info',
}

export function PresentationEditor({ presentationId }: PresentationEditorProps) {
  const [presentation, setPresentation] = useState<PresentationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor')
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    async function fetchPresentation() {
      try {
        const response = await fetch(`/api/presentations/${presentationId}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load presentation')
        }

        const payload = await response.json()
        setPresentation(payload.presentation)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load presentation')
      } finally {
        setLoading(false)
      }
    }

    fetchPresentation()
  }, [presentationId])

  function updatePresentationField<K extends keyof PresentationDetail>(field: K, value: PresentationDetail[K]) {
    setPresentation(current => (current ? { ...current, [field]: value } : current))
    setIsDirty(true)
  }

  function updateSection(sectionId: string, updater: (section: PresentationSection) => PresentationSection) {
    setPresentation(current => {
      if (!current) return current

      return {
        ...current,
        sections: current.sections.map(section =>
          section.id === sectionId ? updater(section) : section
        ),
      }
    })
    setIsDirty(true)
  }

  function addSection(kind: PresentationSectionKind) {
    setPresentation(current => {
      if (!current) return current

      return {
        ...current,
        sections: reindexSections([
          ...current.sections,
          createBlankSection(kind, current.sections.length),
        ]),
        sectionCount: current.sections.length + 1,
      }
    })
    setIsDirty(true)
  }

  function removeSection(sectionId: string) {
    setPresentation(current => {
      if (!current) return current

      return {
        ...current,
        sections: reindexSections(current.sections.filter(section => section.id !== sectionId)),
        sectionCount: Math.max(current.sections.length - 1, 0),
      }
    })
    setIsDirty(true)
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setPresentation(current => {
      if (!current) return current

      const currentIndex = current.sections.findIndex(section => section.id === sectionId)
      const nextIndex = currentIndex + direction

      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.sections.length) {
        return current
      }

      const nextSections = [...current.sections]
      const [section] = nextSections.splice(currentIndex, 1)
      nextSections.splice(nextIndex, 0, section)

      return {
        ...current,
        sections: reindexSections(nextSections),
      }
    })
    setIsDirty(true)
  }

  async function savePresentation() {
    if (!presentation) return

    setSaving(true)
    setError(null)

    try {
      const sectionsResponse = await fetch(`/api/presentations/${presentationId}/sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: presentation.sections }),
      })

      if (!sectionsResponse.ok) {
        const payload = await sectionsResponse.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save presentation sections')
      }

      const sectionsPayload = await sectionsResponse.json()

      const presentationResponse = await fetch(`/api/presentations/${presentationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: presentation.clientName,
          clientBrand: presentation.clientBrand,
          proposalTitle: presentation.proposalTitle,
          seasonLabel: presentation.seasonLabel,
          coverDateLabel: presentation.coverDateLabel,
          notes: presentation.notes,
          status: presentation.status,
        }),
      })

      if (!presentationResponse.ok) {
        const payload = await presentationResponse.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save presentation')
      }

      const payload = await presentationResponse.json()
      setPresentation({
        ...payload.presentation,
        sections: sectionsPayload.sections || payload.presentation.sections,
      })
      setIsDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save presentation')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && !presentation) {
    return (
      <div className="space-y-6">
        <Link
          href="/presentations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to presentations
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </div>
    )
  }

  if (!presentation) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/presentations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to presentations
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {presentation.proposalTitle || 'Untitled proposal'}
            </h1>
            <Badge variant={STATUS_VARIANT[presentation.status]}>
              {presentation.status}
            </Badge>
            {isDirty && <Badge variant="warning">Unsaved changes</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {presentation.clientBrand} for {presentation.clientName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveView('editor')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                activeView === 'editor'
                  ? 'bg-[rgb(var(--color-brand-blue))] text-white'
                  : 'text-muted-foreground'
              }`}
            >
              <PencilLine className="h-4 w-4" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveView('preview')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                activeView === 'preview'
                  ? 'bg-[rgb(var(--color-brand-blue))] text-white'
                  : 'text-muted-foreground'
              }`}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>
          <Button variant="accent" onClick={savePresentation} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {activeView === 'preview' ? (
        <PresentationPreview presentation={presentation} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proposal details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Client name">
                <Input
                  value={presentation.clientName}
                  onChange={event => updatePresentationField('clientName', event.target.value)}
                  placeholder="Four Square"
                />
              </Field>
              <Field label="Client brand">
                <Input
                  value={presentation.clientBrand}
                  onChange={event => updatePresentationField('clientBrand', event.target.value)}
                  placeholder="Four Square"
                />
              </Field>
              <Field label="Proposal title">
                <Input
                  value={presentation.proposalTitle}
                  onChange={event => updatePresentationField('proposalTitle', event.target.value)}
                  placeholder="Proposed product range"
                />
              </Field>
              <Field label="Season label">
                <Input
                  value={presentation.seasonLabel}
                  onChange={event => updatePresentationField('seasonLabel', event.target.value)}
                  placeholder="Summer 2026/27"
                />
              </Field>
              <Field label="Cover date">
                <Input
                  value={presentation.coverDateLabel}
                  onChange={event => updatePresentationField('coverDateLabel', event.target.value)}
                  placeholder="April 2026"
                />
              </Field>
              <Field label="Status">
                <select
                  value={presentation.status}
                  onChange={event => updatePresentationField('status', event.target.value as PresentationDetail['status'])}
                  className="flex h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-5 text-sm text-foreground transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:outline-none focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]"
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Internal notes">
                  <Textarea
                    value={presentation.notes}
                    onChange={event => updatePresentationField('notes', event.target.value)}
                    placeholder="Optional notes for the team"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg">Proposal sections</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Reorder, disable, or tailor sections to match the client narrative.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => addSection('brand-intro')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Intro
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('brand-context')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Context
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('product-story')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Story
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('product-pricing')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Pricing
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('product-packaging')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Packaging
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('supporting-idea')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Idea
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addSection('commercial-terms')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Terms
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {presentation.sections.map((section, index) => (
                <SectionEditorCard
                  key={section.id}
                  section={section}
                  canMoveUp={index > 0}
                  canMoveDown={index < presentation.sections.length - 1}
                  onMoveUp={() => moveSection(section.id, -1)}
                  onMoveDown={() => moveSection(section.id, 1)}
                  onRemove={() => removeSection(section.id)}
                  onUpdate={nextSection => updateSection(section.id, () => nextSection)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SectionEditorCard({
  section,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdate,
}: {
  section: PresentationSection
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onUpdate: (section: PresentationSection) => void
}) {
  function updateBase<K extends keyof PresentationSection>(field: K, value: PresentationSection[K]) {
    onUpdate({ ...section, [field]: value })
  }

  function updatePayload(nextPayload: PresentationSection['payload']) {
    onUpdate({ ...section, payload: nextPayload })
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="blue">{section.kind}</Badge>
            {!section.isEnabled && <Badge variant="gray">Hidden from preview</Badge>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Section title">
              <Input
                value={section.title}
                onChange={event => updateBase('title', event.target.value)}
                placeholder="Section title"
              />
            </Field>
            <Field label="Show in proposal">
              <div className="flex h-10 items-center justify-between rounded-full border border-gray-200 bg-white px-5 text-sm text-foreground">
                <span>{section.isEnabled ? 'Enabled' : 'Disabled'}</span>
                <input
                  type="checkbox"
                  checked={section.isEnabled}
                  onChange={event => updateBase('isEnabled', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onMoveUp} disabled={!canMoveUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={onMoveDown} disabled={!canMoveDown}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {(section.kind === 'cover' || section.kind === 'brand-intro' || section.kind === 'brand-context') && (
          <Field label="Body copy">
            <Textarea
              value={section.body}
              onChange={event => updateBase('body', event.target.value)}
              placeholder="Add client-facing copy"
            />
          </Field>
        )}

        {section.kind === 'product-story' && (
          <ProductStoryEditor
            payload={section.payload as ProductStoryPayload}
            onChange={updatePayload}
          />
        )}

        {section.kind === 'product-pricing' && (
          <ProductPricingEditor
            payload={section.payload as ProductPricingPayload}
            onChange={updatePayload}
          />
        )}

        {section.kind === 'product-packaging' && (
          <ProductPackagingEditor
            payload={section.payload as ProductPackagingPayload}
            onChange={updatePayload}
          />
        )}

        {section.kind === 'supporting-idea' && (
          <SupportingIdeaEditor
            payload={section.payload as SupportingIdeaPayload}
            onChange={updatePayload}
          />
        )}

        {section.kind === 'commercial-terms' && (
          <CommercialTermsEditor
            payload={section.payload as CommercialTermsPayload}
            onChange={updatePayload}
          />
        )}
      </div>
    </div>
  )
}

function ProductStoryEditor({
  payload,
  onChange,
}: {
  payload: ProductStoryPayload
  onChange: (payload: ProductStoryPayload) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Product name">
        <Input
          value={payload.productName}
          onChange={event => onChange({ ...payload, productName: event.target.value })}
          placeholder="Beach towel"
        />
      </Field>
      <Field label="Tagline">
        <Input
          value={payload.tagline}
          onChange={event => onChange({ ...payload, tagline: event.target.value })}
          placeholder="Dry off in style"
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Story copy">
          <Textarea
            value={payload.storyCopy}
            onChange={event => onChange({ ...payload, storyCopy: event.target.value })}
            placeholder="Write the narrative hook for this product"
          />
        </Field>
      </div>
      <Field label="Mockup caption">
        <Input
          value={payload.mockupCaption}
          onChange={event => onChange({ ...payload, mockupCaption: event.target.value })}
          placeholder="Kick off summer"
        />
      </Field>
      <Field label="Mockup note">
        <Textarea
          value={payload.mockupNote}
          onChange={event => onChange({ ...payload, mockupNote: event.target.value })}
          placeholder="Optional note about the visual direction"
          className="min-h-24"
        />
      </Field>
    </div>
  )
}

function ProductPricingEditor({
  payload,
  onChange,
}: {
  payload: ProductPricingPayload
  onChange: (payload: ProductPricingPayload) => void
}) {
  function updateRow(index: number, nextRow: PricingRow) {
    const nextRows = payload.pricingRows.map((row, rowIndex) => (rowIndex === index ? nextRow : row))
    onChange({ ...payload, pricingRows: nextRows })
  }

  function removeRow(index: number) {
    onChange({
      ...payload,
      pricingRows: payload.pricingRows.filter((_, rowIndex) => rowIndex !== index),
    })
  }

  function addRow() {
    onChange({
      ...payload,
      pricingRows: [
        ...payload.pricingRows,
        { label: '', details: [], values: payload.pricingColumns.map(() => '') },
      ],
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name">
          <Input
            value={payload.productName}
            onChange={event => onChange({ ...payload, productName: event.target.value })}
            placeholder="Beach towel"
          />
        </Field>
        <Field label="Pricing title">
          <Input
            value={payload.pricingTitle}
            onChange={event => onChange({ ...payload, pricingTitle: event.target.value })}
            placeholder="Indicative pricing"
          />
        </Field>
        <Field label="Pricing columns (comma separated)">
          <Input
            value={payload.pricingColumns.join(', ')}
            onChange={event =>
              onChange({
                ...payload,
                pricingColumns: splitCommaList(event.target.value),
                pricingRows: payload.pricingRows.map(row => ({
                  ...row,
                  values: resizeValues(row.values, splitCommaList(event.target.value).length),
                })),
              })
            }
            placeholder="10,000, 20,000"
          />
        </Field>
        <Field label="Lead time">
          <Input
            value={payload.leadTime}
            onChange={event => onChange({ ...payload, leadTime: event.target.value })}
            placeholder="Lead time details"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Customisation options (one per line)">
            <Textarea
              value={payload.customisationOptions.join('\n')}
              onChange={event => onChange({ ...payload, customisationOptions: splitLines(event.target.value) })}
              placeholder="Thread colours"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Pricing rows</p>
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add row
          </Button>
        </div>

        {payload.pricingRows.map((row, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Row label">
                <Input
                  value={row.label}
                  onChange={event => updateRow(index, { ...row, label: event.target.value })}
                  placeholder="Recommended option"
                />
              </Field>
              <div className="flex items-end justify-end">
                <Button variant="secondary" size="sm" onClick={() => removeRow(index)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove row
                </Button>
              </div>
              <div className="md:col-span-2">
                <Field label="Row details (one per line)">
                  <Textarea
                    value={row.details.join('\n')}
                    onChange={event => updateRow(index, { ...row, details: splitLines(event.target.value) })}
                    className="min-h-24"
                    placeholder="Terry both sides"
                  />
                </Field>
              </div>
              {payload.pricingColumns.map((column, valueIndex) => (
                <Field key={`${column}-${valueIndex}`} label={column || `Value ${valueIndex + 1}`}>
                  <Input
                    value={row.values[valueIndex] || ''}
                    onChange={event =>
                      updateRow(index, {
                        ...row,
                        values: row.values.map((value, rowValueIndex) =>
                          rowValueIndex === valueIndex ? event.target.value : value
                        ),
                      })
                    }
                    placeholder="$0.00"
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Recommendation title">
          <Input
            value={payload.recommendationTitle}
            onChange={event => onChange({ ...payload, recommendationTitle: event.target.value })}
            placeholder="Our recommendation"
          />
        </Field>
        <Field label="Retail note">
          <Input
            value={payload.retailNote}
            onChange={event => onChange({ ...payload, retailNote: event.target.value })}
            placeholder="Optional retail context"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Recommendation body">
            <Textarea
              value={payload.recommendationBody}
              onChange={event => onChange({ ...payload, recommendationBody: event.target.value })}
              placeholder="Why this recommendation is commercially strongest"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Pricing disclaimer">
            <Textarea
              value={payload.pricingDisclaimer}
              onChange={event => onChange({ ...payload, pricingDisclaimer: event.target.value })}
              placeholder="Pricing disclaimer"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Certifications (one per line)">
            <Textarea
              value={payload.certifications.join('\n')}
              onChange={event => onChange({ ...payload, certifications: splitLines(event.target.value) })}
              className="min-h-24"
              placeholder="SMETA"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

function ProductPackagingEditor({
  payload,
  onChange,
}: {
  payload: ProductPackagingPayload
  onChange: (payload: ProductPackagingPayload) => void
}) {
  function updateIdea(index: number, nextIdea: PackagingIdea) {
    onChange({
      ...payload,
      packagingIdeas: payload.packagingIdeas.map((idea, ideaIndex) => (ideaIndex === index ? nextIdea : idea)),
    })
  }

  function addIdea() {
    onChange({
      ...payload,
      packagingIdeas: [...payload.packagingIdeas, { title: '', body: '' }],
    })
  }

  function removeIdea(index: number) {
    onChange({
      ...payload,
      packagingIdeas: payload.packagingIdeas.filter((_, ideaIndex) => ideaIndex !== index),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name">
          <Input
            value={payload.productName}
            onChange={event => onChange({ ...payload, productName: event.target.value })}
            placeholder="Beach ball"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Intro">
            <Textarea
              value={payload.intro}
              onChange={event => onChange({ ...payload, intro: event.target.value })}
              placeholder="Introduce the packaging story"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Packaging ideas</p>
          <Button variant="secondary" size="sm" onClick={addIdea}>
            <Plus className="mr-2 h-4 w-4" />
            Add idea
          </Button>
        </div>

        {payload.packagingIdeas.map((idea, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_1fr_auto]">
            <Field label="Idea title">
              <Input
                value={idea.title}
                onChange={event => updateIdea(index, { ...idea, title: event.target.value })}
                placeholder="rPET drawstring bag"
              />
            </Field>
            <Field label="Idea body">
              <Textarea
                value={idea.body}
                onChange={event => updateIdea(index, { ...idea, body: event.target.value })}
                className="min-h-24"
                placeholder="How this idea helps the pitch"
              />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => removeIdea(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Field label="Footer note">
        <Textarea
          value={payload.footerNote}
          onChange={event => onChange({ ...payload, footerNote: event.target.value })}
          placeholder="Optional note beneath the packaging ideas"
          className="min-h-24"
        />
      </Field>
    </div>
  )
}

function SupportingIdeaEditor({
  payload,
  onChange,
}: {
  payload: SupportingIdeaPayload
  onChange: (payload: SupportingIdeaPayload) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Eyebrow">
        <Input
          value={payload.eyebrow}
          onChange={event => onChange({ ...payload, eyebrow: event.target.value })}
          placeholder="Food for thought"
        />
      </Field>
      <Field label="Headline">
        <Input
          value={payload.headline}
          onChange={event => onChange({ ...payload, headline: event.target.value })}
          placeholder="Layer in a utility idea"
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Body">
          <Textarea
            value={payload.body}
            onChange={event => onChange({ ...payload, body: event.target.value })}
            placeholder="Explain the supporting concept"
          />
        </Field>
      </div>
    </div>
  )
}

function CommercialTermsEditor({
  payload,
  onChange,
}: {
  payload: CommercialTermsPayload
  onChange: (payload: CommercialTermsPayload) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Shipping terms">
        <Textarea
          value={payload.shippingTerms}
          onChange={event => onChange({ ...payload, shippingTerms: event.target.value })}
          placeholder="Shipping terms"
        />
      </Field>
      <Field label="Payment terms">
        <Textarea
          value={payload.paymentTerms}
          onChange={event => onChange({ ...payload, paymentTerms: event.target.value })}
          placeholder="Payment terms"
        />
      </Field>
      <Field label="Final disclaimer">
        <Textarea
          value={payload.disclaimer}
          onChange={event => onChange({ ...payload, disclaimer: event.target.value })}
          placeholder="Additional commercial disclaimer"
          className="min-h-24"
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function resizeValues(values: string[], length: number) {
  return Array.from({ length }, (_, index) => values[index] || '')
}
