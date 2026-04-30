'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddProductModal } from '@/components/designer/AddProductModal'

export function AddProductTile() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-600 transition hover:border-pr-blue hover:bg-pr-blue/5 hover:text-pr-blue"
      >
        <Plus className="h-10 w-10" />
        <span className="text-sm font-medium">Add product</span>
      </button>
      {open && <AddProductModal onClose={() => setOpen(false)} />}
    </>
  )
}
