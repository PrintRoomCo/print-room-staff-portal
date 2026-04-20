/**
 * Ported verbatim from middleware-pr/routes/products.js.
 * 16 entries; alphabetical except where the original wasn't.
 */
export const GARMENT_FAMILIES = [
  'accessories',
  'belt',
  'corporate',
  'crew',
  'headwear',
  'healthcare',
  'hoodie',
  'jacket',
  'pants',
  'polo',
  'scrubs',
  'shirt',
  'shorts',
  'tee',
  'trades',
  'vest',
] as const

export type GarmentFamily = (typeof GARMENT_FAMILIES)[number]

const FAMILY_SET: ReadonlySet<string> = new Set(GARMENT_FAMILIES)

export function isGarmentFamily(value: unknown): value is GarmentFamily {
  return typeof value === 'string' && FAMILY_SET.has(value)
}
