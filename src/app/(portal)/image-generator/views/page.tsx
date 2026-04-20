'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/image-generator/header'
import { ProductSelector } from '@/components/image-generator/product-selector'
import { CostEstimator } from '@/components/image-generator/cost-estimator'
import { JobProgress } from '@/components/image-generator/job-progress'
import { JobList } from '@/components/image-generator/job-list'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProductWithViews } from '@/types/image-generator/products'
import type { ViewType } from '@/types/image-generator/views'
import type { GenerationJob } from '@/types/image-generator/jobs'

const AVAILABLE_VIEWS: ViewType[] = ['left', 'right', 'back']

export default function ViewsPage() {
  const [products, setProducts] = useState<ProductWithViews[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedViews, setSelectedViews] = useState<Set<ViewType>>(new Set(AVAILABLE_VIEWS))
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/image-generator/products').then(r => r.json()),
      fetch('/api/image-generator/jobs?jobType=view&limit=10').then(r => r.json()),
    ]).then(([productsData, jobsData]) => {
      setProducts(Array.isArray(productsData) ? productsData : [])
      setRecentJobs(Array.isArray(jobsData) ? jobsData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeJob || !['pending', 'processing'].includes(activeJob.status)) return
    const activeJobId = activeJob.id

    const interval = setInterval(async () => {
      const res = await fetch(`/api/image-generator/jobs/${activeJobId}`)
      const job = await res.json()
      setActiveJob(job)
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval)
        fetch('/api/image-generator/jobs?jobType=view&limit=10').then(r => r.json()).then(setRecentJobs)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [activeJob])

  const handleGenerate = useCallback(async () => {
    if (selectedIds.size === 0 || selectedViews.size === 0) return
    setGenerating(true)

    try {
      const createRes = await fetch('/api/image-generator/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'view',
          productIds: Array.from(selectedIds),
          config: { views: Array.from(selectedViews) },
        }),
      })
      const { job } = await createRes.json()
      setActiveJob(job)
      await fetch('/api/image-generator/process?jobType=view', { method: 'POST' })
    } catch (error) {
      console.error('Failed to start generation:', error)
    } finally {
      setGenerating(false)
    }
  }, [selectedIds, selectedViews])

  const totalImages = selectedIds.size * selectedViews.size

  if (loading) return <div className="text-muted-foreground">Loading products...</div>

  return (
    <div>
      <Header
        title="Design Tool Views"
        description="Generate product view images (left, right, back) for the design tool"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ProductSelector
            products={products}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Views to Generate</h3>
            <div className="space-y-2">
              {AVAILABLE_VIEWS.map(view => (
                <label key={view} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedViews.has(view)}
                    onChange={e => {
                      const next = new Set(selectedViews)
                      if (e.target.checked) next.add(view)
                      else next.delete(view)
                      setSelectedViews(next)
                    }}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="capitalize">{view}</span>
                </label>
              ))}
            </div>
          </Card>

          <CostEstimator totalImages={totalImages} includeBackgroundRemoval />

          <Button
            onClick={handleGenerate}
            disabled={selectedIds.size === 0 || selectedViews.size === 0 || generating}
            className="w-full"
            size="lg"
          >
            {generating ? 'Starting...' : `Generate ${totalImages} Images`}
          </Button>

          {activeJob && <JobProgress job={activeJob} />}
        </div>
      </div>

      {recentJobs.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-4">Recent View Jobs</h2>
          <JobList jobs={recentJobs} basePath="/image-generator/views" />
        </div>
      )}
    </div>
  )
}
