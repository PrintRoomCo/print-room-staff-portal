'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Plus } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useQuoteBuilderData } from '@/hooks/useQuoteBuilderData'
import { useQuoteForm } from '@/hooks/useQuoteForm'
import { useQuotePricing } from '@/hooks/useQuotePricing'
import { useStaff } from '@/contexts/StaffContext'
import { QuoteDetailsSection } from '@/components/quote-builder/QuoteDetailsSection'
import { ProductSelector } from '@/components/quote-builder/ProductSelector'
import { ProductCard } from '@/components/quote-builder/ProductCard'
import { QuoteSummary } from '@/components/quote-builder/QuoteSummary'
import { DesignGroup } from '@/components/quote-builder/DesignGroup'
import { ORDER_EXTRA_NAMES } from '@/lib/quote-builder/types'
import { ExtrasSelector } from '@/components/quote-builder/ExtrasSelector'
import type { MtoProduct, Product, QuoteItem, QuoteDraft } from '@/lib/quote-builder/types'

interface QuoteFormProps {
  mode: 'create' | 'edit'
  quoteId?: string
}

type AddMode = 'catalog' | 'custom' | 'same-design'

interface NewItemState {
  addMode: AddMode
  dataset: 'catalog' | 'mto'
  brand: string
  category: string
  quantity: number
  productType: string
  designGroupName: string
  sourcingType: string
  name: string
  customBrand: string
  baseCost: number
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

function createNewItemState(): NewItemState {
  return {
    addMode: 'catalog',
    dataset: 'catalog',
    brand: 'all',
    category: 'all',
    quantity: 24,
    productType: '',
    designGroupName: '',
    sourcingType: 'NZ APPAREL',
    name: '',
    customBrand: '',
    baseCost: 0,
  }
}

function normalizeOrderExtraOptions(names: string[]) {
  return names.map((name, index) => ({
    id: index + 1,
    name,
    price: '',
    pricing_structure: 'order',
    category: 'order',
    active: true,
    applies_to: 'order',
    sourcing_type: null,
    min_qty: null,
    max_qty: null,
    applicable_product_types: [],
    not_applicable_product_types: [],
  }))
}

export function QuoteForm({ mode, quoteId }: QuoteFormProps) {
  const router = useRouter()
  const { staff } = useStaff()
  const referenceData = useQuoteBuilderData()
  const [selectedProduct, setSelectedProduct] = useState<Product | MtoProduct | null>(null)
  const [itemBuilder, setItemBuilder] = useState<NewItemState>(createNewItemState)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const {
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
    getSanitizedDraft,
  } = useQuoteForm({ initialAccountManager: staff?.display_name })

  const { pricing } = useQuotePricing(draft, referenceData)

  useEffect(() => {
    if (!draft.templateId && referenceData.templates[0]) {
      updateField('templateId', referenceData.templates[0].id)
    }
  }, [draft.templateId, referenceData.templates, updateField])

  useEffect(() => {
    if (mode !== 'edit' || !quoteId) {
      return
    }

    let isCancelled = false

    async function loadQuote() {
      setLoadingQuote(true)
      setPageError(null)

      try {
        const response = await fetch(`/api/quote-builder/quotes/${quoteId}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Quote request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const quotePayload = payload.quote || payload

        if (!isCancelled) {
          replaceDraft(quotePayload as Record<string, unknown>)
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setPageError(caughtError instanceof Error ? caughtError.message : 'Failed to load quote')
        }
      } finally {
        if (!isCancelled) {
          setLoadingQuote(false)
        }
      }
    }

    loadQuote()

    return () => {
      isCancelled = true
    }
  }, [mode, quoteId, replaceDraft])

  const productSourceList = itemBuilder.dataset === 'catalog' ? referenceData.products : referenceData.mtoProducts
  const availableBrands = Array.from(new Set(productSourceList.map((product) => product.brand).filter(Boolean) as string[])).sort()
  const availableCategories = Array.from(new Set(productSourceList.map((product) => product.category).filter(Boolean) as string[])).sort()
  const filteredProducts = productSourceList.filter((product) => {
    const matchesBrand = itemBuilder.brand === 'all' || product.brand === itemBuilder.brand
    const matchesCategory = itemBuilder.category === 'all' || product.category === itemBuilder.category
    return matchesBrand && matchesCategory
  })

  async function handleSaveQuote() {
    setSaving(true)
    setPageError(null)

    try {
      const payload: QuoteDraft = {
        ...getSanitizedDraft(),
        subtotal: pricing.subtotal,
        total: pricing.total,
      }

      const response = await fetch(mode === 'create' ? '/api/quote-builder/quotes' : `/api/quote-builder/quotes/${quoteId}`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Save request failed with status ${response.status}`)
      }

      const result = await response.json()
      const nextId = result.id || result.quote?.id || quoteId

      if (nextId) {
        startTransition(() => {
          router.push(`/quote-tool/${nextId}/edit`)
        })
      }
    } catch (caughtError) {
      setPageError(caughtError instanceof Error ? caughtError.message : 'Failed to save quote')
    } finally {
      setSaving(false)
    }
  }

  function handleAddItem() {
    if (itemBuilder.addMode === 'custom') {
      addCustomItem({
        name: itemBuilder.name,
        brand: itemBuilder.customBrand,
        category: itemBuilder.category === 'all' ? '' : itemBuilder.category,
        sourcingType: itemBuilder.sourcingType,
        productType: itemBuilder.productType,
        quantity: itemBuilder.quantity,
        baseCost: itemBuilder.baseCost,
        designGroupName: itemBuilder.addMode === 'same-design' ? itemBuilder.designGroupName : itemBuilder.designGroupName,
      })
    } else if (selectedProduct) {
      addItemFromProduct(selectedProduct, itemBuilder.dataset === 'mto' ? 'mto' : 'catalog', {
        quantity: itemBuilder.quantity,
        productType: itemBuilder.productType || selectedProduct.category || '',
        designGroupName: itemBuilder.addMode === 'same-design' ? itemBuilder.designGroupName : '',
      })
    }

    setSelectedProduct(null)
    setItemBuilder(createNewItemState())
  }

  function renderItems(items: QuoteItem[]) {
    const renderedGroups = new Set<string>()

    return items.map((item) => {
      const groupName = (item.designGroupName || '').trim()
      if (!groupName) {
        return renderItemCard(item)
      }

      if (renderedGroups.has(groupName)) {
        return null
      }

      renderedGroups.add(groupName)
      const groupedItems = items.filter((candidate) => (candidate.designGroupName || '').trim() === groupName)

      return (
        <DesignGroup key={`group-${groupName}`} name={groupName} itemCount={groupedItems.length}>
          {groupedItems.map((groupedItem) => renderItemCard(groupedItem))}
        </DesignGroup>
      )
    })
  }

  function renderItemCard(item: QuoteItem) {
    const itemIssueMessages = (validation.itemIssues[item.id] || []).map((issue) => issue.message)

    return (
      <ProductCard
        key={item.id}
        item={item}
        referenceData={referenceData}
        pricing={pricing.items[item.id]}
        itemIssues={itemIssueMessages}
        onPatchItem={(patch) => patchItem(item.id, patch)}
        onRemoveItem={() => removeItem(item.id)}
        onDuplicateItem={() => duplicateItem(item.id)}
        onAddDecoration={() => addDecoration(item.id)}
        onPatchDecoration={(decorationId, patch) => patchDecoration(item.id, decorationId, patch)}
        onRemoveDecoration={(decorationId) => removeDecoration(item.id, decorationId)}
        onAddDecorationExtra={(decorationId) => addDecorationExtra(item.id, decorationId)}
        onPatchDecorationExtra={(decorationId, extraId, patch) => patchDecorationExtra(item.id, decorationId, extraId, patch)}
        onRemoveDecorationExtra={(decorationId, extraId) => removeDecorationExtra(item.id, decorationId, extraId)}
        onAddFinish={() => addFinish(item.id)}
        onPatchFinish={(finishId, patch) => patchFinish(item.id, finishId, patch)}
        onRemoveFinish={(finishId) => removeFinish(item.id, finishId)}
        onAddItemExtra={() => addItemExtra(item.id)}
        onPatchItemExtra={(extraId, patch) => patchItemExtra(item.id, extraId, patch)}
        onRemoveItemExtra={(extraId) => removeItemExtra(item.id, extraId)}
      />
    )
  }

  if (loadingQuote) {
    return (
      <div className="space-y-8">
        <Header title="Edit Quote" description="Loading quote data…" />
        <Card className="p-16 text-center text-sm text-muted-foreground">Loading quote…</Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Header
        title={mode === 'create' ? 'New Quote' : 'Edit Quote'}
        description={mode === 'create'
          ? 'Build a new staff quote using the native quote-builder workflow.'
          : 'Update quote details, line items, and pricing.'}
      />

      {pageError ? (
        <Card className="border-red-100 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <div className="font-medium text-red-900">Quote builder unavailable</div>
              <div className="mt-1 text-sm text-red-800">{pageError}</div>
            </div>
          </div>
        </Card>
      ) : null}

      {referenceData.errors.length > 0 ? (
        <Card className="border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
          Some quote-builder reference routes are not available yet. The form is wired to the new API contract and will fill out as those endpoints come online.
        </Card>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <QuoteDetailsSection
            draft={draft}
            priceTiers={referenceData.priceTiers}
            templates={referenceData.templates}
            staffUsers={referenceData.staffUsers}
            onFieldChange={updateField}
          />

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Products</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add catalog, MTO, or custom products to the quote.</p>
              </div>
            </div>

            <div className="mt-6 space-y-5 rounded-[28px] border border-gray-100 bg-gray-50 p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Add Mode</span>
                  <select
                    value={itemBuilder.addMode}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, addMode: event.target.value as AddMode }))}
                    className={selectClassName}
                  >
                    <option value="catalog">Add Product</option>
                    <option value="custom">Add Custom</option>
                    <option value="same-design">Add Product Same Design</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Product Source</span>
                  <select
                    value={itemBuilder.dataset}
                    onChange={(event) => {
                      const nextDataset = event.target.value as NewItemState['dataset']
                      setSelectedProduct(null)
                      setItemBuilder((current) => ({
                        ...current,
                        dataset: nextDataset,
                        brand: 'all',
                        category: 'all',
                        quantity: nextDataset === 'mto' ? 50 : 24,
                        sourcingType: nextDataset === 'mto' ? 'MTO' : 'NZ APPAREL',
                      }))
                    }}
                    className={selectClassName}
                  >
                    <option value="catalog">Catalog</option>
                    <option value="mto">MTO</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Brand</span>
                  <select
                    value={itemBuilder.brand}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, brand: event.target.value }))}
                    className={selectClassName}
                  >
                    <option value="all">All brands</option>
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Category</span>
                  <select
                    value={itemBuilder.category}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, category: event.target.value }))}
                    className={selectClassName}
                  >
                    <option value="all">All categories</option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {itemBuilder.addMode === 'custom' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Input
                    value={itemBuilder.name}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Custom product name"
                  />
                  <Input
                    value={itemBuilder.customBrand}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, customBrand: event.target.value }))}
                    placeholder="Brand"
                  />
                  <Input
                    value={itemBuilder.productType}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, productType: event.target.value }))}
                    placeholder="Product type"
                  />
                  <Input
                    value={itemBuilder.sourcingType}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, sourcingType: event.target.value }))}
                    placeholder="Sourcing type"
                  />
                  <Input
                    type="number"
                    min="24"
                    value={itemBuilder.quantity}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, quantity: Number.parseInt(event.target.value || '24', 10) }))}
                    placeholder="Quantity"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemBuilder.baseCost}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, baseCost: Number.parseFloat(event.target.value || '0') }))}
                    placeholder="Base cost"
                  />
                </div>
              ) : (
                <ProductSelector
                  products={filteredProducts}
                  selectedProductId={selectedProduct?.id}
                  onSelect={setSelectedProduct}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Quantity</span>
                  <Input
                    type="number"
                    min={itemBuilder.dataset === 'mto' ? 50 : 24}
                    value={itemBuilder.quantity}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, quantity: Number.parseInt(event.target.value || '24', 10) }))}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Product Type</span>
                  <Input
                    value={itemBuilder.productType}
                    onChange={(event) => setItemBuilder((current) => ({ ...current, productType: event.target.value }))}
                    placeholder="Apparel, headwear, bag…"
                  />
                </label>

                {itemBuilder.addMode === 'same-design' ? (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-foreground">Design Group Name</span>
                    <Input
                      value={itemBuilder.designGroupName}
                      onChange={(event) => setItemBuilder((current) => ({ ...current, designGroupName: event.target.value }))}
                      placeholder="Shared design name"
                    />
                  </label>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="accent"
                  onClick={handleAddItem}
                  disabled={itemBuilder.addMode !== 'custom' && !selectedProduct}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add to Quote
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {draft.items.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
                  Add your first product to begin building the quote.
                </div>
              ) : (
                renderItems(draft.items)
              )}
            </div>
          </Card>

          <ExtrasSelector
            title="Whole Order Extras"
            extras={draft.orderExtras}
            options={normalizeOrderExtraOptions(ORDER_EXTRA_NAMES)}
            onAdd={addOrderExtra}
            onChange={patchOrderExtra}
            onRemove={removeOrderExtra}
          />
        </div>

        <QuoteSummary
          draft={draft}
          pricing={pricing}
          validation={validation}
          onFieldChange={updateField}
          onSave={handleSaveQuote}
          saving={saving}
        />
      </div>
    </div>
  )
}
