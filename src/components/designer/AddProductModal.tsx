'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, Loader2 } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { AutoSwatch } from '@/types/designer'

// PRT (The Print Room Test) — the only seeded org. Inventory rows for new
// designer-created products are scoped here for v1. When the designer flow
// supports multi-org seeding, replace with an org picker (or skip inventory
// rows entirely until catalogue submit).
const DEFAULT_ORG_ID = 'ee155266-200c-4b73-8dbd-be385db3e5b0'

const GARMENT_FAMILIES = [
  { value: 'apparel', label: 'Apparel (tee / hoodie / crew)' },
  { value: 'headwear', label: 'Headwear (cap / hat / beanie)' },
  { value: 'hoodie', label: 'Hoodie' },
] as const

interface BrandOption {
  id: string
  name: string
}
interface CategoryOption {
  id: string
  name: string
}

interface Props {
  onClose: () => void
}

export function AddProductModal({ onClose }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reference data
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])

  // Form state
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [garmentFamily, setGarmentFamily] = useState<(typeof GARMENT_FAMILIES)[number]['value'] | ''>('')
  const [decorationEligible, setDecorationEligible] = useState(true)
  const [notes, setNotes] = useState('')

  // Upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      fetch('/api/brands').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([b, c]) => {
        setBrands((b?.brands ?? []) as BrandOption[])
        setCategories((c?.categories ?? []) as CategoryOption[])
      })
      .catch((err) => setError(`Failed to load brands/categories: ${err}`))
  }, [])

  function handleFileSelect(file: File) {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadImageToBucket(file: File): Promise<string> {
    const sb = getSupabaseBrowser()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `designer/${crypto.randomUUID()}.${ext}`
    const { data, error: upErr } = await sb.storage.from('product-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (upErr || !data) throw new Error(`Upload failed: ${upErr?.message ?? 'unknown'}`)
    const { data: urlData } = sb.storage.from('product-images').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  async function jsonOrThrow<T = unknown>(res: Response, label: string): Promise<T> {
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no body>')
      throw new Error(`${label}: ${res.status} ${txt}`)
    }
    return (await res.json()) as T
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Required-field guard
    if (!name.trim()) return setError('Product name is required.')
    if (!brandId) return setError('Brand is required.')
    if (!categoryId) return setError('Category is required.')
    if (!imageFile && !uploadedImageUrl) return setError('Front-view image is required.')

    setSubmitting(true)
    let productId: string | null = null

    try {
      // 0. Upload image if not already uploaded
      let imageUrl = uploadedImageUrl
      if (!imageUrl && imageFile) {
        setStage('Uploading image…')
        imageUrl = await uploadImageToBucket(imageFile)
        setUploadedImageUrl(imageUrl)
      }

      // 1. Create product
      setStage('Creating product…')
      const created = await jsonOrThrow<{ product: { id: string; name: string } }>(
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            brand_id: brandId,
            category_id: categoryId,
            garment_family: garmentFamily || null,
            decoration_eligible: decorationEligible,
            description: notes.trim() || null,
            is_active: true,
            channels: { b2b: 'active' },
          }),
        }),
        'Create product',
      )
      productId = created.product.id

      // 2. Auto-swatch (server-side Sharp k=5)
      setStage('Extracting colors…')
      const swatchResp = await jsonOrThrow<{ swatches: AutoSwatch[] }>(
        await fetch('/api/designer/products/auto-swatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        }),
        'Auto-swatch',
      )

      // 3. Insert each detected swatch (sequential — small N, simpler error surface)
      setStage(`Adding ${swatchResp.swatches.length} swatches…`)
      for (const s of swatchResp.swatches) {
        await jsonOrThrow(
          await fetch(`/api/products/${productId}/swatches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: s.label, hex: s.hex }),
          }),
          `Add swatch ${s.label}`,
        )
      }

      // 4. Sizes quick-add (adds standard XS–5XL set if missing)
      setStage('Adding standard sizes…')
      await jsonOrThrow(
        await fetch(`/api/products/${productId}/sizes/quick-add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        'Sizes quick-add',
      )

      // 5. Variants bulk (cross-product swatches × sizes; seeds inventory rows for PRT)
      setStage('Generating variants…')
      await jsonOrThrow(
        await fetch(`/api/products/${productId}/variants/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: DEFAULT_ORG_ID }),
        }),
        'Variants bulk',
      )

      // 6. Image attach (front view — required for §9.2 catalog visibility)
      setStage('Attaching front image…')
      await jsonOrThrow(
        await fetch(`/api/products/${productId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: imageUrl, view: 'front' }),
        }),
        'Image attach',
      )

      // 7. B2B channel activation (the existing channel-state endpoint takes
      //    `state: 'active'|'inactive'|'off'`, not is_active boolean)
      // NB: the create endpoint already activated b2b via the channels: { b2b: 'active' }
      //     hint, so this PUT is idempotent / a safety net. Still call it explicitly so
      //     the spec's 7-step contract is fully observable in network traffic.
      setStage('Activating B2B channel…')
      await jsonOrThrow(
        await fetch(`/api/products/${productId}/channels/b2b`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'active' }),
        }),
        'Channel activate',
      )

      // 8. Redirect into the design canvas with a fresh instance id
      setStage('Opening design canvas…')
      const instanceId = crypto.randomUUID()
      router.push(`/designer/design/${productId}/${instanceId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        `${msg}${productId ? `\n\nA product row WAS created (id ${productId}). Delete it manually from /products/${productId} if you want a clean retry.` : ''}`,
      )
      setSubmitting(false)
      setStage('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-gray-900">Add product</h2>
        <p className="mt-1 text-sm text-gray-500">
          Creates a new product, auto-extracts swatches from the image, generates variants, and
          opens the design canvas. PRT inventory rows seeded with stock=0.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Product name <span className="text-red-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pr-blue focus:outline-none focus:ring-2 focus:ring-pr-blue/30"
              placeholder="e.g. Box Hood"
            />
          </div>

          {/* Brand + Category in a row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                Brand <span className="text-red-600">*</span>
              </label>
              <select
                id="brand"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-pr-blue focus:outline-none focus:ring-2 focus:ring-pr-blue/30"
              >
                <option value="">Select…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-pr-blue focus:outline-none focus:ring-2 focus:ring-pr-blue/30"
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Garment family */}
          <div>
            <label htmlFor="garment-family" className="block text-sm font-medium text-gray-700">
              Garment family
            </label>
            <select
              id="garment-family"
              value={garmentFamily}
              onChange={(e) => setGarmentFamily(e.target.value as typeof garmentFamily)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-pr-blue focus:outline-none focus:ring-2 focus:ring-pr-blue/30"
            >
              <option value="">Unspecified</option>
              {GARMENT_FAMILIES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Front-view image <span className="text-red-600">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 flex aspect-[3/2] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-pr-blue hover:bg-pr-blue/5"
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="h-full max-h-48 w-auto rounded object-contain" />
              ) : (
                <>
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">Click to upload (PNG/JPG)</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
              disabled={submitting}
              className="hidden"
            />
          </div>

          {/* Decoration eligible */}
          <div className="flex items-start gap-3">
            <input
              id="decoration-eligible"
              type="checkbox"
              checked={decorationEligible}
              onChange={(e) => setDecorationEligible(e.target.checked)}
              disabled={submitting}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="decoration-eligible" className="text-sm text-gray-700">
              Decoration eligible
              <p className="text-xs text-gray-500">
                Off-by-default in the catalog filter (§9.2). Leave on so this product appears in the
                designer catalog.
              </p>
            </label>
          </div>

          {/* Notes / description */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Description / notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pr-blue focus:outline-none focus:ring-2 focus:ring-pr-blue/30"
              placeholder="Optional"
            />
          </div>

          {/* Error / progress */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-800">{error}</div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-pr-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-pr-blue/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? stage || 'Working…' : 'Create + open canvas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
