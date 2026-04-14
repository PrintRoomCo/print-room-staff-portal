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
          <h3 className="font-medium mb-3">{result.itemName}</h3>

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
                <div className="p-2 text-xs text-muted-foreground text-center capitalize">
                  {item.type.replace('-', ' ')}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
