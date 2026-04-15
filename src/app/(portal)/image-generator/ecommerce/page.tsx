'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/image-generator/header'
import { CostEstimator } from '@/components/image-generator/cost-estimator'
import { JobProgress } from '@/components/image-generator/job-progress'
import { JobList } from '@/components/image-generator/job-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  EcommerceDestinationTag,
  EcommerceGenerationBrief,
  EcommerceGenerationConfig,
  EcommerceGenerationMode,
  EcommerceImageType,
  EcommerceWorkflowPreset,
  EcommerceWorkflowType,
  UploadedEcommerceSourceImage,
} from '@/types/image-generator/ecommerce'
import { getEcommerceBriefSummary, getEcommerceModeLabel, getEcommerceTotalImages } from '@/types/image-generator/ecommerce'
import type { GenerationJob } from '@/types/image-generator/jobs'
import {
  ACCEPTED_ECOMMERCE_MIME_TYPES,
  MAX_ECOMMERCE_UPLOAD_BYTES,
  MAX_ECOMMERCE_UPLOADS,
  getBaseName,
  getReadableFileSize,
  isAcceptedEcommerceMimeType,
} from '@/lib/ecommerce-uploads'

type LocalUpload = {
  id: string
  file: File
  previewUrl: string
  isPrimary: boolean
}

type PersistedUpload = UploadedEcommerceSourceImage & {
  clientId?: string
}

type BriefFields = {
  projectName: string
  clientName: string
  clientBrand: string
  audience: string
  tone: string
  usageContext: string
  merchandisingGoal: string
  channel: string
  pageType: string
  backgroundStyle: string
  outputIntent: string
  customNote: string
}

const OUTPUT_TYPES: { value: EcommerceImageType; label: string; description: string }[] = [
  { value: 'lifestyle', label: 'Lifestyle', description: 'Editorial concept imagery for decks, campaigns, and merch pages.' },
  { value: 'white-background', label: 'White background', description: 'Clean isolated product output for listings and review.' },
  { value: 'hero', label: 'Hero', description: 'Wide banner or opener image with strong hierarchy.' },
  { value: 'size-guide', label: 'Size guide', description: 'Technical support image for fit and measurement context.' },
]

const MODE_OPTIONS: { value: EcommerceGenerationMode; label: string; description: string }[] = [
  {
    value: 'single-product',
    label: 'Single product',
    description: 'Use one primary reference to create a focused asset set for a single hero product.',
  },
  {
    value: 'multi-angle-product',
    label: 'One product, multiple angles',
    description: 'Group several references of the same product so the generator preserves the full garment story.',
  },
  {
    value: 'multi-product',
    label: 'Multiple products',
    description: 'Treat each upload as its own product and generate a matching asset set per item.',
  },
]

const PRESET_OPTIONS: Record<
  EcommerceWorkflowType,
  Array<{
    key: EcommerceWorkflowPreset
    label: string
    description: string
    defaultTypes: EcommerceImageType[]
  }>
> = {
  proposal: [
    {
      key: 'proposal-hero',
      label: 'Proposal hero',
      description: 'Strong opener imagery for the first product story or cover-adjacent concept slide.',
      defaultTypes: ['hero', 'lifestyle'],
    },
    {
      key: 'proposal-lifestyle',
      label: 'Proposal lifestyle',
      description: 'Story-led concept images that help staff sell the product mood and setting.',
      defaultTypes: ['lifestyle'],
    },
    {
      key: 'proposal-comparison',
      label: 'Proposal comparison',
      description: 'Balanced outputs for showing concept plus clean reference in the same proposal.',
      defaultTypes: ['lifestyle', 'white-background'],
    },
    {
      key: 'proposal-packaging',
      label: 'Proposal packaging',
      description: 'Imagery that supports packaging, secondary details, or proposal add-ons.',
      defaultTypes: ['hero', 'white-background'],
    },
  ],
  web: [
    {
      key: 'web-listing',
      label: 'Web listing',
      description: 'Focus on clean ecommerce-ready outputs for product pages and merchandising feeds.',
      defaultTypes: ['white-background'],
    },
    {
      key: 'web-hero',
      label: 'Web hero',
      description: 'Generate wide merchandising assets for campaigns and landing pages.',
      defaultTypes: ['hero', 'lifestyle'],
    },
    {
      key: 'web-lifestyle',
      label: 'Web lifestyle',
      description: 'Create editorial support imagery for product-detail storytelling.',
      defaultTypes: ['lifestyle'],
    },
    {
      key: 'web-collection',
      label: 'Collection asset',
      description: 'Create a mix of banner and listing-friendly outputs for collection pages.',
      defaultTypes: ['hero', 'white-background'],
    },
    {
      key: 'web-size-guide',
      label: 'Size guide support',
      description: 'Prepare technical support outputs alongside a clean listing image.',
      defaultTypes: ['size-guide', 'white-background'],
    },
  ],
}

const DEFAULT_FIELDS: BriefFields = {
  projectName: '',
  clientName: '',
  clientBrand: '',
  audience: '',
  tone: '',
  usageContext: '',
  merchandisingGoal: '',
  channel: 'Proposal deck',
  pageType: 'Product story section',
  backgroundStyle: '',
  outputIntent: '',
  customNote: '',
}

function getPresetOptions(workflowType: EcommerceWorkflowType) {
  return PRESET_OPTIONS[workflowType]
}

function getDefaultPreset(workflowType: EcommerceWorkflowType) {
  return PRESET_OPTIONS[workflowType][0]
}

function buildPromptSummary(brief: EcommerceGenerationBrief, mode: EcommerceGenerationMode, imageTypes: EcommerceImageType[]) {
  const workflow = brief.workflowType === 'proposal' ? 'Proposal visuals' : 'Web assets'
  const parts = [
    workflow,
    brief.clientBrand || brief.projectName,
    brief.merchandisingGoal,
    brief.outputIntent,
    imageTypes.length > 0 ? `Outputs: ${imageTypes.join(', ')}` : '',
    `Grouping: ${getEcommerceModeLabel(mode)}`,
    brief.customNote || '',
  ].filter(Boolean)

  return parts.join(' | ')
}

function getGuidanceCopy(workflowType: EcommerceWorkflowType, mode: EcommerceGenerationMode) {
  const workflowCopy =
    workflowType === 'proposal'
      ? 'Use references that sell the concept clearly. Strong fabric detail and clean print visibility matter more than exhaustive angle coverage.'
      : 'Use clean, well-lit product references that preserve exact colour and construction. Consistency matters if the outputs are heading to ecommerce.'

  const modeCopy =
    mode === 'multi-product'
      ? 'Each upload becomes its own asset set, so keep files grouped by product and avoid mixing different garments in one frame.'
      : mode === 'multi-angle-product'
        ? 'Use multiple angles of the same garment only. Mark the strongest front or hero image as primary.'
        : 'A single strong primary image is enough for this workflow. Extra uploads are optional and mainly useful for replacing the primary.'

  return `${workflowCopy} ${modeCopy}`
}

export default function ProposalAndWebAssetsPage() {
  const { user } = useAuth()
  const [workflowType, setWorkflowType] = useState<EcommerceWorkflowType>('proposal')
  const [presetKey, setPresetKey] = useState<EcommerceWorkflowPreset>(getDefaultPreset('proposal').key)
  const [mode, setMode] = useState<EcommerceGenerationMode>('multi-angle-product')
  const [selectedTypes, setSelectedTypes] = useState<Set<EcommerceImageType>>(new Set(getDefaultPreset('proposal').defaultTypes))
  const [destinationTags, setDestinationTags] = useState<Set<EcommerceDestinationTag>>(new Set(['proposal']))
  const [fields, setFields] = useState<BriefFields>(DEFAULT_FIELDS)
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadsRef = useRef<LocalUpload[]>([])

  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])

  useEffect(() => {
    const params = new URLSearchParams({ jobType: 'ecommerce', limit: '10' })
    if (user?.id) params.set('userId', user.id)
    fetch(`/api/image-generator/jobs?${params}`)
      .then(res => res.json())
      .then(data => {
        setRecentJobs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    return () => {
      uploadsRef.current.forEach(upload => URL.revokeObjectURL(upload.previewUrl))
    }
  }, [])

  useEffect(() => {
    if (!activeJob || !['pending', 'processing'].includes(activeJob.status)) return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/image-generator/jobs/${activeJob.id}`)
      const job = await res.json()
      setActiveJob(job)
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval)
        const refreshParams = new URLSearchParams({ jobType: 'ecommerce', limit: '10' })
        if (user?.id) refreshParams.set('userId', user.id)
        fetch(`/api/image-generator/jobs?${refreshParams}`)
          .then(res => res.json())
          .then(data => setRecentJobs(Array.isArray(data) ? data : []))
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [activeJob, user?.id])

  function applyPreset(nextWorkflow: EcommerceWorkflowType, nextPreset: EcommerceWorkflowPreset) {
    const preset = getPresetOptions(nextWorkflow).find(option => option.key === nextPreset) || getDefaultPreset(nextWorkflow)
    setPresetKey(preset.key)
    setSelectedTypes(new Set(preset.defaultTypes))
  }

  function handleWorkflowChange(nextWorkflow: EcommerceWorkflowType) {
    setWorkflowType(nextWorkflow)
    applyPreset(nextWorkflow, getDefaultPreset(nextWorkflow).key)
    setDestinationTags(new Set([nextWorkflow]))
    setFields(current => ({
      ...current,
      channel: nextWorkflow === 'proposal' ? 'Proposal deck' : 'Ecommerce / web',
      pageType: nextWorkflow === 'proposal' ? 'Product story section' : 'Product page',
    }))
  }

  function handlePresetChange(nextPreset: EcommerceWorkflowPreset) {
    applyPreset(workflowType, nextPreset)
  }

  function toggleDestinationTag(tag: EcommerceDestinationTag, checked: boolean) {
    setDestinationTags(current => {
      const next = new Set(current)
      if (checked) next.add(tag)
      else next.delete(tag)
      if (next.size === 0) next.add(workflowType)
      return next
    })
  }

  function setPrimaryUpload(uploadId: string) {
    setUploads(current =>
      current.map(upload => ({
        ...upload,
        isPrimary: upload.id === uploadId,
      }))
    )
  }

  function validateFiles(files: File[]): string | null {
    if (uploads.length + files.length > MAX_ECOMMERCE_UPLOADS) {
      return `Upload up to ${MAX_ECOMMERCE_UPLOADS} images per job.`
    }

    for (const file of files) {
      if (!isAcceptedEcommerceMimeType(file.type)) {
        return `Unsupported file type. Use ${ACCEPTED_ECOMMERCE_MIME_TYPES.join(', ')}.`
      }

      if (file.size > MAX_ECOMMERCE_UPLOAD_BYTES) {
        return `Each image must be ${getReadableFileSize(MAX_ECOMMERCE_UPLOAD_BYTES)} or smaller.`
      }
    }

    return null
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return

    const files = Array.from(fileList)
    const validationError = validateFiles(files)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setErrorMessage(null)
    setUploads(current => {
      const next = [...current]
      for (const file of files) {
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          isPrimary: next.length === 0,
        })
      }

      if (!next.some(upload => upload.isPrimary) && next[0]) {
        next[0].isPrimary = true
      }

      return next
    })
  }

  function removeUpload(uploadId: string) {
    setUploads(current => {
      const uploadToRemove = current.find(upload => upload.id === uploadId)
      if (uploadToRemove) URL.revokeObjectURL(uploadToRemove.previewUrl)

      const next = current.filter(upload => upload.id !== uploadId)
      if (next.length > 0 && !next.some(upload => upload.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true }
      }
      return next
    })
  }

  async function uploadSourceImages(): Promise<PersistedUpload[]> {
    const formData = new FormData()
    uploads.forEach(upload => {
      formData.append('files', upload.file)
      formData.append('clientIds', upload.id)
    })

    const uploadRes = await fetch('/api/image-generator/ecommerce/uploads', {
      method: 'POST',
      body: formData,
    })

    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) {
      throw new Error(uploadData.error || 'Failed to upload source images')
    }

    return Array.isArray(uploadData.uploads) ? uploadData.uploads : []
  }

  function buildBrief(): EcommerceGenerationBrief {
    return {
      workflowType,
      presetKey,
      projectName: fields.projectName.trim(),
      clientName: fields.clientName.trim(),
      clientBrand: fields.clientBrand.trim(),
      audience: fields.audience.trim(),
      tone: fields.tone.trim(),
      usageContext: fields.usageContext.trim(),
      merchandisingGoal: fields.merchandisingGoal.trim(),
      channel: fields.channel.trim(),
      pageType: fields.pageType.trim(),
      backgroundStyle: fields.backgroundStyle.trim(),
      outputIntent: fields.outputIntent.trim(),
      destinationTags: Array.from(destinationTags),
      customNote: fields.customNote.trim(),
    }
  }

  function buildConfig(persistedUploads: PersistedUpload[]): EcommerceGenerationConfig {
    const uploadsByClientId = new Map(persistedUploads.map(upload => [upload.clientId, upload]))

    const sourceImages = uploads.map(upload => {
      const persisted = uploadsByClientId.get(upload.id)
      if (!persisted) {
        throw new Error(`Uploaded source image missing for ${upload.file.name}`)
      }

      return {
        id: persisted.id,
        originalFilename: persisted.originalFilename,
        storageUrl: persisted.storageUrl,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        isPrimary: upload.isPrimary,
      }
    })

    const primary = sourceImages.find(source => source.isPrimary) || sourceImages[0]
    const brief = buildBrief()

    let inputs: EcommerceGenerationConfig['inputs']
    if (mode === 'multi-product' || mode === 'separate-products') {
      inputs = sourceImages.map(source => ({
        id: crypto.randomUUID(),
        label: getBaseName(source.originalFilename),
        primarySourceId: source.id,
        sources: [{ ...source, isPrimary: true }],
      }))
    } else if (mode === 'single-product') {
      const singleSource = primary || sourceImages[0]
      inputs = singleSource
        ? [
            {
              id: crypto.randomUUID(),
              label: getBaseName(singleSource.originalFilename),
              primarySourceId: singleSource.id,
              sources: [{ ...singleSource, isPrimary: true }],
            },
          ]
        : []
    } else {
      inputs = [
        {
          id: crypto.randomUUID(),
          label: primary ? getBaseName(primary.originalFilename) : 'Uploaded product',
          primarySourceId: primary?.id || sourceImages[0]?.id || crypto.randomUUID(),
          sources: sourceImages,
        },
      ]
    }

    return {
      mode,
      brief,
      prompt: buildPromptSummary(brief, mode, Array.from(selectedTypes)),
      imageTypes: Array.from(selectedTypes),
      inputs,
    }
  }

  async function handleGenerate() {
    if (uploads.length === 0) {
      setErrorMessage('Upload at least one source image.')
      return
    }

    if (selectedTypes.size === 0) {
      setErrorMessage('Select at least one output type.')
      return
    }

    if (mode !== 'multi-product' && !uploads.some(upload => upload.isPrimary)) {
      setErrorMessage('Choose a primary image for this asset set.')
      return
    }

    setGenerating(true)
    setErrorMessage(null)

    try {
      const persistedUploads = await uploadSourceImages()
      const config = buildConfig(persistedUploads)
      const createRes = await fetch('/api/image-generator/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'ecommerce',
          productIds: config.inputs.map(input => input.id),
          config,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create asset-generation job')
      }

      setActiveJob(createData.job)
      await fetch('/api/image-generator/process?jobType=ecommerce', { method: 'POST' })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start generation')
    } finally {
      setGenerating(false)
    }
  }

  const previewConfig = buildConfigPreview()
  const totalImages = getEcommerceTotalImages(previewConfig)
  const primaryUploadId = uploads.find(upload => upload.isPrimary)?.id
  const guidanceCopy = getGuidanceCopy(workflowType, mode)

  return (
    <div className="space-y-8">
      <Header
        title="Proposal & Web Assets"
        description="Create structured proposal visuals and ecommerce-ready assets from one Print Room workflow."
      />

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-medium text-foreground">Workflow path</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose whether this brief is primarily for a proposal deck or live web use.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(['proposal', 'web'] as EcommerceWorkflowType[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleWorkflowChange(option)}
                    className={`rounded-2xl border p-4 text-left transition-all duration-300 ease-spring ${
                      workflowType === option
                        ? 'border-[rgb(var(--color-brand-blue))] bg-[rgb(var(--color-brand-blue))]/5 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-medium text-foreground">
                        {option === 'proposal' ? 'Proposal visuals' : 'Web assets'}
                      </p>
                      <Badge variant={workflowType === option ? 'blue' : 'gray'}>
                        {option === 'proposal' ? 'Deck-ready' : 'Merch-ready'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {option === 'proposal'
                        ? 'Create concept-led images that help sell the product in presentations and proposals.'
                        : 'Create clean, reusable assets for product pages, collection pages, and campaign placements.'}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">Preset pack</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {getPresetOptions(workflowType).map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePresetChange(preset.key)}
                      className={`rounded-2xl border p-4 text-left transition-all duration-300 ease-spring ${
                        presetKey === preset.key
                          ? 'border-[rgb(var(--color-brand-blue))] bg-white shadow-sm'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{preset.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-foreground">Source images</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload up to {MAX_ECOMMERCE_UPLOADS} JPG, PNG, or WebP files. Strong lighting and visible print detail produce the best results.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={mode === option.value ? 'accent' : 'secondary'}
                      onClick={() => setMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-5">
                <p className="text-sm font-medium text-foreground">{MODE_OPTIONS.find(option => option.value === mode)?.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{MODE_OPTIONS.find(option => option.value === mode)?.description}</p>
              </div>

              <button
                type="button"
                className={`flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-all duration-300 ease-spring ${
                  isDragging
                    ? 'border-[rgb(var(--color-brand-blue))] bg-[rgb(var(--color-brand-blue))]/5'
                    : 'border-gray-300 bg-muted/40 hover:bg-gray-50'
                }`}
                onClick={() => inputRef.current?.click()}
                onDragOver={event => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={event => {
                  event.preventDefault()
                  setIsDragging(false)
                  addFiles(event.dataTransfer.files)
                }}
              >
                <p className="text-base font-medium text-foreground">Drop product images here</p>
                <p className="mt-2 text-sm text-muted-foreground">or click to browse files from your computer</p>
                <p className="mt-4 text-xs text-muted-foreground">{guidanceCopy}</p>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_ECOMMERCE_MIME_TYPES.join(',')}
                multiple
                className="hidden"
                title="Upload product images"
                onChange={event => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
              />

              {uploads.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {uploads.map(upload => (
                    <Card key={upload.id} className="overflow-hidden">
                      <div className="aspect-square bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={upload.previewUrl} alt={upload.file.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{upload.file.name}</p>
                            <p className="text-xs text-muted-foreground">{getReadableFileSize(upload.file.size)}</p>
                          </div>
                          {upload.isPrimary && <Badge variant="blue">Primary</Badge>}
                        </div>
                        <div className="flex gap-2">
                          {mode !== 'multi-product' && (
                            <Button
                              type="button"
                              size="sm"
                              variant={primaryUploadId === upload.id ? 'accent' : 'secondary'}
                              onClick={() => setPrimaryUpload(upload.id)}
                              className="flex-1"
                            >
                              {primaryUploadId === upload.id ? 'Primary' : 'Set primary'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeUpload(upload.id)}
                            className="flex-1"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-medium text-foreground">Structured brief</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Replace generic prompting with the real context staff already use when building proposals and web assets.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={workflowType === 'proposal' ? 'Proposal or project name' : 'Campaign or project name'}>
                  <Input
                    value={fields.projectName}
                    onChange={event => setFields(current => ({ ...current, projectName: event.target.value }))}
                    placeholder={workflowType === 'proposal' ? 'Winter gifting proposal' : 'Mid-season launch'}
                  />
                </Field>
                <Field label="Client brand">
                  <Input
                    value={fields.clientBrand}
                    onChange={event => setFields(current => ({ ...current, clientBrand: event.target.value }))}
                    placeholder="Client brand or store name"
                  />
                </Field>
                <Field label="Client or internal owner">
                  <Input
                    value={fields.clientName}
                    onChange={event => setFields(current => ({ ...current, clientName: event.target.value }))}
                    placeholder="Client contact, team, or internal owner"
                  />
                </Field>
                <Field label="Audience">
                  <Input
                    value={fields.audience}
                    onChange={event => setFields(current => ({ ...current, audience: event.target.value }))}
                    placeholder="Who this image needs to persuade or serve"
                  />
                </Field>
                <Field label="Tone">
                  <Input
                    value={fields.tone}
                    onChange={event => setFields(current => ({ ...current, tone: event.target.value }))}
                    placeholder="Premium, understated, energetic, utility-led"
                  />
                </Field>
                <Field label="Usage context">
                  <Input
                    value={fields.usageContext}
                    onChange={event => setFields(current => ({ ...current, usageContext: event.target.value }))}
                    placeholder={workflowType === 'proposal' ? 'Deck product story slide' : 'Product page hero or collection banner'}
                  />
                </Field>
                <Field label="Merchandising goal">
                  <Input
                    value={fields.merchandisingGoal}
                    onChange={event => setFields(current => ({ ...current, merchandisingGoal: event.target.value }))}
                    placeholder="What the asset needs to help sell"
                  />
                </Field>
                <Field label="Output intent">
                  <Input
                    value={fields.outputIntent}
                    onChange={event => setFields(current => ({ ...current, outputIntent: event.target.value }))}
                    placeholder="What success looks like for this image set"
                  />
                </Field>
                <Field label="Channel">
                  <Input
                    value={fields.channel}
                    onChange={event => setFields(current => ({ ...current, channel: event.target.value }))}
                    placeholder={workflowType === 'proposal' ? 'Proposal PDF' : 'Shopify storefront'}
                  />
                </Field>
                <Field label="Page or placement">
                  <Input
                    value={fields.pageType}
                    onChange={event => setFields(current => ({ ...current, pageType: event.target.value }))}
                    placeholder={workflowType === 'proposal' ? 'Product story section' : 'Collection page, PDP, campaign module'}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Background or setting">
                    <Input
                      value={fields.backgroundStyle}
                      onChange={event => setFields(current => ({ ...current, backgroundStyle: event.target.value }))}
                      placeholder="White seamless, premium studio, outdoor lifestyle, retail-ready neutral"
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Optional custom note">
                    <Textarea
                      value={fields.customNote}
                      onChange={event => setFields(current => ({ ...current, customNote: event.target.value }))}
                      placeholder="Add any Print Room-specific nuance, campaign note, or client caveat."
                      className="min-h-28"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-medium text-foreground">Output plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the outputs that best match the current proposal or ecommerce brief.
            </p>

            <div className="mt-4 space-y-3">
              {OUTPUT_TYPES.map(type => (
                <label key={type.value} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(type.value)}
                    onChange={event => {
                      const next = new Set(selectedTypes)
                      if (event.target.checked) next.add(type.value)
                      else next.delete(type.value)
                      setSelectedTypes(next)
                    }}
                    className="mt-1 h-4 w-4 rounded border-input accent-[rgb(var(--color-brand-blue))]"
                  />
                  <div>
                    <span className="font-medium text-foreground">{type.label}</span>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-medium text-foreground">Destination tags</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Decide whether this set should be reused in proposals, web, or both.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(['proposal', 'web'] as EcommerceDestinationTag[]).map(tag => (
                <label key={tag} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={destinationTags.has(tag)}
                    onChange={event => toggleDestinationTag(tag, event.target.checked)}
                    className="h-4 w-4 rounded border-input accent-[rgb(var(--color-brand-blue))]"
                  />
                  <span>{tag === 'proposal' ? 'Proposal library' : 'Web library'}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Workflow</span>
              <Badge variant={workflowType === 'proposal' ? 'green' : 'cyan'}>
                {workflowType === 'proposal' ? 'Proposal visuals' : 'Web assets'}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Preset</span>
              <span className="font-medium text-foreground">{getPresetOptions(workflowType).find(preset => preset.key === presetKey)?.label}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Grouping</span>
              <span className="font-medium text-foreground">{getEcommerceModeLabel(mode)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Uploads</span>
              <span className="font-medium text-foreground">{uploads.length}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Output types</span>
              <span className="font-medium text-foreground">{selectedTypes.size}</span>
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Brief summary</p>
              <p className="mt-2 text-sm leading-6 text-foreground">{getEcommerceBriefSummary(previewConfig)}</p>
            </div>
          </Card>

          <CostEstimator totalImages={totalImages} includeBackgroundRemoval={selectedTypes.has('white-background')} />

          <Card className="p-5">
            <h3 className="text-base font-medium text-foreground">Source guidance</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{guidanceCopy}</p>
          </Card>

          {errorMessage && (
            <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
            </Card>
          )}

          <Button
            onClick={handleGenerate}
            disabled={uploads.length === 0 || selectedTypes.size === 0 || generating}
            className="w-full"
            size="lg"
            variant="accent"
          >
            {generating ? 'Uploading and starting...' : `Generate ${totalImages} assets`}
          </Button>

          {activeJob && <JobProgress job={activeJob} />}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Recent proposal and web jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review recent jobs and move strong outputs into the reusable asset library.
          </p>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading recent jobs...</p> : <JobList jobs={recentJobs} basePath="/image-generator/ecommerce" />}
      </div>
    </div>
  )

  function buildConfigPreview(): EcommerceGenerationConfig {
    const brief = buildBrief()
    const primaryUpload = uploads.find(upload => upload.isPrimary) || uploads[0]

    let inputs: EcommerceGenerationConfig['inputs']
    if (mode === 'multi-product' || mode === 'separate-products') {
      inputs = uploads.map(upload => ({
        id: upload.id,
        label: upload.file.name,
        primarySourceId: upload.id,
        sources: [],
      }))
    } else {
      inputs = primaryUpload
        ? [
            {
              id: primaryUpload.id,
              label: primaryUpload.file.name,
              primarySourceId: primaryUpload.id,
              sources: [],
            },
          ]
        : []
    }

    return {
      mode,
      brief,
      prompt: buildPromptSummary(brief, mode, Array.from(selectedTypes)),
      imageTypes: Array.from(selectedTypes),
      inputs,
    }
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
