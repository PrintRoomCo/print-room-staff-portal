'use client'

import Link from 'next/link'
import type { GenerationJob } from '@/types/image-generator/jobs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getEcommerceJobSummary, isEcommerceGenerationConfig } from '@/types/image-generator/ecommerce'

interface JobListProps {
  jobs: GenerationJob[]
  basePath?: string
  showCreator?: boolean
}

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'destructive'> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'destructive',
}

const TYPE_LABELS: Record<string, string> = {
  view: 'Design Tool Views',
  ecommerce: 'Proposal & Web Assets',
  techpack: 'Tech Pack',
}

export function JobList({ jobs, basePath, showCreator }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No jobs found
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Inputs</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progress</th>
            {showCreator && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created By</th>}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.map(job => {
            const href = basePath
              ? `${basePath}/${job.id}`
              : `/image-generator/${job.job_type === 'view' ? 'views' : job.job_type === 'ecommerce' ? 'ecommerce' : 'techpacks'}/${job.id}`

            return (
              <tr key={job.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={href} className="font-medium text-foreground hover:underline">
                    {TYPE_LABELS[job.job_type] || job.job_type}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.job_type === 'ecommerce' && isEcommerceGenerationConfig(job.config)
                    ? getEcommerceJobSummary(job.config)
                    : `${job.product_ids.length} product${job.product_ids.length !== 1 ? 's' : ''}`}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[job.status] || 'default'}>
                    {job.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.progress.completed}/{job.progress.total}
                </td>
                {showCreator && (
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.user_display_name || job.user_email || '\u2014'}
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(job.created_at).toLocaleDateString()} {new Date(job.created_at).toLocaleTimeString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
