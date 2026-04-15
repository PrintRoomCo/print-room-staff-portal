'use client'

import { useEffect, useState } from 'react'
import { Archive, Check, ExternalLink, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { GeneratedAssetStatus, GeneratedImageAsset } from '@/types/image-generator/assets'

interface AssetLibraryPanelProps {
  selectionMode?: boolean
  selectedAssetIds?: string[]
  onSelectAsset?: (asset: GeneratedImageAsset) => void
  defaultWorkflow?: 'proposal' | 'web' | 'all'
  limit?: number
}

type WorkflowFilter = 'proposal' | 'web' | 'all'
type StatusFilter = GeneratedAssetStatus | 'all'

const STATUS_VARIANT: Record<GeneratedAssetStatus, 'gray' | 'info' | 'success' | 'orange'> = {
  generated: 'gray',
  selected: 'info',
  approved: 'success',
  archived: 'orange',
}

function formatAssetType(value: string) {
  return value.replace(/-/g, ' ')
}

function formatWorkflow(value?: string) {
  return value === 'proposal' ? 'Proposal visuals' : value === 'web' ? 'Web assets' : 'Asset'
}

export function AssetLibraryPanel({
  selectionMode = false,
  selectedAssetIds = [],
  onSelectAsset,
  defaultWorkflow = 'all',
  limit = 48,
}: AssetLibraryPanelProps) {
  const [assets, setAssets] = useState<GeneratedImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [workflowType, setWorkflowType] = useState<WorkflowFilter>(defaultWorkflow)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const params = new URLSearchParams()
    if (workflowType !== 'all') params.set('workflowType', workflowType)
    if (status !== 'all') params.set('status', status)
    if (search.trim()) params.set('search', search.trim())
    params.set('limit', String(limit))

    setLoading(true)
    fetch(`/api/image-generator/assets?${params}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        return Array.isArray(data.assets) ? data.assets : []
      })
      .then(data => {
        setAssets(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [limit, search, status, workflowType])

  async function updateStatus(assetId: string, nextStatus: GeneratedAssetStatus) {
    setUpdatingIds(current => new Set(current).add(assetId))
    try {
      const response = await fetch(`/api/image-generator/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.asset) {
        throw new Error(data.error || 'Failed to update asset')
      }

      setAssets(current =>
        current.map(asset => (asset.id === assetId ? data.asset : asset))
      )
    } catch (error) {
      console.error(error)
    } finally {
      setUpdatingIds(current => {
        const next = new Set(current)
        next.delete(assetId)
        return next
      })
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Reusable asset library</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review generated visuals, mark approved assets, and reuse them in proposal sections.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex rounded-full bg-gray-100 p-1">
              {(['all', 'proposal', 'web'] as WorkflowFilter[]).map(option => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={workflowType === option ? 'accent' : 'ghost'}
                  onClick={() => setWorkflowType(option)}
                >
                  {option === 'all' ? 'All assets' : option === 'proposal' ? 'Proposal' : 'Web'}
                </Button>
              ))}
            </div>

            <select
              value={status}
              onChange={event => setStatus(event.target.value as StatusFilter)}
              className="h-10 rounded-full border border-gray-200 bg-gray-50 px-5 text-sm text-foreground focus:outline-none focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]"
              title="Filter assets by status"
            >
              <option value="all">All statuses</option>
              <option value="generated">Generated</option>
              <option value="selected">Selected</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>

            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by product, brief, or item name"
                className="pl-11"
              />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading assets...</Card>
      ) : assets.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No reusable assets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a proposal or web asset job to populate the library.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map(asset => {
            const isUpdating = updatingIds.has(asset.id)
            const isSelected = selectedAssetIds.includes(asset.id)

            return (
              <Card key={asset.id} className="overflow-hidden">
                <div className="relative aspect-[4/3] bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.storageUrl}
                    alt={asset.productLabel}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge variant={STATUS_VARIANT[asset.status]}>{asset.status}</Badge>
                    {asset.workflowType && (
                      <Badge variant="blue">{formatWorkflow(asset.workflowType)}</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-base font-medium text-foreground">{asset.productLabel}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {asset.briefSummary || asset.sourceItemName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="gray">{formatAssetType(asset.assetType)}</Badge>
                    {asset.presetKey && <Badge variant="purple">{asset.presetKey.replace(/-/g, ' ')}</Badge>}
                    {asset.destinationTags.map(tag => (
                      <Badge key={tag} variant={tag === 'proposal' ? 'green' : 'cyan'}>
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectionMode ? (
                      <Button
                        type="button"
                        variant={isSelected ? 'accent' : 'secondary'}
                        disabled={isSelected}
                        onClick={() => onSelectAsset?.(asset)}
                      >
                        {isSelected ? 'Selected' : 'Use asset'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant={asset.status === 'selected' ? 'accent' : 'secondary'}
                          disabled={isUpdating}
                          onClick={() => updateStatus(asset.id, 'selected')}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Pick
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={asset.status === 'approved' ? 'accent' : 'brand-outline'}
                          disabled={isUpdating}
                          onClick={() => updateStatus(asset.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isUpdating}
                          onClick={() => updateStatus(asset.id, 'archived')}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(asset.storageUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
