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
import { Textarea } from '@/components/ui/textarea'
import type {
  EcommerceGenerationConfig,
  EcommerceGenerationMode,
  EcommerceImageType,
  UploadedEcommerceSourceImage,
} from '@/types/image-generator/ecommerce'
import { getEcommerceTotalImages } from '@/types/image-generator/ecommerce'
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

const AVAILABLE_TYPES: { value: EcommerceImageType; label: string; description: string }[] = [
  { value: 'lifestyle', label: 'Lifestyle', description: 'Styled editorial scene built from the uploaded product photo.' },
  { value: 'white-background', label: 'White Background', description: 'Clean isolated product shot for listings and production review.' },
  { value: 'hero', label: 'Hero Banner', description: 'Wide merchandising image for collection pages and campaigns.' },
  { value: 'size-guide', label: 'Size Guide', description: 'Technical flat-lay image with measurement references.' },
]

export default function EcommercePage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<EcommerceGenerationMode>('separate-products')
  const [selectedTypes, setSelectedTypes] = useState<Set<EcommerceImageType>>(new Set(['lifestyle', 'white-background']))
  const [prompt, setPrompt] = useState('')
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadsRef = useRef<LocalUpload[]>([])

  useEffect(() => { uploadsRef.current = uploads }, [uploads])

  useEffect(() => {
    const params = new URLSearchParams({ jobType: 'ecommerce', limit: '10' })
    if (user?.id) params.set('userId', user.id)
    fetch(`/api/image-generator/jobs?${params}`)
      .then(res => res.json())
      .then(data => { setRecentJobs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    return () => { uploadsRef.current.forEach(upload => URL.revokeObjectURL(upload.previewUrl)) }
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
  }, [activeJob])

  function setPrimaryUpload(uploadId: string) {
    setUploads(current => current.map(upload => ({ ...upload, isPrimary: upload.id === uploadId })))
  }

  function validateFiles(files: File[]): string | null {
    if (uploads.length + files.length > MAX_ECOMMERCE_UPLOADS) return `Upload up to ${MAX_ECOMMERCE_UPLOADS} images per job.`
    for (const file of files) {
      if (!isAcceptedEcommerceMimeType(file.type)) return `Unsupported file type. Use ${ACCEPTED_ECOMMERCE_MIME_TYPES.join(', ')}.`
      if (file.size > MAX_ECOMMERCE_UPLOAD_BYTES) return `Each image must be ${getReadableFileSize(MAX_ECOMMERCE_UPLOAD_BYTES)} or smaller.`
    }
    return null
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList)
    const validationError = validateFiles(files)
    if (validationError) { setErrorMessage(validationError); return }
    setErrorMessage(null)
    setUploads(current => {
      const next = [...current]
      for (const file of files) {
        next.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), isPrimary: next.length === 0 })
      }
      if (mode === 'multi-angle-product' && !next.some(upload => upload.isPrimary) && next[0]) next[0].isPrimary = true
      return next
    })
  }

  function removeUpload(uploadId: string) {
    setUploads(current => {
      const uploadToRemove = current.find(upload => upload.id === uploadId)
      if (uploadToRemove) URL.revokeObjectURL(uploadToRemove.previewUrl)
      const next = current.filter(upload => upload.id !== uploadId)
      if (mode === 'multi-angle-product' && next.length > 0 && !next.some(upload => upload.isPrimary)) next[0] = { ...next[0], isPrimary: true }
      return next
    })
  }

  function handleModeChange(nextMode: EcommerceGenerationMode) {
    setMode(nextMode)
    setErrorMessage(null)
    if (nextMode === 'multi-angle-product') {
      setUploads(current => {
        if (current.length === 0 || current.some(upload => upload.isPrimary)) return current
        return current.map((upload, index) => ({ ...upload, isPrimary: index === 0 }))
      })
    }
  }

  async function uploadSourceImages(): Promise<PersistedUpload[]> {
    const formData = new FormData()
    uploads.forEach(upload => { formData.append('files', upload.file); formData.append('clientIds', upload.id) })
    const uploadRes = await fetch('/api/image-generator/ecommerce/uploads', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload source images')
    return Array.isArray(uploadData.uploads) ? uploadData.uploads : []
  }

  function buildConfig(persistedUploads: PersistedUpload[]): EcommerceGenerationConfig {
    const uploadsByClientId = new Map(persistedUploads.map(upload => [upload.clientId, upload]))
    const sourceImages = uploads.map(upload => {
      const persisted = uploadsByClientId.get(upload.id)
      if (!persisted) throw new Error(`Uploaded source image missing for ${upload.file.name}`)
      return { id: persisted.id, originalFilename: persisted.originalFilename, storageUrl: persisted.storageUrl, mimeType: persisted.mimeType, sizeBytes: persisted.sizeBytes, isPrimary: upload.isPrimary }
    })

    if (mode === 'multi-angle-product') {
      const primary = sourceImages.find(source => source.isPrimary) || sourceImages[0]
      return {
        mode, prompt: prompt.trim(), imageTypes: Array.from(selectedTypes),
        inputs: [{ id: crypto.randomUUID(), label: primary ? getBaseName(primary.originalFilename) : 'Uploaded product', primarySourceId: primary?.id || sourceImages[0]?.id || crypto.randomUUID(), sources: sourceImages }],
      }
    }

    return {
      mode, prompt: prompt.trim(), imageTypes: Array.from(selectedTypes),
      inputs: sourceImages.map(source => ({ id: crypto.randomUUID(), label: getBaseName(source.originalFilename), primarySourceId: source.id, sources: [{ ...source, isPrimary: true }] })),
    }
  }

  async function handleGenerate() {
    if (uploads.length === 0) { setErrorMessage('Upload at least one source image.'); return }
    if (selectedTypes.size === 0) { setErrorMessage('Select at least one output type.'); return }
    if (!prompt.trim()) { setErrorMessage('Add a prompt for Replicate to follow.'); return }
    if (mode === 'multi-angle-product' && !uploads.some(upload => upload.isPrimary)) { setErrorMessage('Choose a primary image for the multi-angle product set.'); return }

    setGenerating(true)
    setErrorMessage(null)
    try {
      const persistedUploads = await uploadSourceImages()
      const config = buildConfig(persistedUploads)
      const createRes = await fetch('/api/image-generator/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'ecommerce', productIds: config.inputs.map(input => input.id), config }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create ecommerce job')
      setActiveJob(createData.job)
      await fetch('/api/image-generator/process?jobType=ecommerce', { method: 'POST' })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start generation')
    } finally {
      setGenerating(false)
    }
  }

  const totalImages = getEcommerceTotalImages({
    mode, prompt, imageTypes: Array.from(selectedTypes),
    inputs: mode === 'multi-angle-product'
      ? (uploads.length > 0 ? [{ id: 'preview', label: 'Uploaded product', primarySourceId: 'preview', sources: [] }] : [])
      : uploads.map(upload => ({ id: upload.id, label: upload.file.name, primarySourceId: upload.id, sources: [] })),
  })

  const primaryUploadId = uploads.find(upload => upload.isPrimary)?.id

  return (
    <div>
      <Header title="Ecommerce Images" description="Upload product photos, add a Replicate prompt, and generate print-room ready ecommerce imagery." />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Source Images</h2>
                <p className="text-sm text-muted-foreground">Upload up to {MAX_ECOMMERCE_UPLOADS} JPG, PNG, or WebP images.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={mode === 'separate-products' ? 'default' : 'outline'} onClick={() => handleModeChange('separate-products')}>Separate products</Button>
                <Button type="button" variant={mode === 'multi-angle-product' ? 'default' : 'outline'} onClick={() => handleModeChange('multi-angle-product')}>Multi-angle product</Button>
              </div>
            </div>

            <button
              type="button"
              className={`mt-6 flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${isDragging ? 'border-[hsl(var(--pr-blue))] bg-[hsl(var(--pr-blue))]/5' : 'border-border bg-muted/40 hover:bg-gray-50'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={event => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files) }}
            >
              <p className="text-base font-medium">Drop product images here</p>
              <p className="mt-2 text-sm text-muted-foreground">or click to browse files from your computer</p>
              <p className="mt-4 text-xs text-muted-foreground">Best results come from clear, well-lit product photos.</p>
            </button>

            <input ref={inputRef} type="file" accept={ACCEPTED_ECOMMERCE_MIME_TYPES.join(',')} multiple className="hidden" title="Upload product images" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />

            {uploads.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {uploads.map(upload => (
                  <Card key={upload.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={upload.previewUrl} alt={upload.file.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{upload.file.name}</p>
                          <p className="text-xs text-muted-foreground">{getReadableFileSize(upload.file.size)}</p>
                        </div>
                        {upload.isPrimary && mode === 'multi-angle-product' && <Badge>Primary</Badge>}
                      </div>
                      <div className="flex gap-2">
                        {mode === 'multi-angle-product' && (
                          <Button type="button" size="sm" variant={primaryUploadId === upload.id ? 'default' : 'outline'} onClick={() => setPrimaryUpload(upload.id)} className="flex-1">
                            {primaryUploadId === upload.id ? 'Primary' : 'Set primary'}
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeUpload(upload.id)} className="flex-1">Remove</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Prompt</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell Replicate how to style or adapt the uploaded product for The Print Room.</p>
            <Textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Example: Create a premium hero image with soft studio lighting, preserve the garment exactly, and make it suitable for a print-room campaign landing page." className="mt-4" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Output Types</h3>
            <div className="space-y-3">
              {AVAILABLE_TYPES.map(type => (
                <label key={type.value} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={selectedTypes.has(type.value)} onChange={event => { const next = new Set(selectedTypes); if (event.target.checked) next.add(type.value); else next.delete(type.value); setSelectedTypes(next) }} className="mt-0.5 h-4 w-4 rounded border-input accent-[rgb(var(--color-brand-blue))]" />
                  <div><span className="font-medium">{type.label}</span><p className="text-xs text-muted-foreground">{type.description}</p></div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Workflow</span><Badge variant="info">{mode === 'multi-angle-product' ? 'Multi-angle product' : 'Separate products'}</Badge></div>
            <div className="mt-3 flex items-center justify-between"><span className="text-muted-foreground">Uploads</span><span className="font-medium">{uploads.length}</span></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Output types</span><span className="font-medium">{selectedTypes.size}</span></div>
          </Card>

          <CostEstimator totalImages={totalImages} includeBackgroundRemoval={selectedTypes.has('white-background')} />

          {errorMessage && <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage}</Card>}

          <Button onClick={handleGenerate} disabled={uploads.length === 0 || selectedTypes.size === 0 || !prompt.trim() || generating} className="w-full" size="lg">
            {generating ? 'Uploading and starting...' : `Generate ${totalImages} Images`}
          </Button>

          {activeJob && <JobProgress job={activeJob} />}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Recent Ecommerce Jobs</h2>
        {loading ? <p className="text-muted-foreground">Loading recent jobs...</p> : <JobList jobs={recentJobs} basePath="/image-generator/ecommerce" />}
      </div>
    </div>
  )
}
