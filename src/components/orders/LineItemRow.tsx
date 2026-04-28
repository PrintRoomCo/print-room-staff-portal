'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface LineState {
  tmpId: string
  productId: string | null
  productName: string
  variantId: string | null
  colorSwatchId: string | null
  sizeId: number | null
  quantity: number
  unitPrice: number
  unitPriceOverride: boolean
  availableQty: number | null
  stockTracked: boolean
}

interface ProductSearchResult {
  id: string
  name: string
  image_url?: string | null
  via_catalogue?: boolean
}

interface VariantRow {
  id: string
  color_swatch_id: string | null
  size_id: number | null
}

interface InventoryVariantRow {
  variant_id: string
  color_swatch_id: string | null
  size_id: number | null
  available_qty: number
  color_label?: string | null
  size_label?: string | null
}

interface LineItemRowProps {
  line: LineState
  index: number
  organizationId: string | null
  onChange: (next: LineState) => void
  onRemove: () => void
}

export function LineItemRow({
  line,
  index,
  organizationId,
  onChange,
  onRemove,
}: LineItemRowProps) {
  const [search, setSearch] = useState(line.productName)
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [invByVariant, setInvByVariant] = useState<
    Record<string, InventoryVariantRow>
  >({})
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Product typeahead debounce.
  useEffect(() => {
    if (!showDropdown || search.length < 2 || line.productId) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: search })
        if (organizationId) params.set('organization_id', organizationId)
        const r = await fetch(`/api/products/search?${params.toString()}`)
        if (r.ok) {
          const json = (await r.json()) as { products?: ProductSearchResult[] }
          setResults(json.products ?? [])
        }
      } catch {
        /* ignore */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search, showDropdown, line.productId])

  // Load variants + inventory when product selected.
  useEffect(() => {
    if (!line.productId) {
      setVariants([])
      setInvByVariant({})
      return
    }
    let cancelled = false
    async function load(productId: string, orgId: string | null) {
      try {
        const variantsReq = fetch(`/api/products/${productId}/variants`)
        const invReq = orgId
          ? fetch(
              `/api/inventory/${orgId}/variants?product_id=${productId}`,
            )
          : null
        const [vRes, iRes] = await Promise.all([
          variantsReq,
          invReq ?? Promise.resolve(null),
        ])
        if (cancelled) return
        if (vRes.ok) {
          const json = (await vRes.json()) as { variants?: VariantRow[] }
          setVariants(json.variants ?? [])
        }
        if (iRes && iRes.ok) {
          const json = (await iRes.json()) as {
            variants?: InventoryVariantRow[]
          }
          const map: Record<string, InventoryVariantRow> = {}
          for (const v of json.variants ?? []) {
            map[v.variant_id] = v
          }
          setInvByVariant(map)
        } else if (!orgId) {
          setInvByVariant({})
        }
      } catch {
        /* ignore */
      }
    }
    load(line.productId, organizationId)
    return () => {
      cancelled = true
    }
  }, [line.productId, organizationId])

  // Debounced unit-price fetch on qty change (if not overridden).
  useEffect(() => {
    if (
      !line.productId ||
      !organizationId ||
      !line.quantity ||
      line.quantity <= 0 ||
      line.unitPriceOverride
    ) {
      return
    }
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current)
    priceTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch('/api/pricing/quote-line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: line.productId,
            organization_id: organizationId,
            quantity: line.quantity,
          }),
        })
        if (!r.ok) return
        const json = (await r.json()) as { unit_price?: number }
        if (typeof json.unit_price === 'number') {
          onChange({
            ...line,
            unitPrice: json.unit_price,
            unitPriceOverride: false,
          })
        }
      } catch {
        /* ignore */
      }
    }, 300)
    return () => {
      if (priceTimerRef.current) clearTimeout(priceTimerRef.current)
    }
    // onChange intentionally omitted to avoid re-fire on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.productId, organizationId, line.quantity, line.unitPriceOverride])

  // Update available qty when variant selection or inventory changes.
  useEffect(() => {
    if (!line.variantId) {
      if (line.availableQty !== null || line.stockTracked) {
        onChange({ ...line, availableQty: null, stockTracked: false })
      }
      return
    }
    const inv = invByVariant[line.variantId]
    const newAvail = inv ? inv.available_qty : null
    const newTracked = !!inv
    if (line.availableQty !== newAvail || line.stockTracked !== newTracked) {
      onChange({
        ...line,
        availableQty: newAvail,
        stockTracked: newTracked,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.variantId, invByVariant])

  function selectProduct(p: ProductSearchResult) {
    setSearch(p.name)
    setShowDropdown(false)
    setResults([])
    onChange({
      ...line,
      productId: p.id,
      productName: p.name,
      variantId: null,
      colorSwatchId: null,
      sizeId: null,
      availableQty: null,
      stockTracked: false,
    })
  }

  function clearProduct() {
    setSearch('')
    setResults([])
    onChange({
      ...line,
      productId: null,
      productName: '',
      variantId: null,
      colorSwatchId: null,
      sizeId: null,
      availableQty: null,
      stockTracked: false,
    })
  }

  // Build color/size option lists from variants with inventory labels where
  // possible, else show IDs.
  const colorOptions = Array.from(
    variants.reduce<Map<string, string>>((m, v) => {
      if (v.color_swatch_id && !m.has(v.color_swatch_id)) {
        const inv = invByVariant[v.id]
        m.set(v.color_swatch_id, inv?.color_label ?? v.color_swatch_id)
      }
      return m
    }, new Map()),
  )

  const sizeOptions = Array.from(
    variants.reduce<Map<number, string>>((m, v) => {
      if (v.size_id != null && !m.has(v.size_id)) {
        const inv = invByVariant[v.id]
        m.set(v.size_id, inv?.size_label ?? String(v.size_id))
      }
      return m
    }, new Map()),
  )

  function pickVariant(colorId: string | null, sizeId: number | null) {
    const match = variants.find(
      (v) =>
        (v.color_swatch_id ?? null) === (colorId ?? null) &&
        (v.size_id ?? null) === (sizeId ?? null),
    )
    onChange({
      ...line,
      colorSwatchId: colorId,
      sizeId,
      variantId: match ? match.id : null,
    })
  }

  const overShortfall =
    line.stockTracked &&
    line.availableQty != null &&
    line.quantity > line.availableQty

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 pt-2 w-6 text-right">
          {index + 1}
        </span>

        {/* Product typeahead */}
        <div className="flex-1 relative">
          {line.productId ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm">
                {line.productName}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearProduct}
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Search product…"
                value={search}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setShowDropdown(true)
                }}
              />
              {showDropdown && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span>{p.name}</span>
                      {p.via_catalogue && (
                        <span className="inline-block bg-indigo-100 text-indigo-800 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          Catalogue
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove line"
        >
          Remove
        </Button>
      </div>

      {line.productId && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_120px_140px] gap-2 items-end pl-8">
          <label className="block text-xs">
            <span className="text-gray-500">Color</span>
            <select
              value={line.colorSwatchId ?? ''}
              onChange={(e) =>
                pickVariant(e.target.value || null, line.sizeId)
              }
              className="mt-1 block w-full rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-gray-400"
            >
              <option value="">—</option>
              {colorOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-gray-500">Size</span>
            <select
              value={line.sizeId == null ? '' : String(line.sizeId)}
              onChange={(e) =>
                pickVariant(
                  line.colorSwatchId,
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="mt-1 block w-full rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-gray-400"
            >
              <option value="">—</option>
              {sizeOptions.map(([id, label]) => (
                <option key={id} value={String(id)}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-gray-500">Qty</span>
            <Input
              type="number"
              min={1}
              value={line.quantity || ''}
              onChange={(e) =>
                onChange({
                  ...line,
                  quantity: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="text-gray-500">
              Unit price{line.unitPriceOverride && ' *'}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={line.unitPrice || ''}
              onChange={(e) =>
                onChange({
                  ...line,
                  unitPrice: Number(e.target.value) || 0,
                  unitPriceOverride: true,
                })
              }
              className="mt-1"
            />
          </label>
          <div className="text-xs">
            <span className="text-gray-500 block">Stock</span>
            {line.stockTracked && line.availableQty != null ? (
              <span
                className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                  overShortfall
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                available: {line.availableQty}
              </span>
            ) : (
              <span className="inline-block mt-1 text-gray-400">—</span>
            )}
          </div>
        </div>
      )}

      {overShortfall && (
        <div className="pl-8 text-xs text-red-600">
          Qty exceeds available stock ({line.availableQty}).
        </div>
      )}
    </div>
  )
}
