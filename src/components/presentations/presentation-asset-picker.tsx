'use client'

import { X } from 'lucide-react'
import { AssetLibraryPanel } from '@/components/image-generator/asset-library-panel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { GeneratedImageAsset } from '@/types/image-generator/assets'

interface PresentationAssetPickerProps {
  open: boolean
  onClose: () => void
  onSelectAsset: (asset: GeneratedImageAsset) => void
  selectedAssetIds?: string[]
  defaultWorkflow?: 'proposal' | 'web' | 'all'
}

export function PresentationAssetPicker({
  open,
  onClose,
  onSelectAsset,
  selectedAssetIds = [],
  defaultWorkflow = 'all',
}: PresentationAssetPickerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <Card className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-medium text-foreground">Choose library assets</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select generated proposal or web assets to reuse in this presentation section.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close asset picker">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto p-6">
          <AssetLibraryPanel
            selectionMode
            selectedAssetIds={selectedAssetIds}
            onSelectAsset={asset => {
              onSelectAsset(asset)
              onClose()
            }}
            defaultWorkflow={defaultWorkflow}
            limit={24}
          />
        </div>
      </Card>
    </div>
  )
}
