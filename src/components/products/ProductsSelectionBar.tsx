'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateCatalogueDialog } from '@/components/catalogues/CreateCatalogueDialog'

export function ProductsSelectionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[]
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  if (selectedIds.length === 0) return null
  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)]">
        <span className="text-sm font-medium text-gray-700">
          {selectedIds.length} selected
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear
          </Button>
          <Button type="button" variant="accent" onClick={() => setOpen(true)}>
            Create B2B catalogue from selected
          </Button>
        </div>
      </div>
      {open && (
        <CreateCatalogueDialog
          productIds={selectedIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
