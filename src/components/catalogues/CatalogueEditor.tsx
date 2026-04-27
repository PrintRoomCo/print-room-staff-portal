'use client'

import { useState } from 'react'
import { CatalogueItemsTable } from './CatalogueItemsTable'
import { CatalogueItemPricingTiers } from './CatalogueItemPricingTiers'
import { CatalogueSettingsForm } from './CatalogueSettingsForm'

export type CatalogueEditorCatalogue = {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
}

export type CatalogueEditorOrg = { id: string; name: string } | null

export type CatalogueEditorItem = {
  id: string
  source_product_id: string
  markup_multiplier_override: number | null
  decoration_type_override: string | null
  decoration_price_override: number | null
  shipping_cost_override: number | null
  is_active: boolean
  sort_order: number | null
  source: {
    id: string
    name: string
    sku: string | null
    base_cost: number
    markup_multiplier: number
    image_url: string | null
    decoration_price: number | null
    is_b2b_only: boolean
  }
}

type Tab = 'items' | 'tiers' | 'assignment' | 'settings'

export function CatalogueEditor({
  catalogue,
  items: initialItems,
  organization,
}: {
  catalogue: CatalogueEditorCatalogue
  items: CatalogueEditorItem[]
  organization: CatalogueEditorOrg
}) {
  const [tab, setTab] = useState<Tab>('items')
  const [items, setItems] = useState<CatalogueEditorItem[]>(initialItems)

  const tabs: Tab[] = ['items', 'tiers', 'assignment', 'settings']

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{catalogue.name}</h1>
      <p className="text-sm text-gray-500">
        {organization?.name ?? 'Unknown org'}
        {!catalogue.is_active && ' · Inactive'}
      </p>
      <nav className="mt-4 flex gap-4 border-b">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 ${
              tab === t
                ? 'border-b-2 border-black font-medium'
                : 'text-gray-500'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'items' && (
          <CatalogueItemsTable
            catalogueId={catalogue.id}
            items={items}
            onChange={setItems}
          />
        )}
        {tab === 'tiers' && (
          <CatalogueItemPricingTiers
            catalogueId={catalogue.id}
            items={items}
          />
        )}
        {tab === 'assignment' && (
          <div className="rounded border border-gray-200 p-4">
            <p>
              Owned by <strong>{organization?.name ?? 'Unknown org'}</strong>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Many catalogues per org are allowed (e.g. seasonal). Use Settings → name to differentiate.
            </p>
            {organization?.id && (
              <a
                className="mt-3 inline-block text-blue-600 underline"
                href={`/b2b-accounts/${organization.id}`}
              >
                Open b2b account → (route to be built in sibling spec)
              </a>
            )}
          </div>
        )}
        {tab === 'settings' && (
          <CatalogueSettingsForm catalogue={catalogue} />
        )}
      </div>
    </div>
  )
}
