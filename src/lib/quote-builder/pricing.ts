import type {
  Decoration,
  Extra,
  Finish,
  ItemPricingBreakdown,
  Multiplier,
  ParsedExtraPrice,
  PriceTier,
  Product,
  MtoProduct,
  QuoteDecoration,
  QuoteDraft,
  QuoteExtra,
  QuoteFinish,
  QuoteItem,
  QuotePricingBreakdown,
  QuoteBuilderReferenceData,
} from '@/lib/quote-builder/types'
import { GST_RATE } from '@/lib/quote-builder/types'

function normalizeString(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeDiscount(value: number | null | undefined) {
  if (value == null) return 0
  if (Math.abs(value) > 1) return value / 100
  return value
}

function isQtyInRange(quantity: number, minQty: number | null | undefined, maxQty: number | null | undefined) {
  const meetsMin = minQty == null || quantity >= minQty
  const meetsMax = maxQty == null || quantity <= maxQty
  return meetsMin && meetsMax
}

function matchesProductType(record: { applicable_product_types?: string[]; not_applicable_product_types?: string[] }, productType?: string | null) {
  const normalizedProductType = normalizeString(productType)
  const applicable = (record.applicable_product_types || []).map(normalizeString).filter(Boolean)
  const notApplicable = (record.not_applicable_product_types || []).map(normalizeString).filter(Boolean)

  if (notApplicable.includes(normalizedProductType)) return false
  if (applicable.length === 0) return true
  return applicable.includes(normalizedProductType)
}

function getBestMatchingDecoration(item: QuoteItem, decoration: QuoteDecoration, decorations: Decoration[]) {
  const candidates = decorations.filter((candidate) => {
    const matchesType = normalizeString(candidate.decoration_type) === normalizeString(decoration.decorationType)
    const matchesDetail = normalizeString(candidate.decoration_detail) === normalizeString(decoration.decorationDetail)
    const matchesSource = !candidate.sourcing_type || normalizeString(candidate.sourcing_type) === normalizeString(item.sourcingType)
    const matchesCategory = !candidate.product_category || normalizeString(candidate.product_category) === normalizeString(item.category)
    return matchesType && matchesDetail && matchesSource && matchesCategory
  })

  return candidates.find((candidate) =>
    isQtyInRange(item.quantity, candidate.min_qty, candidate.max_qty) && matchesProductType(candidate, item.productType)
  ) || candidates[0]
}

function getBestMatchingFinish(item: QuoteItem, finish: QuoteFinish, finishes: Finish[]) {
  const candidates = finishes.filter((candidate) => {
    const matchesType = normalizeString(candidate.finish_type) === normalizeString(finish.finishType)
    const matchesSource = !candidate.sourcing_type || normalizeString(candidate.sourcing_type) === normalizeString(item.sourcingType)
    return matchesType && matchesSource
  })

  return candidates.find((candidate) =>
    isQtyInRange(item.quantity, candidate.min_qty, candidate.max_qty) && matchesProductType(candidate, item.productType)
  ) || candidates[0]
}

function getApplicableExtra(extra: QuoteExtra, item: QuoteItem | null, extras: Extra[]) {
  const candidates = extras.filter((candidate) => {
    const sameSource = extra.sourceId != null ? candidate.id === extra.sourceId : normalizeString(candidate.name) === normalizeString(extra.name)
    if (!sameSource) return false

    if (!item) return true

    const matchesSource = !candidate.sourcing_type || normalizeString(candidate.sourcing_type) === normalizeString(item.sourcingType)
    const matchesAppliesTo = !candidate.applies_to || normalizeString(candidate.applies_to) === normalizeString(extra.appliesTo)
    return matchesSource && matchesAppliesTo && matchesProductType(candidate, item.productType)
  })

  return candidates.find((candidate) => !item || isQtyInRange(item.quantity, candidate.min_qty, candidate.max_qty)) || candidates[0]
}

export function parseExtraPrice(priceString: string): ParsedExtraPrice {
  const trimmed = priceString.trim()
  if (!trimmed) return { type: 'fixed', value: 0 }

  if (trimmed.toLowerCase().startsWith('x')) {
    return { type: 'multiplier', value: normalizeNumber(trimmed.slice(1)) }
  }

  if (trimmed.includes('$')) {
    return { type: 'fixed', value: normalizeNumber(trimmed) }
  }

  return { type: 'lump', value: normalizeNumber(trimmed) }
}

export function getMultiplier(
  sourcingType: string,
  category: string | null | undefined,
  qty: number,
  multipliers: Multiplier[]
) {
  const normalizedSourcing = normalizeString(sourcingType)
  const normalizedCategory = normalizeString(category)

  const candidates = multipliers.filter((candidate) => {
    const sourcingMatch = !candidate.sourcing_type || normalizeString(candidate.sourcing_type) === normalizedSourcing
    const categoryValue = normalizeString(candidate.category)
    const categoryMatch =
      !categoryValue ||
      categoryValue === normalizedCategory ||
      categoryValue === 'all' ||
      categoryValue === 'default'

    return sourcingMatch && categoryMatch && isQtyInRange(qty, candidate.min_qty, candidate.max_qty)
  })

  const ranked = candidates.sort((left, right) => {
    const leftScore = normalizeString(left.category) === normalizedCategory ? 2 : normalizeString(left.category) ? 1 : 0
    const rightScore = normalizeString(right.category) === normalizedCategory ? 2 : normalizeString(right.category) ? 1 : 0
    return rightScore - leftScore
  })

  const match = ranked[0]

  return {
    multiplier: match ? normalizeNumber(match.multiplier) : 1,
    shipping: match ? normalizeNumber(match.shipping) : 0,
  }
}

export function getProductSellingPrice(
  product: Pick<Product, 'base_cost' | 'category' | 'sourcing_type'> | Pick<MtoProduct, 'base_cost' | 'category' | 'sourcing_type'>,
  qty: number,
  multipliers: Multiplier[]
) {
  const { multiplier, shipping } = getMultiplier(product.sourcing_type, product.category, qty, multipliers)
  return normalizeNumber(product.base_cost) * multiplier + shipping
}

export function getDecorationCost(
  decoration: QuoteDecoration,
  qty: number,
  item: QuoteItem,
  decorations: Decoration[],
  extras: Extra[]
) {
  const match = getBestMatchingDecoration(item, decoration, decorations)
  const perUnitPrice = match ? normalizeNumber(match.price) : normalizeNumber(decoration.price)
  const setupFee = match ? normalizeNumber(match.setup_fee) : normalizeNumber(decoration.setupFee)
  const extrasTotal = decoration.extras.reduce((total, extra) => {
    return total + getExtraCost(extra, perUnitPrice, qty, item, extras)
  }, 0)

  return perUnitPrice + setupFee / Math.max(qty, 1) + extrasTotal / Math.max(qty, 1)
}

export function getFinishCost(
  finish: QuoteFinish,
  qty: number,
  item: QuoteItem,
  finishes: Finish[]
) {
  const match = getBestMatchingFinish(item, finish, finishes)
  return match ? normalizeNumber(match.price) : normalizeNumber(finish.price)
}

export function getExtraCost(
  extra: QuoteExtra,
  basePrice: number,
  qty: number,
  item: QuoteItem | null,
  extras: Extra[]
) {
  const match = getApplicableExtra(extra, item, extras)
  const parsed = parseExtraPrice(extra.customAmount != null ? String(extra.customAmount) : extra.price)
  const pricingStructure = normalizeString(extra.pricingStructure || match?.pricing_structure || '')

  if (parsed.type === 'multiplier') {
    const multiplierDelta = Math.max(parsed.value - 1, 0)
    const baseAmount = basePrice * multiplierDelta
    return pricingStructure.includes('order') || parsed.value <= 1 ? baseAmount : baseAmount * qty
  }

  if (pricingStructure.includes('order') || pricingStructure.includes('lump') || parsed.type === 'lump') {
    return parsed.value
  }

  return parsed.value * qty
}

export function calculateItemTotal(item: QuoteItem, referenceData: QuoteBuilderReferenceData): ItemPricingBreakdown {
  const productUnitPrice = getProductSellingPrice(
    {
      base_cost: item.baseCost,
      category: item.category || null,
      sourcing_type: item.sourcingType,
    },
    item.quantity,
    referenceData.multipliers
  )

  const decorationUnitPrice = item.decorations.reduce((total, decoration) => {
    return total + getDecorationCost(decoration, item.quantity, item, referenceData.decorations, referenceData.extras)
  }, 0)

  const finishUnitPrice = item.finishes.reduce((total, finish) => {
    return total + getFinishCost(finish, item.quantity, item, referenceData.finishes)
  }, 0)

  const itemExtrasTotal = item.extras.reduce((total, extra) => {
    return total + getExtraCost(extra, productUnitPrice, item.quantity, item, referenceData.extras)
  }, 0)

  const subtotal = (productUnitPrice + decorationUnitPrice + finishUnitPrice) * item.quantity + itemExtrasTotal
  const unitPrice = productUnitPrice + decorationUnitPrice + finishUnitPrice + itemExtrasTotal / Math.max(item.quantity, 1)

  return {
    productUnitPrice,
    decorationUnitPrice,
    finishUnitPrice,
    itemExtrasTotal,
    subtotal,
    unitPrice,
    breakdown: [
      { label: 'Garment', amount: productUnitPrice * item.quantity, detail: `${item.quantity} units` },
      { label: 'Decorations', amount: decorationUnitPrice * item.quantity },
      { label: 'Finishes', amount: finishUnitPrice * item.quantity },
      { label: 'Item extras', amount: itemExtrasTotal },
    ],
  }
}

export function applyPriceTierDiscount(subtotal: number, tier: PriceTier | undefined, customDiscount: number | null | undefined) {
  const tierDiscount = normalizeDiscount(tier?.discount)
  const manualDiscount = normalizeDiscount(customDiscount)
  const discountRate = Math.max(tierDiscount + manualDiscount, 0)
  const discountAmount = subtotal * discountRate
  return {
    discountRate,
    discountAmount,
    totalAfterDiscount: subtotal - discountAmount,
  }
}

export function calculateQuoteTotal(
  quote: QuoteDraft,
  referenceData: QuoteBuilderReferenceData
): QuotePricingBreakdown {
  const items: Record<string, ItemPricingBreakdown> = {}

  for (const item of quote.items) {
    items[item.id] = calculateItemTotal(item, referenceData)
  }

  const subtotal = Object.values(items).reduce((total, item) => total + item.subtotal, 0)
  const tier = referenceData.priceTiers.find((candidate) => candidate.tier_id === quote.priceTier)
  const { discountRate, discountAmount, totalAfterDiscount } = applyPriceTierDiscount(subtotal, tier, quote.customDiscount)

  const orderExtrasTotal = quote.orderExtras.reduce((total, extra) => {
    return total + getExtraCost(extra, totalAfterDiscount, 1, null, referenceData.extras)
  }, 0)

  const total = totalAfterDiscount + orderExtrasTotal

  return {
    items,
    subtotal,
    discountRate,
    discountAmount,
    orderExtrasTotal,
    total,
    totalInclGst: total * (1 + GST_RATE),
  }
}

export function formatNZD(amount: number) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
