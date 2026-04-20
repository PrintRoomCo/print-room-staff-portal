import { GARMENT_FAMILIES, isGarmentFamily, type GarmentFamily } from './garment-families'
import { sanitiseTagArray } from './tag-catalog'

const NUMERIC_FIELDS = ['base_cost', 'markup_pct', 'decoration_price'] as const
const INTEGER_FIELDS = ['moq', 'lead_time_days'] as const
type NumericField = (typeof NUMERIC_FIELDS)[number]
type IntegerField = (typeof INTEGER_FIELDS)[number]

export interface ProductCreatePayload {
  name: string
  brand_id: string
  category_id: string
  sku: string | null
  supplier_code: string | null
  code: string | null
  description: string | null
  garment_family: GarmentFamily | null
  industry: string[] | null
  default_sizes: string[] | null
  tags: string[]
  base_cost: number | null
  markup_pct: number
  decoration_eligible: boolean
  decoration_price: number
  specs: unknown
  safety_standard: string | null
  moq: number
  lead_time_days: number
  sizing_type: string
  supports_labels: boolean
  is_hero: boolean
  is_active: boolean
}

export interface ValidationResult<T> {
  ok: true
  value: T
}
export interface ValidationFailure {
  ok: false
  errors: Record<string, string>
}

function trimOrNull(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const t = input.trim()
  return t.length === 0 ? null : t
}

function parseCommaList(input: unknown): string[] | null {
  if (Array.isArray(input)) {
    const cleaned = input
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => v.length > 0)
    return cleaned.length === 0 ? null : cleaned
  }
  if (typeof input === 'string') {
    const cleaned = input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    return cleaned.length === 0 ? null : cleaned
  }
  return null
}

function parseNumeric(input: unknown, fallback: number | null): number | null {
  if (input === null || input === undefined || input === '') return fallback
  const n = typeof input === 'number' ? input : parseFloat(String(input))
  return Number.isFinite(n) ? n : fallback
}

function parseInteger(input: unknown, fallback: number): number {
  if (input === null || input === undefined || input === '') return fallback
  const n = typeof input === 'number' ? input : parseInt(String(input), 10)
  return Number.isFinite(n) ? n : fallback
}

function parseSpecs(input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null }
  if (typeof input === 'object') return { ok: true, value: input }
  if (typeof input !== 'string') return { ok: false, error: 'Specs must be JSON.' }
  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false, error: 'Specs must be valid JSON.' }
  }
}

function normaliseCommonFields(
  body: Record<string, unknown>
): { errors: Record<string, string>; partial: Partial<ProductCreatePayload> } {
  const errors: Record<string, string> = {}
  const partial: Partial<ProductCreatePayload> = {}

  const name = trimOrNull(body.name)
  if (!name) errors.name = 'Name is required.'
  else partial.name = name

  const brandId = trimOrNull(body.brand_id)
  if (!brandId) errors.brand_id = 'Brand is required.'
  else partial.brand_id = brandId

  const categoryId = trimOrNull(body.category_id)
  if (!categoryId) errors.category_id = 'Category is required.'
  else partial.category_id = categoryId

  partial.sku = trimOrNull(body.sku)
  partial.supplier_code = trimOrNull(body.supplier_code)
  partial.code = trimOrNull(body.code)
  partial.description = trimOrNull(body.description)
  partial.safety_standard = trimOrNull(body.safety_standard)

  const garmentRaw = trimOrNull(body.garment_family)
  if (garmentRaw && !isGarmentFamily(garmentRaw)) {
    errors.garment_family = `Must be one of: ${GARMENT_FAMILIES.join(', ')}.`
  } else {
    partial.garment_family = garmentRaw as GarmentFamily | null
  }

  partial.industry = parseCommaList(body.industry)
  partial.default_sizes = parseCommaList(body.default_sizes)
  partial.tags = sanitiseTagArray(body.tags)

  partial.base_cost = parseNumeric(body.base_cost, null)
  partial.markup_pct = parseNumeric(body.markup_pct, 0) ?? 0
  partial.decoration_price = parseNumeric(body.decoration_price, 0) ?? 0
  partial.decoration_eligible = body.decoration_eligible === true || body.decoration_eligible === 'on'
  partial.supports_labels = body.supports_labels === true || body.supports_labels === 'on'
  partial.is_hero = body.is_hero === true || body.is_hero === 'on'
  partial.is_active = body.is_active === true || body.is_active === 'on'

  partial.moq = parseInteger(body.moq, 24)
  partial.lead_time_days = parseInteger(body.lead_time_days, 14)
  partial.sizing_type = trimOrNull(body.sizing_type) || 'multi_size'

  const specs = parseSpecs(body.specs)
  if (!specs.ok) errors.specs = specs.error
  else partial.specs = specs.value

  return { errors, partial }
}

export function normaliseCreate(
  body: unknown
): ValidationResult<ProductCreatePayload> | ValidationFailure {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _root: 'Body must be an object.' } }
  }
  const { errors, partial } = normaliseCommonFields(body as Record<string, unknown>)
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  if (!('is_active' in (body as Record<string, unknown>))) partial.is_active = false
  return { ok: true, value: partial as ProductCreatePayload }
}

export function normaliseUpdate(
  body: unknown
): ValidationResult<Partial<ProductCreatePayload>> | ValidationFailure {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _root: 'Body must be an object.' } }
  }
  const { errors, partial } = normaliseCommonFields(body as Record<string, unknown>)
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: partial }
}

export { NUMERIC_FIELDS, INTEGER_FIELDS }
export type { NumericField, IntegerField }
