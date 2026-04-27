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
      <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
        <span className="text-sm text-gray-700">{selectedIds.length} selected</span>
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
