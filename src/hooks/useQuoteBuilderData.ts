'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  Brand,
  Decoration,
  Extra,
  Finish,
  Location,
  MtoProduct,
  Multiplier,
  PriceTier,
  Product,
  QuoteBuilderReferenceData,
  QuoteBuilderStaffOption,
  Template,
} from '@/lib/quote-builder/types'

interface QuoteBuilderDataState extends QuoteBuilderReferenceData {
  loading: boolean
  errors: string[]
  refresh: () => Promise<void>
}

const EMPTY_REFERENCE_DATA: QuoteBuilderReferenceData = {
  brands: [],
  products: [],
  mtoProducts: [],
  decorations: [],
  finishes: [],
  extras: [],
  multipliers: [],
  priceTiers: [],
  locations: [],
  templates: [],
  staffUsers: [],
}

async function fetchCollection<T>(url: string, key: string) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`${key} request failed with status ${response.status}`)
  }

  const payload = await response.json()

  if (Array.isArray(payload)) {
    return payload as T
  }

  if (Array.isArray(payload?.[key])) {
    return payload[key] as T
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T
  }

  return payload as T
}

export function useQuoteBuilderData(): QuoteBuilderDataState {
  const [data, setData] = useState<QuoteBuilderReferenceData>(EMPTY_REFERENCE_DATA)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    const nextErrors: string[] = []

    const [
      brandsResult,
      productsResult,
      mtoProductsResult,
      decorationsResult,
      finishesResult,
      extrasResult,
      multipliersResult,
      priceTiersResult,
      locationsResult,
      templatesResult,
      staffUsersResult,
    ] = await Promise.allSettled([
      fetchCollection<Brand[]>('/api/quote-builder/brands', 'brands'),
      fetchCollection<Product[]>('/api/quote-builder/products', 'products'),
      fetchCollection<MtoProduct[]>('/api/quote-builder/mto-products', 'mtoProducts'),
      fetchCollection<Decoration[]>('/api/quote-builder/decorations', 'decorations'),
      fetchCollection<Finish[]>('/api/quote-builder/finishes', 'finishes'),
      fetchCollection<Extra[]>('/api/quote-builder/extras', 'extras'),
      fetchCollection<Multiplier[]>('/api/quote-builder/multipliers', 'multipliers'),
      fetchCollection<PriceTier[]>('/api/quote-builder/price-tiers', 'priceTiers'),
      fetchCollection<Location[]>('/api/quote-builder/locations', 'locations'),
      fetchCollection<Template[]>('/api/quote-builder/templates', 'templates'),
      fetchCollection<QuoteBuilderStaffOption[]>('/api/quote-builder/staff', 'staff'),
    ])

    function getValue<T>(result: PromiseSettledResult<T>, fallback: T) {
      if (result.status === 'fulfilled') {
        return result.value
      }

      nextErrors.push(result.reason instanceof Error ? result.reason.message : 'Unknown data loading error')
      return fallback
    }

    setData({
      brands: getValue(brandsResult, []),
      products: getValue(productsResult, []),
      mtoProducts: getValue(mtoProductsResult, []),
      decorations: getValue(decorationsResult, []),
      finishes: getValue(finishesResult, []),
      extras: getValue(extrasResult, []),
      multipliers: getValue(multipliersResult, []),
      priceTiers: getValue(priceTiersResult, []),
      locations: getValue(locationsResult, []),
      templates: getValue(templatesResult, []),
      staffUsers: getValue(staffUsersResult, []),
    })
    setErrors(nextErrors)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    ...data,
    loading,
    errors,
    refresh,
  }
}
