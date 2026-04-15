'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/image-generator/header'
import { JobList } from '@/components/image-generator/job-list'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useStaff } from '@/contexts/StaffContext'
import type { GenerationJob, JobType, JobStatus } from '@/types/image-generator/jobs'

type JobScope = 'mine' | 'all'

const selectClass = 'h-10 rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pr-blue))]/20 transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'

export default function AllJobsPage() {
  const { user } = useAuth()
  const { isAdmin } = useStaff()
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [scope, setScope] = useState<JobScope>(isAdmin ? 'all' : 'mine')

  useEffect(() => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('jobType', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (scope === 'mine' && user?.id) params.set('userId', user.id)
    params.set('limit', '50')

    setLoading(true)
    fetch(`/api/image-generator/jobs?${params}`)
      .then(r => r.json())
      .then(data => { setJobs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [typeFilter, statusFilter, scope, user?.id])

  return (
    <div>
      <Header title="All Jobs" description="View and manage generation jobs across all pipelines" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-full bg-gray-100 p-1">
          <Button
            type="button"
            size="sm"
            variant={scope === 'mine' ? 'default' : 'ghost'}
            onClick={() => setScope('mine')}
          >
            My Jobs
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scope === 'all' ? 'default' : 'ghost'}
            onClick={() => setScope('all')}
          >
            All Jobs
          </Button>
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as JobType | 'all')}
          className={selectClass}
          title="Filter by job type"
        >
          <option value="all">All Types</option>
          <option value="view">Design Tool Views</option>
          <option value="ecommerce">Ecommerce</option>
          <option value="techpack">Tech Pack</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as JobStatus | 'all')}
          className={selectClass}
          title="Filter by job status"
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
        <JobList jobs={jobs} showCreator={scope === 'all'} />
      )}
    </div>
  )
}
