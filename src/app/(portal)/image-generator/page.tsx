'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Layers, ShoppingBag, FileBox } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { JobList } from '@/components/image-generator/job-list'
import { Card } from '@/components/ui/card'
import type { GenerationJob } from '@/types/image-generator/jobs'

const PIPELINES = [
  { href: '/image-generator/views', label: 'Design Tool Views', description: 'Generate left, right, back views for the design tool', icon: Layers },
  { href: '/image-generator/ecommerce', label: 'Ecommerce Images', description: 'Upload product photos and generate lifestyle, hero, white-background, or size-guide imagery', icon: ShoppingBag },
  { href: '/image-generator/techpacks', label: 'Tech Pack Assets', description: 'Flat drawings, measurements, construction details', icon: FileBox },
]

export default function ImageGeneratorDashboard() {
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/image-generator/jobs?limit=10')
      .then(res => res.json())
      .then(data => {
        setRecentJobs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stats = {
    total: recentJobs.length,
    processing: recentJobs.filter(j => j.status === 'processing').length,
    completed: recentJobs.filter(j => j.status === 'completed').length,
    failed: recentJobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div>
      <Header title="Image Generator" description="AI-powered product image generation" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PIPELINES.map(pipeline => {
          const Icon = pipeline.icon
          return (
            <Link key={pipeline.href} href={pipeline.href}>
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-base">{pipeline.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{pipeline.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Recent Jobs', value: stats.total, color: 'text-foreground' },
          { label: 'Processing', value: stats.processing, color: 'text-primary' },
          { label: 'Completed', value: stats.completed, color: 'text-success' },
          { label: 'Failed', value: stats.failed, color: 'text-destructive' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4">Recent Jobs</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <JobList jobs={recentJobs} />
      )}
    </div>
  )
}
