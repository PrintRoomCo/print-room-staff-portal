'use client'

import { useState } from 'react'
import { FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AddFromMasterDialog } from './AddFromMasterDialog'
import { CreateB2BOnlyItemDialog } from './CreateB2BOnlyItemDialog'
import { OverrideFlag } from './OverrideFlag'
import type { CatalogueEditorItem } from './CatalogueEditor'

const DECORATION_TYPES = ['N/A', 'Screen print', 'Heat press', 'Super colour']

export function CatalogueItemsTable({
  catalogueId,
  items,
  onChange,
}: {
  catalogueId: string
  items: CatalogueEditorItem[]
  onChange: (items: CatalogueEditorItem[]) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [b2bOpen, setB2bOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const r = await fetch(`/api/catalogues/${catalogueId}/items`)
    if (!r.ok) {
      setError('Failed to load items')
      return
    }
    const d = (await r.json()) as { items?: CatalogueEditorItem[] }
    onChange(d.items ?? [])
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Update failed')
      return
    }
    await refetch()
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remove this item from the catalogue?')) return
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items/${itemId}`, {
      method: 'DELETE',
    })
    if (!r.ok && r.status !== 204) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Delete failed')
      return
    }
    await refetch()
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileX className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No items yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add items from master products or create a B2B-only item.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="accent" onClick={() => setAddOpen(true)}>
                + Add from master
              </Button>
              <Button variant="secondary" onClick={() => setB2bOpen(true)}>
                + Create B2B-only item
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2.5">Image</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Base cost</th>
                <th className="px-3 py-2.5">Markup ×</th>
                <th className="px-3 py-2.5">Decoration type</th>
                <th className="px-3 py-2.5">Decoration price</th>
                <th className="px-3 py-2.5">Shipping</th>
                <th className="px-3 py-2.5">Active</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    {it.source.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.source.image_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{it.source.name}</span>
                      {it.source.is_b2b_only && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                          B2B-only
                        </span>
                      )}
                    </div>
                    {it.source.sku && (
                      <div className="text-xs text-gray-500">{it.source.sku}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    <div className="flex items-center gap-2">
                      <OverrideFlag state="locked" />
                      <span>${Number(it.source.base_cost).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OverrideFlag
                        state={
                          it.markup_multiplier_override == null
                            ? 'inherited'
                            : 'overridden'
                        }
                        masterValueFormatted={Number(
                          it.source.markup_multiplier,
                        ).toFixed(3)}
                      />
                      <Input
                        aria-label="Markup multiplier"
                        type="number"
                        step="0.001"
                        defaultValue={
                          it.markup_multiplier_override ??
                          it.source.markup_multiplier
                        }
                        className="w-24"
                        onBlur={(e) => {
                          const v =
                            e.target.value === '' ? null : Number(e.target.value)
                          patchItem(it.id, { markup_multiplier_override: v })
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OverrideFlag
                        state={
                          it.decoration_type_override == null
                            ? 'inherited'
                            : 'overridden'
                        }
                      />
                      <Select
                        aria-label="Decoration type"
                        className="w-44"
                        value={it.decoration_type_override ?? ''}
                        onChange={(e) =>
                          patchItem(it.id, {
                            decoration_type_override: e.target.value || null,
                          })
                        }
                      >
                        <option value="">— inherit —</option>
                        {DECORATION_TYPES.map((dt) => (
                          <option key={dt} value={dt}>
                            {dt}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const masterDecPrice = it.source.decoration_price
                        const overrideSet = it.decoration_price_override != null
                        if (!overrideSet && masterDecPrice == null) return null
                        return (
                          <OverrideFlag
                            state={overrideSet ? 'overridden' : 'inherited'}
                            masterValueFormatted={
                              masterDecPrice != null
                                ? `$${Number(masterDecPrice).toFixed(2)}`
                                : undefined
                            }
                          />
                        )
                      })()}
                      <Input
                        aria-label="Decoration price"
                        type="number"
                        step="0.01"
                        defaultValue={
                          it.decoration_price_override ??
                          it.source.decoration_price ??
                          ''
                        }
                        className="w-28"
                        onBlur={(e) =>
                          patchItem(it.id, {
                            decoration_price_override:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {it.shipping_cost_override != null && (
                        <OverrideFlag state="overridden" />
                      )}
                      <Input
                        aria-label="Shipping cost"
                        type="number"
                        step="0.01"
                        defaultValue={it.shipping_cost_override ?? ''}
                        className="w-28"
                        onBlur={(e) =>
                          patchItem(it.id, {
                            shipping_cost_override:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Checkbox
                      aria-label="Item active"
                      defaultChecked={it.is_active}
                      onChange={(e) =>
                        patchItem(it.id, { is_active: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeItem(it.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex gap-2">
          <Button variant="accent" onClick={() => setAddOpen(true)}>
            + Add from master
          </Button>
          <Button variant="secondary" onClick={() => setB2bOpen(true)}>
            + Create B2B-only item
          </Button>
        </div>
      )}

      {addOpen && (
        <AddFromMasterDialog
          catalogueId={catalogueId}
          onClose={() => setAddOpen(false)}
          onAdded={async () => {
            setAddOpen(false)
            await refetch()
          }}
        />
      )}
      {b2bOpen && (
        <CreateB2BOnlyItemDialog
          catalogueId={catalogueId}
          onClose={() => setB2bOpen(false)}
          onAdded={async () => {
            setB2bOpen(false)
            await refetch()
          }}
        />
      )}
    </div>
  )
}
