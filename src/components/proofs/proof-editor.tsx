'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Download,
  Eye,
  ImagePlus,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { PresentationAssetPicker } from '@/components/presentations/presentation-asset-picker'
import { PresentationField } from '@/components/presentations/presentation-field'
import { ProofPreview } from '@/components/proofs/proof-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  calculateLineTotal,
  createDefaultDesign,
  createDefaultOrderLine,
  createDefaultPrintArea,
  reindexDesigns,
} from '@/lib/proofs/schema'
import type { GeneratedImageAsset } from '@/types/image-generator/assets'
import type { ProofDetail, ProofDesign, ProofDocument, ProofMethod, ProofOrderLine, ProofPrintArea } from '@/types/proofs'
import { PROOF_METHODS, SIZE_COLUMNS } from '@/types/proofs'

interface ProofEditorProps {
  proofId: string
}

type ActiveView = 'editor' | 'preview'
type ImageField = 'frontMockupUrl' | 'backMockupUrl' | 'artworkUrl'
type AssetTarget = { designId: string; field: ImageField } | null

const STATUS_VARIANT: Record<ProofDetail['status'], 'gray' | 'info' | 'success' | 'warning' | 'purple'> = {
  draft: 'gray',
  sent: 'info',
  approved: 'success',
  changes_requested: 'warning',
  superseded: 'purple',
  archived: 'gray',
}

const SELECT_CLASS =
  'flex h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-5 text-sm text-foreground transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:outline-none focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

export function ProofEditor({ proofId }: ProofEditorProps) {
  const [proof, setProof] = useState<ProofDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('editor')
  const [isDirty, setIsDirty] = useState(false)
  const [pendingExportTitle, setPendingExportTitle] = useState<string | null>(null)
  const [assetTarget, setAssetTarget] = useState<AssetTarget>(null)

  useEffect(() => {
    async function fetchProof() {
      try {
        const response = await fetch(`/api/proofs/${proofId}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load proof')
        }

        const payload = await response.json()
        setProof(payload.proof)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load proof')
      } finally {
        setLoading(false)
      }
    }

    fetchProof()
  }, [proofId])

  useEffect(() => {
    if (!pendingExportTitle || activeView !== 'preview') return

    const previousTitle = document.title
    let restored = false

    const restore = () => {
      if (restored) return
      restored = true
      document.title = previousTitle
      document.body.classList.remove('printing-proof')
      window.removeEventListener('afterprint', restore)
      setPendingExportTitle(null)
      setExporting(false)
    }

    document.body.classList.add('printing-proof')
    document.title = pendingExportTitle.replace(/\.pdf$/i, '')
    window.addEventListener('afterprint', restore)

    const printTimer = window.setTimeout(() => {
      window.print()
      window.setTimeout(restore, 1200)
    }, 220)

    return () => {
      window.clearTimeout(printTimer)
      window.removeEventListener('afterprint', restore)
      if (!restored) {
        document.title = previousTitle
        document.body.classList.remove('printing-proof')
      }
    }
  }, [activeView, pendingExportTitle])

  function updateProof(updater: (proof: ProofDetail) => ProofDetail) {
    setProof(current => (current ? updater(current) : current))
    setIsDirty(true)
  }

  function updateDocumentField<K extends keyof ProofDocument>(field: K, value: ProofDocument[K]) {
    updateProof(current => ({
      ...current,
      name: field === 'jobName' ? String(value) : current.name,
      customerName: field === 'customerName' ? String(value) : current.customerName,
      customerEmail: field === 'customerEmail' ? String(value) : current.customerEmail,
      document: {
        ...current.document,
        [field]: value,
      },
    }))
  }

  function updateStatus(status: ProofDetail['status']) {
    updateProof(current => ({ ...current, status }))
  }

  function updateDesign(designId: string, updater: (design: ProofDesign) => ProofDesign) {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        designs: current.document.designs.map(design => (
          design.id === designId ? updater(design) : design
        )),
      },
    }))
  }

  function addDesign() {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        designs: [
          ...current.document.designs,
          createDefaultDesign(current.document.designs.length + 1),
        ],
      },
    }))
  }

  function removeDesign(designId: string) {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        designs: reindexDesigns(current.document.designs.filter(design => design.id !== designId)),
      },
    }))
  }

  function updatePrintArea(designId: string, areaId: string, updater: (area: ProofPrintArea) => ProofPrintArea) {
    updateDesign(designId, design => ({
      ...design,
      printAreas: design.printAreas.map(area => area.id === areaId ? updater(area) : area),
    }))
  }

  function addPrintArea(designId: string) {
    updateDesign(designId, design => ({
      ...design,
      printAreas: [...design.printAreas, createDefaultPrintArea('PRINT AREA')],
    }))
  }

  function removePrintArea(designId: string, areaId: string) {
    updateDesign(designId, design => ({
      ...design,
      printAreas: design.printAreas.filter(area => area.id !== areaId),
    }))
  }

  function updateOrderLine(lineId: string, updater: (line: ProofOrderLine) => ProofOrderLine) {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        orderLines: current.document.orderLines.map(line => line.id === lineId ? updater(line) : line),
      },
    }))
  }

  function addOrderLine() {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        orderLines: [
          ...current.document.orderLines,
          createDefaultOrderLine(current.document.designs[0]?.index || 1),
        ],
      },
    }))
  }

  function removeOrderLine(lineId: string) {
    updateProof(current => ({
      ...current,
      document: {
        ...current.document,
        orderLines: current.document.orderLines.filter(line => line.id !== lineId),
      },
    }))
  }

  function handleAssetSelect(asset: GeneratedImageAsset) {
    if (!assetTarget) return
    updateDesign(assetTarget.designId, design => ({
      ...design,
      [assetTarget.field]: asset.storageUrl,
      name: design.name || asset.productLabel,
    }))
    setAssetTarget(null)
  }

  async function saveProof() {
    if (!proof) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/proofs/${proofId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: proof.document.jobName,
          customerName: proof.document.customerName,
          customerEmail: proof.document.customerEmail,
          status: proof.status,
          document: proof.document,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save proof')
      }

      const payload = await response.json()
      setProof(payload.proof)
      setIsDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save proof')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    if (!proof || isDirty) return

    setExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/proofs/${proofId}/export`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to prepare export')
      }

      const payload = await response.json()
      setActiveView('preview')
      setPendingExportTitle(payload.exportTitle || `${proof.name}.pdf`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export proof')
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && !proof) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </div>
    )
  }

  if (!proof) return null

  return (
    <div className="proof-editor space-y-8">
      <div className="proof-editor__chrome flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <BackLink />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {proof.document.jobName || proof.name || 'Untitled proof'}
            </h1>
            <Badge variant={STATUS_VARIANT[proof.status]}>
              {proof.status.replace('_', ' ')}
            </Badge>
            {isDirty && <Badge variant="warning">Unsaved changes</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {proof.organizationName} for {proof.document.customerName || proof.document.customerEmail}
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
          <Button variant="accent" onClick={saveProof} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting || isDirty}
            title={isDirty ? 'Save changes before exporting.' : undefined}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Preparing PDF...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="proof-editor__error rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {activeView === 'preview' ? (
        <ProofPreview proof={proof} />
      ) : (
        <div className="space-y-6">
          <ProofDetailsCard proof={proof} updateDocumentField={updateDocumentField} updateStatus={updateStatus} />
          <DesignsCard
            proof={proof}
            updateDesign={updateDesign}
            removeDesign={removeDesign}
            addDesign={addDesign}
            updatePrintArea={updatePrintArea}
            addPrintArea={addPrintArea}
            removePrintArea={removePrintArea}
            openAssetPicker={setAssetTarget}
          />
          <OrderLinesCard
            proof={proof}
            updateOrderLine={updateOrderLine}
            addOrderLine={addOrderLine}
            removeOrderLine={removeOrderLine}
          />
        </div>
      )}

      <PresentationAssetPicker
        open={Boolean(assetTarget)}
        onClose={() => setAssetTarget(null)}
        onSelectAsset={handleAssetSelect}
        defaultWorkflow="all"
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/proofs"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to proofs
    </Link>
  )
}

function ProofDetailsCard({
  proof,
  updateDocumentField,
  updateStatus,
}: {
  proof: ProofDetail
  updateDocumentField: <K extends keyof ProofDocument>(field: K, value: ProofDocument[K]) => void
  updateStatus: (status: ProofDetail['status']) => void
}) {
  const document = proof.document

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Proof details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <PresentationField label="Customer name">
          <Input value={document.customerName} onChange={event => updateDocumentField('customerName', event.target.value)} />
        </PresentationField>
        <PresentationField label="Customer email">
          <Input type="email" value={document.customerEmail} onChange={event => updateDocumentField('customerEmail', event.target.value)} />
        </PresentationField>
        <PresentationField label="Job name">
          <Input value={document.jobName} onChange={event => updateDocumentField('jobName', event.target.value)} />
        </PresentationField>
        <PresentationField label="Job reference">
          <Input value={document.jobReference} onChange={event => updateDocumentField('jobReference', event.target.value)} />
        </PresentationField>
        <PresentationField label="Delivery date">
          <Input value={document.deliveryDateLabel} onChange={event => updateDocumentField('deliveryDateLabel', event.target.value)} />
        </PresentationField>
        <PresentationField label="Status">
          <select value={proof.status} onChange={event => updateStatus(event.target.value as ProofDetail['status'])} className={SELECT_CLASS}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes requested</option>
            <option value="superseded">Superseded</option>
            <option value="archived">Archived</option>
          </select>
        </PresentationField>
        <PresentationField label="Prepared by">
          <Input value={document.preparedByName} onChange={event => updateDocumentField('preparedByName', event.target.value)} />
        </PresentationField>
        <PresentationField label="Prepared email">
          <Input value={document.preparedByEmail} onChange={event => updateDocumentField('preparedByEmail', event.target.value)} />
        </PresentationField>
        <PresentationField label="Prepared phone">
          <Input value={document.preparedByPhone} onChange={event => updateDocumentField('preparedByPhone', event.target.value)} />
        </PresentationField>
        <PresentationField label="Website">
          <Input value={document.website} onChange={event => updateDocumentField('website', event.target.value)} />
        </PresentationField>
        <div className="md:col-span-2">
          <PresentationField label="Terms">
            <Textarea value={document.terms} onChange={event => updateDocumentField('terms', event.target.value)} />
          </PresentationField>
        </div>
        <div className="md:col-span-2">
          <PresentationField label="Warning">
            <Textarea value={document.warning} onChange={event => updateDocumentField('warning', event.target.value)} />
          </PresentationField>
        </div>
        <div className="md:col-span-2">
          <PresentationField label="Additional job notes">
            <Textarea value={document.notes} onChange={event => updateDocumentField('notes', event.target.value)} />
          </PresentationField>
        </div>
      </CardContent>
    </Card>
  )
}

function DesignsCard({
  proof,
  updateDesign,
  removeDesign,
  addDesign,
  updatePrintArea,
  addPrintArea,
  removePrintArea,
  openAssetPicker,
}: {
  proof: ProofDetail
  updateDesign: (designId: string, updater: (design: ProofDesign) => ProofDesign) => void
  removeDesign: (designId: string) => void
  addDesign: () => void
  updatePrintArea: (designId: string, areaId: string, updater: (area: ProofPrintArea) => ProofPrintArea) => void
  addPrintArea: (designId: string) => void
  removePrintArea: (designId: string, areaId: string) => void
  openAssetPicker: (target: AssetTarget) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-lg">Designs</CardTitle>
        <Button variant="secondary" size="sm" onClick={addDesign}>
          <Plus className="mr-2 h-4 w-4" />
          Add design
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {proof.document.designs.map(design => (
          <div key={design.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="blue">Design {design.index}</Badge>
                <Badge variant="gray">{design.printAreas.length} print areas</Badge>
              </div>
              <Button variant="secondary" size="sm" onClick={() => removeDesign(design.id)} disabled={proof.document.designs.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <PresentationField label="Design name">
                <Input value={design.name} onChange={event => updateDesign(design.id, current => ({ ...current, name: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Subtitle">
                <Input value={design.subtitle} onChange={event => updateDesign(design.id, current => ({ ...current, subtitle: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Garment label">
                <Input value={design.garmentLabel} onChange={event => updateDesign(design.id, current => ({ ...current, garmentLabel: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Colour">
                <Input value={design.colourName} onChange={event => updateDesign(design.id, current => ({ ...current, colourName: event.target.value }))} />
              </PresentationField>
              <ImageUrlField
                label="Front mockup image"
                value={design.frontMockupUrl}
                onChange={value => updateDesign(design.id, current => ({ ...current, frontMockupUrl: value }))}
                onPick={() => openAssetPicker({ designId: design.id, field: 'frontMockupUrl' })}
              />
              <ImageUrlField
                label="Back mockup image"
                value={design.backMockupUrl}
                onChange={value => updateDesign(design.id, current => ({ ...current, backMockupUrl: value }))}
                onPick={() => openAssetPicker({ designId: design.id, field: 'backMockupUrl' })}
              />
              <ImageUrlField
                label="Artwork image"
                value={design.artworkUrl}
                onChange={value => updateDesign(design.id, current => ({ ...current, artworkUrl: value }))}
                onPick={() => openAssetPicker({ designId: design.id, field: 'artworkUrl' })}
              />
              <PresentationField label="Artwork background">
                <Input type="color" value={design.artworkBackground} onChange={event => updateDesign(design.id, current => ({ ...current, artworkBackground: event.target.value }))} className="h-10 px-3" />
              </PresentationField>
              <div className="md:col-span-2">
                <PresentationField label="Print heights note">
                  <Textarea value={design.printHeightsNote} onChange={event => updateDesign(design.id, current => ({ ...current, printHeightsNote: event.target.value }))} />
                </PresentationField>
              </div>
              <div className="md:col-span-2">
                <PresentationField label="Production note">
                  <Textarea value={design.productionNote} onChange={event => updateDesign(design.id, current => ({ ...current, productionNote: event.target.value }))} />
                </PresentationField>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Print areas</h3>
                <Button variant="secondary" size="sm" onClick={() => addPrintArea(design.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add area
                </Button>
              </div>
              {design.printAreas.map(area => (
                <PrintAreaEditor
                  key={area.id}
                  area={area}
                  onUpdate={updater => updatePrintArea(design.id, area.id, updater)}
                  onRemove={() => removePrintArea(design.id, area.id)}
                  canRemove={design.printAreas.length > 1}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ImageUrlField({
  label,
  value,
  onChange,
  onPick,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onPick: () => void
}) {
  return (
    <PresentationField label={label}>
      <div className="flex gap-2">
        <Input value={value} onChange={event => onChange(event.target.value)} placeholder="https://..." />
        <Button type="button" variant="secondary" size="icon" onClick={onPick} aria-label={`Choose ${label}`}>
          <ImagePlus className="h-4 w-4" />
        </Button>
      </div>
    </PresentationField>
  )
}

function PrintAreaEditor({
  area,
  onUpdate,
  onRemove,
  canRemove,
}: {
  area: ProofPrintArea
  onUpdate: (updater: (area: ProofPrintArea) => ProofPrintArea) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_0.82fr_0.64fr_0.64fr_0.82fr_0.82fr_auto]">
        <PresentationField label="Label">
          <Input value={area.label} onChange={event => onUpdate(current => ({ ...current, label: event.target.value }))} />
        </PresentationField>
        <PresentationField label="Method">
          <select value={area.method} onChange={event => onUpdate(current => ({ ...current, method: event.target.value as ProofMethod }))} className={SELECT_CLASS}>
            {PROOF_METHODS.map(method => (
              <option key={method} value={method}>{method.replace('_', ' ')}</option>
            ))}
          </select>
        </PresentationField>
        <PresentationField label="Width mm">
          <Input value={area.widthMm} onChange={event => onUpdate(current => ({ ...current, widthMm: event.target.value }))} />
        </PresentationField>
        <PresentationField label="Height mm">
          <Input value={area.heightMm} onChange={event => onUpdate(current => ({ ...current, heightMm: event.target.value }))} />
        </PresentationField>
        <PresentationField label="Pantone">
          <Input value={area.pantone} onChange={event => onUpdate(current => ({ ...current, pantone: event.target.value }))} />
        </PresentationField>
        <PresentationField label="Swatch">
          <Input type="color" value={area.pantoneHex} onChange={event => onUpdate(current => ({ ...current, pantoneHex: event.target.value }))} className="h-10 px-3" />
        </PresentationField>
        <div className="flex items-end">
          <Button variant="secondary" size="icon" onClick={onRemove} disabled={!canRemove} aria-label="Remove print area">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PresentationField label="Artwork status">
          <Input value={area.artworkStatus} onChange={event => onUpdate(current => ({ ...current, artworkStatus: event.target.value }))} />
        </PresentationField>
        <PresentationField label="Production note">
          <Input value={area.productionNote} onChange={event => onUpdate(current => ({ ...current, productionNote: event.target.value }))} />
        </PresentationField>
      </div>
    </div>
  )
}

function OrderLinesCard({
  proof,
  updateOrderLine,
  addOrderLine,
  removeOrderLine,
}: {
  proof: ProofDetail
  updateOrderLine: (lineId: string, updater: (line: ProofOrderLine) => ProofOrderLine) => void
  addOrderLine: () => void
  removeOrderLine: (lineId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-lg">Garment/order details</CardTitle>
        <Button variant="secondary" size="sm" onClick={addOrderLine}>
          <Plus className="mr-2 h-4 w-4" />
          Add line
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {proof.document.orderLines.map(line => (
          <div key={line.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gray">Design {line.designIndex}</Badge>
                <Badge variant="blue">Total {calculateLineTotal(line)}</Badge>
                {line.isStaff && <Badge variant="purple">Staff subtotal</Badge>}
              </div>
              <Button variant="secondary" size="sm" onClick={() => removeOrderLine(line.id)} disabled={proof.document.orderLines.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-6">
              <PresentationField label="Name">
                <Input value={line.name} onChange={event => updateOrderLine(line.id, current => ({ ...current, name: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Design">
                <select value={line.designIndex} onChange={event => updateOrderLine(line.id, current => ({ ...current, designIndex: Number(event.target.value) }))} className={SELECT_CLASS}>
                  {proof.document.designs.map(design => (
                    <option key={design.id} value={design.index}>Design {design.index}</option>
                  ))}
                </select>
              </PresentationField>
              <PresentationField label="Brand">
                <Input value={line.brand} onChange={event => updateOrderLine(line.id, current => ({ ...current, brand: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Garment">
                <Input value={line.garment} onChange={event => updateOrderLine(line.id, current => ({ ...current, garment: event.target.value }))} />
              </PresentationField>
              <PresentationField label="SKU">
                <Input value={line.sku} onChange={event => updateOrderLine(line.id, current => ({ ...current, sku: event.target.value }))} />
              </PresentationField>
              <PresentationField label="Colour">
                <Input value={line.colour} onChange={event => updateOrderLine(line.id, current => ({ ...current, colour: event.target.value }))} />
              </PresentationField>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {SIZE_COLUMNS.map(column => (
                <label key={column} className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{column}</span>
                  <Input
                    inputMode="numeric"
                    value={line.quantities[column]}
                    onChange={event => updateOrderLine(line.id, current => ({
                      ...current,
                      quantities: {
                        ...current.quantities,
                        [column]: event.target.value.replace(/[^\d]/g, ''),
                      },
                    }))}
                    className="px-3 text-center"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
