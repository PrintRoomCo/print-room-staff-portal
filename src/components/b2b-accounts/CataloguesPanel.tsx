'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateCatalogueDialog } from '@/components/catalogues/CreateCatalogueDialog'

export interface CatalogueRow {
  id: string
  name: string
  is_active: boolean
  item_count: number
  created_at: string | null
}

export function CataloguesPanel({
  organizationId,
  catalogues,
}: {
  organizationId: string
  catalogues: CatalogueRow[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded border border-gray-200 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          Catalogues ({catalogues.length})
        </h2>
        <Button type="button" variant="accent" onClick={() => setOpen(true)}>
          + New catalogue
        </Button>
      </header>

      {catalogues.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No catalogues yet.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Items</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {catalogues.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="px-2 py-2">
                  <Link
                    className="text-blue-600 underline"
                    href={`/catalogues/${c.id}`}
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-2 py-2">{c.item_count}</td>
                <td className="px-2 py-2">
                  <span
                    className={
                      c.is_active
                        ? 'rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700'
                        : 'rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600'
                    }
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs text-gray-500">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <CreateCatalogueDialog
          productIds={[]}
          defaultOrgId={organizationId}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
