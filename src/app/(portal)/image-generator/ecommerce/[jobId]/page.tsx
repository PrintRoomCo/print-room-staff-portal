'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { JobProgress } from '@/components/image-generator/job-progress'
import { JobResults } from '@/components/image-generator/job-results'
import { normalizePipelineResults } from '@/types/image-generator/pipeline-results'
import type { GenerationJob } from '@/types/image-generator/jobs'

export default function EcommerceJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/image-generator/jobs/${jobId}`)
      .then(res => res.json())
      .then(data => { setJob(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [jobId])

  useEffect(() => {
    if (!job || !['pending', 'processing'].includes(job.status)) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/image-generator/jobs/${jobId}`)
      const data = await res.json()
      setJob(data)
      if (data.status === 'completed' || data.status === 'failed') clearInterval(interval)
    }, 2000)
    return () => clearInterval(interval)
  }, [job, jobId])

  if (loading) return <div className="text-muted-foreground">Loading...</div>
  if (!job) return <div className="text-destructive">Job not found</div>

  const results = normalizePipelineResults(job.results)

  return (
    <div>
      <Header
        title="Proposal & Web Asset Job"
        description={`Job ${jobId.slice(0, 8)}...`}
        action={
          <Link href="/image-generator/ecommerce" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Assets
          </Link>
        }
      />
      <div className="mb-6"><JobProgress job={job} /></div>
      <h2 className="text-lg font-semibold mb-4">Results</h2>
      <JobResults results={results} />
    </div>
  )
}
