import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireDesignerStaffAccess } from '@/lib/designer/server'
import type { AutoSwatch, AutoSwatchResponse } from '@/types/designer'

// Curated palette per spec §6.2. Labels match the staff portal's existing
// swatch vocabulary; duplicates (e.g. royal/royal_blue) intentionally
// kept so multiple synonyms can survive the dedup step.
const PALETTE: ReadonlyArray<{ label: string; hex: string }> = [
  { label: 'black',         hex: '#000000' },
  { label: 'white',         hex: '#ffffff' },
  { label: 'navy',          hex: '#0a1f3d' },
  { label: 'red',           hex: '#c1272d' },
  { label: 'royal',         hex: '#1f4ea1' },
  { label: 'royal_blue',    hex: '#1f4ea1' },
  { label: 'forest',        hex: '#1d4429' },
  { label: 'forest_green',  hex: '#1d4429' },
  { label: 'heather',       hex: '#9aa0a6' },
  { label: 'heather_grey',  hex: '#9aa0a6' },
  { label: 'charcoal',      hex: '#36454f' },
  { label: 'bottle_green',  hex: '#0e6b3a' },
  { label: 'burgundy',      hex: '#7b1f30' },
  { label: 'cream',         hex: '#f3e8d2' },
  { label: 'khaki',         hex: '#a09060' },
  { label: 'tan',           hex: '#c8a877' },
  { label: 'pink',          hex: '#f4a8b8' },
  { label: 'purple',        hex: '#5e3a87' },
  { label: 'orange',        hex: '#e26b1f' },
  { label: 'yellow',        hex: '#f2c233' },
]

function rgbDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const x = parseInt(hex.slice(1), 16)
  return { r: (x >> 16) & 255, g: (x >> 8) & 255, b: x & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function nearestPaletteEntry(rgb: { r: number; g: number; b: number }): { label: string; hex: string } {
  return PALETTE.reduce((best, e) =>
    rgbDistance(rgb, hexToRgb(e.hex)) < rgbDistance(rgb, hexToRgb(best.hex)) ? e : best,
  )
}

function isNearWhiteOrBlack(rgb: { r: number; g: number; b: number }): boolean {
  const v = (rgb.r + rgb.g + rgb.b) / 3
  return v < 18 || v > 240
}

export async function POST(req: NextRequest) {
  const access = await requireDesignerStaffAccess()
  if ('error' in access) return access.error

  let body: { image_url?: string }
  try {
    body = (await req.json()) as { image_url?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const imageUrl = body.image_url?.trim()
  if (!imageUrl) {
    return NextResponse.json({ error: 'image_url required' }, { status: 400 })
  }

  let buf: Buffer
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) {
      return NextResponse.json({ error: `Image fetch failed: ${res.status}` }, { status: 400 })
    }
    buf = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    return NextResponse.json(
      { error: `Image fetch threw: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  // Pragmatic k≈5 via 3-bit-per-channel binning. If real-world output proves
  // poor we can swap for the `image-q` library — but only after Phase 2 demo.
  let rawData: Buffer
  let info: sharp.OutputInfo
  try {
    const out = await sharp(buf).resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
    rawData = out.data
    info = out.info
  } catch (err) {
    return NextResponse.json(
      { error: `Sharp decode failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const counts = new Map<string, number>()
  const channels = info.channels // 3 (RGB) or 4 (RGBA)
  for (let i = 0; i < rawData.length; i += channels) {
    // 3-bit binning: collapse 256 levels into 8 buckets per channel
    const r = (rawData[i] >> 5) << 5
    const g = (rawData[i + 1] >> 5) << 5
    const b = (rawData[i + 2] >> 5) << 5
    const hex = rgbToHex(r, g, b)
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const candidates = sorted
    .map(([hex]) => hexToRgb(hex))
    .filter((rgb) => !isNearWhiteOrBlack(rgb))
    .slice(0, 12)
    .map(nearestPaletteEntry)

  // Dedup by label, cap at 5
  const dedup: AutoSwatch[] = []
  for (const m of candidates) {
    if (dedup.length >= 5) break
    if (!dedup.find((d) => d.label === m.label)) dedup.push(m)
  }

  const response: AutoSwatchResponse = { swatches: dedup }
  return NextResponse.json(response)
}
