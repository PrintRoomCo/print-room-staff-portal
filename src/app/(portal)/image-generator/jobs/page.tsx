'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/image-generator/header'
import { JobList } from '@/components/image-generator/job-list'
import type { GenerationJob, JobType, JobStatus } from '@/types/image-generator/jobs'

export default function AllJobsPage() {
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('jobType', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    params.set('limit', '50')

    setLoading(true)
    fetch(`/api/image-generator/jobs?${params}`)
      .then(r => r.json())
      .then(data => { setJobs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [typeFilter, statusFilter])

  return (
    <div>
      <Header title="All Jobs" description="View and manage generation jobs across all pipelines" />

      <div className="flex gap-3 mb-6">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as JobType | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="all">All Types</option>
          <option value="view">Design Tool Views</option>
          <option value="ecommerce">Ecommerce</option>
          <option value="techpack">Tech Pack</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as JobStatus | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading jobs...</p>
      ) : (
        <JobList jobs={jobs} />
      )}
    </div>
  )
}
