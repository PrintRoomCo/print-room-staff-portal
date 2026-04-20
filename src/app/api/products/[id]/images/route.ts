import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'

const ALLOWED_VIEWS = ['front', 'back', 'side', 'detail'] as const
type View = (typeof ALLOWED_VIEWS)[number]

function isView(v: unknown): v is View {
  return typeof v === 'string' && (ALLOWED_VIEWS as readonly string[]).includes(v)
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  const { data, error } = await access.admin
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('position')
  if (error) return dbErrorResponse(error, 'Failed to load images.')
  return NextResponse.json({ images: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error
  const { id } = await params
  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: { file_url?: string; view?: string; alt_text?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const fileUrl = (body.file_url || '').trim()
  if (!fileUrl) return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 })
  if (!isHttpUrl(fileUrl)) return NextResponse.json({ error: 'Image URL must be http(s).' }, { status: 400 })

  const view = isView(body.view) ? body.view : null
  const altText = body.alt_text ? String(body.alt_text).trim() || null : null

  const { data: maxRow } = await access.admin
    .from('product_images')
    .select('position')
    .eq('product_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = maxRow && maxRow.length > 0 ? (maxRow[0].position || 0) + 1 : 0

  const { data, error } = await access.admin
    .from('product_images')
    .insert({
      product_id: id,
      file_url: fileUrl,
      view,
      alt_text: altText,
      position: nextPosition,
      image_type: 'product',
    })
    .select('*')
    .single()
  if (error || !data) return dbErrorResponse(error, 'Failed to add image.')
  return NextResponse.json({ image: data }, { status: 201 })
}
