'use client'

import { Card } from '@/components/ui/card'
import type { PipelineResult } from '@/types/image-generator/pipeline-results'

interface JobResultsProps {
  results: PipelineResult[]
}

export function JobResults({ results }: JobResultsProps) {
  if (results.length === 0) {
    return <p className="text-muted-foreground text-sm">No results yet</p>
  }

  return (
    <div className="space-y-6">
      {results.map(result => (
        <Card key={result.itemId} className="p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">{result.itemName}</h3>
              {result.briefSummary && (
                <p className="mt-1 text-sm text-muted-foreground">{result.briefSummary}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.workflowType && (
                <span className="rounded-full border border-[rgb(var(--color-brand-blue))]/15 bg-[rgb(var(--color-brand-blue))]/10 px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-brand-blue))]">
                  {result.workflowType === 'proposal' ? 'Proposal visuals' : 'Web assets'}
                </span>
              )}
              {result.destinationTags?.map(tag => (
                <span
                  key={tag}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    tag === 'proposal'
                      ? 'border border-[rgb(var(--color-brand-blue))]/15 bg-[rgb(var(--color-brand-yellow))] text-[rgb(var(--color-brand-blue))]'
                      : 'border border-cyan-200 bg-cyan-50 text-cyan-800'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {result.sourceImages && result.sourceImages.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Source References
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {result.sourceImages.map(source => (
                  <Card key={source.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={source.url}
                        alt={source.name}
                        className="h-full w-full object-cover"
                      />
                      {source.isPrimary && (
                        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="truncate p-2 text-xs text-muted-foreground">
                      {source.name}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {result.generatedItems.map(item => (
              <Card key={item.recordId || `${result.itemId}-${item.type}-${item.storageUrl}`} className="overflow-hidden">
                <div className="aspect-square bg-muted relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.storageUrl}
                    alt={`${result.itemName} - ${item.type}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium capitalize text-foreground">
                      {item.type.replace('-', ' ')}
                    </span>
                    {item.assetStatus && (
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {item.assetStatus}
                      </span>
                    )}
                  </div>
                  {item.destinationTags && item.destinationTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.destinationTags.map(tag => (
                        <span
                          key={tag}
                          className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                            tag === 'proposal'
                              ? 'bg-[rgb(var(--color-brand-yellow))] text-[rgb(var(--color-brand-blue))]'
                              : 'bg-cyan-50 text-cyan-800'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
