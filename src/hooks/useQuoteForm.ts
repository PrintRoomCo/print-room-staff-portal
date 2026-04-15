'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  MtoProduct,
  Product,
  QuoteDecoration,
  QuoteDraft,
  QuoteExtra,
  QuoteFinish,
  QuoteItem,
  QuoteValidationIssue,
  QuoteValidationState,
  QuoteItemSource,
} from '@/lib/quote-builder/types'
import { DEFAULT_PRICE_TIER_ID } from '@/lib/quote-builder/types'

interface UseQuoteFormOptions {
  initialAccountManager?: string
}

type ProductLike = Product | MtoProduct

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createEmptyQuoteExtra(category: 'decoration' | 'order' = 'order'): QuoteExtra {
  return {
    id: createId('extra'),
    name: '',
    price: '',
    category,
    pricingStructure: category === 'order' ? 'order' : 'per_unit',
    appliesTo: category === 'order' ? 'order' : 'decoration',
  }
}

export function createEmptyQuoteDecoration(): QuoteDecoration {
  return {
    id: createId('decoration'),
    decorationType: '',
    decorationDetail: '',
    location: '',
    extras: [],
  }
}

export function createEmptyQuoteFinish(): QuoteFinish {
  return {
    id: createId('finish'),
    finishType: '',
  }
}

export function createEmptyQuoteDraft(initialAccountManager = ''): QuoteDraft {
  const today = new Date()
  return {
    quoteReference: '',
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    customerPhone: '',
    accountManager: initialAccountManager,
    inHandDate: '',
    expiryDate: formatDateInput(addDays(today, 14)),
    priceTier: DEFAULT_PRICE_TIER_ID,
    templateId: '',
    customDiscount: null,
    status: 'created',
    items: [],
    orderExtras: [],
    notes: '',
    includeGst: false,
    showTotal: true,
  }
}

function createQuoteItemFromProduct(
  product: ProductLike,
  source: QuoteItemSource,
  options?: { quantity?: number; designGroupName?: string; productType?: string | null }
): QuoteItem {
  return {
    id: createId('item'),
    source,
    productId: product.id,
    sku: product.sku,
    brand: product.brand,
    name: product.name,
    category: product.category,
    sourcingType: product.sourcing_type,
    sourcing: 'sourcing' in product ? product.sourcing : null,
    productType: options?.productType || product.category || '',
    quantity: options?.quantity ?? ('min_qty' in product ? Math.max(product.min_qty || 24, 24) : 24),
    minQty: 'min_qty' in product ? product.min_qty : 24,
    maxQty: 'max_qty' in product ? product.max_qty : null,
    baseCost: product.base_cost,
    imageUrl: product.image_url,
    productUrl: product.product_url,
    designGroupName: options?.designGroupName || '',
    notes: product.notes,
    decorations: [],
    finishes: [],
    extras: [],
  }
}

function sanitizeText(value: string | undefined | null) {
  return (value || '').trim()
}

function sanitizeExtra(extra: QuoteExtra) {
  return {
    ...extra,
    name: sanitizeText(extra.name),
    price: sanitizeText(extra.price),
  }
}

function sanitizeDecoration(decoration: QuoteDecoration) {
  return {
    ...decoration,
    decorationType: sanitizeText(decoration.decorationType),
    decorationDetail: sanitizeText(decoration.decorationDetail),
    location: sanitizeText(decoration.location),
    extras: decoration.extras
      .map(sanitizeExtra)
      .filter((extra) => extra.name || extra.price),
  }
}

function sanitizeFinish(finish: QuoteFinish) {
  return {
    ...finish,
    finishType: sanitizeText(finish.finishType),
  }
}

function sanitizeItem(item: QuoteItem) {
  return {
    ...item,
    brand: sanitizeText(item.brand),
    name: sanitizeText(item.name),
    category: sanitizeText(item.category),
    sourcingType: sanitizeText(item.sourcingType),
    productType: sanitizeText(item.productType),
    designGroupName: sanitizeText(item.designGroupName),
    notes: sanitizeText(item.notes),
    decorations: item.decorations
      .map(sanitizeDecoration)
      .filter((decoration) => decoration.decorationType || decoration.decorationDetail || decoration.location || decoration.extras.length > 0),
    finishes: item.finishes
      .map(sanitizeFinish)
      .filter((finish) => finish.finishType),
    extras: item.extras
      .map(sanitizeExtra)
      .filter((extra) => extra.name || extra.price),
  }
}

function getItemIssues(item: QuoteItem) {
  const issues: QuoteValidationIssue[] = []
  if (!sanitizeText(item.name)) {
    issues.push({ field: 'name', message: 'Item name is required.' })
  }
  if (!sanitizeText(item.sourcingType)) {
    issues.push({ field: 'sourcingType', message: 'Sourcing type is required.' })
  }
  if (item.quantity < Math.max(item.minQty || 24, 1)) {
    issues.push({ field: 'quantity', message: `Quantity must be at least ${Math.max(item.minQty || 24, 1)}.` })
  }
  if (item.baseCost < 0) {
    issues.push({ field: 'baseCost', message: 'Base cost cannot be negative.' })
  }

  item.decorations.forEach((decoration, index) => {
    if (!sanitizeText(decoration.decorationType) || !sanitizeText(decoration.decorationDetail) || !sanitizeText(decoration.location)) {
      issues.push({ field: `decorations.${index}`, message: 'Each decoration needs a type, detail, and location.' })
    }
  })

  item.finishes.forEach((finish, index) => {
    if (!sanitizeText(finish.finishType)) {
      issues.push({ field: `finishes.${index}`, message: 'Each finish needs a finish type.' })
    }
  })

  item.extras.forEach((extra, index) => {
    if (!sanitizeText(extra.name) || !sanitizeText(extra.price)) {
      issues.push({ field: `extras.${index}`, message: 'Each item extra needs a name and price.' })
    }
  })

  return issues
}

function validateQuoteDraft(draft: QuoteDraft): QuoteValidationState {
  const issues: QuoteValidationIssue[] = []
  const itemIssues: Record<string, QuoteValidationIssue[]> = {}

  if (!sanitizeText(draft.customerName)) {
    issues.push({ field: 'customerName', message: 'Customer name is required.' })
  }
  if (!sanitizeText(draft.customerEmail)) {
    issues.push({ field: 'customerEmail', message: 'Customer email is required.' })
  }
  if (!sanitizeText(draft.accountManager)) {
    issues.push({ field: 'accountManager', message: 'Account manager is required.' })
  }
  if (!sanitizeText(draft.expiryDate)) {
    issues.push({ field: 'expiryDate', message: 'Expiry date is required.' })
  }
  if (!sanitizeText(draft.priceTier)) {
    issues.push({ field: 'priceTier', message: 'Price tier is required.' })
  }
  if (draft.items.length === 0) {
    issues.push({ field: 'items', message: 'Add at least one product before saving.' })
  }

  for (const item of draft.items) {
    itemIssues[item.id] = getItemIssues(item)
  }

  return {
    isReady: issues.length === 0 && Object.values(itemIssues).every((itemIssueList) => itemIssueList.length === 0),
    issues,
    itemIssues,
  }
}

function mapApiQuoteToDraft(value: Record<string, unknown>, initialAccountManager?: string): QuoteDraft {
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    quoteReference: typeof value.quoteReference === 'string'
      ? value.quoteReference
      : typeof value.quote_reference === 'string'
        ? value.quote_reference
        : '',
    customerName: typeof value.customerName === 'string'
      ? value.customerName
      : typeof value.customer_name === 'string'
        ? value.customer_name
        : '',
    customerEmail: typeof value.customerEmail === 'string'
      ? value.customerEmail
      : typeof value.customer_email === 'string'
        ? value.customer_email
        : '',
    customerCompany: typeof value.customerCompany === 'string'
      ? value.customerCompany
      : typeof value.customer_company === 'string'
        ? value.customer_company
        : '',
    customerPhone: typeof value.customerPhone === 'string'
      ? value.customerPhone
      : typeof value.customer_phone === 'string'
        ? value.customer_phone
        : '',
    accountManager: typeof value.accountManager === 'string'
      ? value.accountManager
      : typeof value.account_manager === 'string'
        ? value.account_manager
        : initialAccountManager || '',
    inHandDate: typeof value.inHandDate === 'string'
      ? value.inHandDate
      : typeof value.in_hand_date === 'string'
        ? value.in_hand_date
        : '',
    expiryDate: typeof value.expiryDate === 'string'
      ? value.expiryDate
      : typeof value.expiry_date === 'string'
        ? value.expiry_date
        : '',
    priceTier: typeof value.priceTier === 'string'
      ? value.priceTier
      : typeof value.price_tier === 'string'
        ? value.price_tier
        : DEFAULT_PRICE_TIER_ID,
    templateId: typeof value.templateId === 'string'
      ? value.templateId
      : typeof value.template_id === 'string'
        ? value.template_id
        : '',
    customDiscount: typeof value.customDiscount === 'number'
      ? value.customDiscount
      : typeof value.custom_discount === 'number'
        ? value.custom_discount
        : null,
    status: typeof value.status === 'string' ? value.status as QuoteDraft['status'] : 'created',
    items: Array.isArray(value.items) ? value.items as QuoteItem[] : [],
    orderExtras: Array.isArray(value.orderExtras)
      ? value.orderExtras as QuoteExtra[]
      : Array.isArray(value.order_extras)
        ? value.order_extras as QuoteExtra[]
        : [],
    notes: typeof value.notes === 'string' ? value.notes : '',
    includeGst: typeof value.includeGst === 'boolean'
      ? value.includeGst
      : typeof value.include_gst === 'boolean'
        ? value.include_gst
        : false,
    showTotal: typeof value.showTotal === 'boolean'
      ? value.showTotal
      : typeof value.show_total === 'boolean'
        ? value.show_total
        : true,
    subtotal: typeof value.subtotal === 'number' ? value.subtotal : null,
    total: typeof value.total === 'number' ? value.total : null,
    createdAt: typeof value.createdAt === 'string'
      ? value.createdAt
      : typeof value.created_at === 'string'
        ? value.created_at
        : undefined,
    updatedAt: typeof value.updatedAt === 'string'
      ? value.updatedAt
      : typeof value.updated_at === 'string'
        ? value.updated_at
        : undefined,
  }
}

export function useQuoteForm(options: UseQuoteFormOptions = {}) {
  const [draft, setDraft] = useState<QuoteDraft>(() => createEmptyQuoteDraft(options.initialAccountManager))

  useEffect(() => {
    if (!draft.accountManager && options.initialAccountManager) {
      setDraft((current) => ({
        ...current,
        accountManager: options.initialAccountManager || '',
      }))
    }
  }, [draft.accountManager, options.initialAccountManager])

  const validation = validateQuoteDraft(draft)

  const updateField = useCallback(<K extends keyof QuoteDraft>(field: K, value: QuoteDraft[K]) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }, [])

  function patchItem(itemId: string, patch: Partial<QuoteItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
    }))
  }

  function addItemFromProduct(
    product: ProductLike,
    source: QuoteItemSource,
    options?: { quantity?: number; designGroupName?: string; productType?: string | null }
  ) {
    setDraft((current) => ({
      ...current,
      items: [...current.items, createQuoteItemFromProduct(product, source, options)],
    }))
  }

  function addCustomItem(input: {
    name: string
    brand?: string
    category?: string
    sourcingType: string
    productType?: string
    quantity: number
    baseCost: number
    designGroupName?: string
  }) {
    const item: QuoteItem = {
      id: createId('item'),
      source: 'custom',
      name: input.name,
      brand: input.brand || '',
      category: input.category || '',
      sourcingType: input.sourcingType,
      productType: input.productType || '',
      quantity: input.quantity,
      minQty: 24,
      maxQty: null,
      baseCost: input.baseCost,
      designGroupName: input.designGroupName || '',
      decorations: [],
      finishes: [],
      extras: [],
    }

    setDraft((current) => ({
      ...current,
      items: [...current.items, item],
    }))
  }

  function removeItem(itemId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }))
  }

  function duplicateItem(itemId: string) {
    setDraft((current) => {
      const item = current.items.find((candidate) => candidate.id === itemId)
      if (!item) return current
      return {
        ...current,
        items: [
          ...current.items,
          {
            ...item,
            id: createId('item'),
            decorations: item.decorations.map((decoration) => ({
              ...decoration,
              id: createId('decoration'),
              extras: decoration.extras.map((extra) => ({ ...extra, id: createId('extra') })),
            })),
            finishes: item.finishes.map((finish) => ({ ...finish, id: createId('finish') })),
            extras: item.extras.map((extra) => ({ ...extra, id: createId('extra') })),
          },
        ],
      }
    })
  }

  function addDecoration(itemId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, decorations: [...item.decorations, createEmptyQuoteDecoration()] } : item),
    }))
  }

  function patchDecoration(itemId: string, decorationId: string, patch: Partial<QuoteDecoration>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            decorations: item.decorations.map((decoration) => decoration.id === decorationId ? { ...decoration, ...patch } : decoration),
          }),
    }))
  }

  function removeDecoration(itemId: string, decorationId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            decorations: item.decorations.filter((decoration) => decoration.id !== decorationId),
          }),
    }))
  }

  function addDecorationExtra(itemId: string, decorationId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            decorations: item.decorations.map((decoration) => decoration.id !== decorationId
              ? decoration
              : {
                  ...decoration,
                  extras: [...decoration.extras, createEmptyQuoteExtra('decoration')],
                }),
          }),
    }))
  }

  function patchDecorationExtra(itemId: string, decorationId: string, extraId: string, patch: Partial<QuoteExtra>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            decorations: item.decorations.map((decoration) => decoration.id !== decorationId
              ? decoration
              : {
                  ...decoration,
                  extras: decoration.extras.map((extra) => extra.id === extraId ? { ...extra, ...patch } : extra),
                }),
          }),
    }))
  }

  function removeDecorationExtra(itemId: string, decorationId: string, extraId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            decorations: item.decorations.map((decoration) => decoration.id !== decorationId
              ? decoration
              : {
                  ...decoration,
                  extras: decoration.extras.filter((extra) => extra.id !== extraId),
                }),
          }),
    }))
  }

  function addFinish(itemId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, finishes: [...item.finishes, createEmptyQuoteFinish()] } : item),
    }))
  }

  function patchFinish(itemId: string, finishId: string, patch: Partial<QuoteFinish>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            finishes: item.finishes.map((finish) => finish.id === finishId ? { ...finish, ...patch } : finish),
          }),
    }))
  }

  function removeFinish(itemId: string, finishId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            finishes: item.finishes.filter((finish) => finish.id !== finishId),
          }),
    }))
  }

  function addItemExtra(itemId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, extras: [...item.extras, createEmptyQuoteExtra('decoration')] } : item),
    }))
  }

  function patchItemExtra(itemId: string, extraId: string, patch: Partial<QuoteExtra>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            extras: item.extras.map((extra) => extra.id === extraId ? { ...extra, ...patch } : extra),
          }),
    }))
  }

  function removeItemExtra(itemId: string, extraId: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id !== itemId
        ? item
        : {
            ...item,
            extras: item.extras.filter((extra) => extra.id !== extraId),
          }),
    }))
  }

  function addOrderExtra() {
    setDraft((current) => ({
      ...current,
      orderExtras: [...current.orderExtras, createEmptyQuoteExtra('order')],
    }))
  }

  function patchOrderExtra(extraId: string, patch: Partial<QuoteExtra>) {
    setDraft((current) => ({
      ...current,
      orderExtras: current.orderExtras.map((extra) => extra.id === extraId ? { ...extra, ...patch } : extra),
    }))
  }

  function removeOrderExtra(extraId: string) {
    setDraft((current) => ({
      ...current,
      orderExtras: current.orderExtras.filter((extra) => extra.id !== extraId),
    }))
  }

  const replaceDraft = useCallback((nextDraft: QuoteDraft | Record<string, unknown>) => {
    setDraft(mapApiQuoteToDraft(nextDraft as Record<string, unknown>, options.initialAccountManager))
  }, [options.initialAccountManager])

  function resetDraft() {
    setDraft(createEmptyQuoteDraft(options.initialAccountManager))
  }

  function getSanitizedDraft() {
    return {
      ...draft,
      quoteReference: sanitizeText(draft.quoteReference),
      customerName: sanitizeText(draft.customerName),
      customerEmail: sanitizeText(draft.customerEmail),
      customerCompany: sanitizeText(draft.customerCompany),
      customerPhone: sanitizeText(draft.customerPhone),
      accountManager: sanitizeText(draft.accountManager),
      inHandDate: sanitizeText(draft.inHandDate),
      expiryDate: sanitizeText(draft.expiryDate),
      templateId: sanitizeText(draft.templateId),
      notes: draft.notes.trim(),
      items: draft.items.map(sanitizeItem),
      orderExtras: draft.orderExtras.map(sanitizeExtra).filter((extra) => extra.name || extra.price),
    }
  }

  return {
    draft,
    validation,
    updateField,
    patchItem,
    addItemFromProduct,
    addCustomItem,
    removeItem,
    duplicateItem,
    addDecoration,
    patchDecoration,
    removeDecoration,
    addDecorationExtra,
    patchDecorationExtra,
    removeDecorationExtra,
    addFinish,
    patchFinish,
    removeFinish,
    addItemExtra,
    patchItemExtra,
    removeItemExtra,
    addOrderExtra,
    patchOrderExtra,
    removeOrderExtra,
    replaceDraft,
    resetDraft,
    getSanitizedDraft,
  }
}
