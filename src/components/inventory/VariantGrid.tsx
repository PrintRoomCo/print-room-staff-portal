'use client'

import { useMemo, useState } from 'react'
import { AdjustDrawer } from './AdjustDrawer'

export interface VariantRow {
  variant_id: string
  product_id?: string
  color_swatch_id: string | null
  color_label: string | null
  color_hex: string | null
  size_id: number | null
  size_label: string | null
  size_order: number | null
  stock_qty: number
  committed_qty: number
  available_qty: number
}

export function VariantGrid({
  orgId,
  productId,
  variants,
}: {
  orgId: string
  productId: string
  variants: VariantRow[]
}) {
  const [selected, setSelected] = useState<VariantRow | null>(null)

  const rows = useMemo(() => {
    const byColor = new Map<
      string,
      { label: string; hex: string | null; cells: VariantRow[] }
    >()
    const sizeSet = new Map<number, { label: string; order: number }>()
    for (const v of variants) {
      const key = v.color_swatch_id ?? '__none__'
      const bucket =
        byColor.get(key) ?? {
          label: v.color_label ?? '—',
          hex: v.color_hex,
          cells: [],
        }
      bucket.cells.push(v)
      byColor.set(key, bucket)
      if (v.size_id != null) {
        sizeSet.set(v.size_id, {
          label: v.size_label ?? '',
          order: v.size_order ?? 0,
        })
      }
    }
    const sizes = Array.from(sizeSet.entries())
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => a.order - b.order)
    const colorRows = Array.from(byColor.values())
    return { sizes, colorRows }
  }, [variants])

  if (!variants.length) {
    return (
      <div className="text-gray-500">
        No variants tracked. Return to the previous page to track this product.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs text-gray-500 p-2">Color</th>
            {rows.sizes.map((s) => (
              <th key={s.id} className="text-xs text-gray-500 p-2">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.colorRows.map((row) => (
            <tr key={row.label} className="border-t">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  {row.hex && (
                    <span
                      className="inline-block w-4 h-4 rounded-full border"
                      style={{ backgroundColor: row.hex }}
                    />
                  )}
                  <span className="text-sm">{row.label}</span>
                </div>
              </td>
              {rows.sizes.map((s) => {
                const cell = row.cells.find((c) => c.size_id === s.id)
                if (!cell) {
                  return (
                    <td key={s.id} className="p-2">
                      <span className="text-gray-300">—</span>
                    </td>
                  )
                }
                const red = cell.available_qty <= 0
                return (
                  <td key={s.id} className="p-2">
                    <button
                      onClick={() => setSelected(cell)}
                      className={`w-full rounded p-2 text-center hover:bg-gray-50 ${
                        red ? 'text-red-600' : ''
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {cell.available_qty}/{cell.stock_qty}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cell.committed_qty} committed
                      </div>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <AdjustDrawer
          orgId={orgId}
          productId={productId}
          variant={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
