'use client'

import type { GenerationJob } from '@/types/image-generator/jobs'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface JobProgressProps {
  job: GenerationJob
}

export function JobProgress({ job }: JobProgressProps) {
  const { progress, status } = job
  const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {status === 'processing' ? 'Processing...' : status === 'completed' ? 'Complete' : status === 'failed' ? 'Failed' : 'Pending'}
        </span>
        <span className="text-sm text-muted-foreground">
          {progress.completed}/{progress.total}
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2.5">
        <div
          className={cn(
            'h-2.5 rounded-full transition-all duration-500',
            status === 'failed' ? 'bg-destructive' : status === 'completed' ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {progress.current_product_name && status === 'processing' && (
        <p className="text-xs text-muted-foreground mt-2">
          Currently processing: {progress.current_product_name}
        </p>
      )}

      {job.error_message && (
        <p className="text-xs text-destructive mt-2">{job.error_message}</p>
      )}
    </Card>
  )
}
