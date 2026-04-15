'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  FileBox,
  Library,
  List,
  Presentation,
  ShoppingBag,
} from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { JobList } from '@/components/image-generator/job-list'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { GeneratedImageAsset } from '@/types/image-generator/assets'
import type { GenerationJob } from '@/types/image-generator/jobs'

const WORKFLOWS = [
  {
    href: '/image-generator/ecommerce',
    label: 'Proposal visuals',
    description: 'Build client-facing concepts and opener imagery for proposal decks.',
    icon: Presentation,
    badge: 'Proposal',
  },
  {
    href: '/image-generator/ecommerce',
    label: 'Web assets',
    description: 'Generate ecommerce-ready heroes, listings, and merchandising support.',
    icon: ShoppingBag,
    badge: 'Web',
  },
  {
    href: '/image-generator/views',
    label: 'Design tool views',
    description: 'Generate left, right, and back product views for the design tool.',
    icon: Eye,
    badge: 'Production',
  },
  {
    href: '/image-generator/techpacks',
    label: 'Tech pack assets',
    description: 'Create flats, measurements, and construction support imagery.',
    icon: FileBox,
    badge: 'Technical',
  },
  {
    href: '/image-generator/library',
    label: 'Asset library',
    description: 'Review, approve, and reuse the best visuals across proposals and web.',
    icon: Library,
    badge: 'Reuse',
  },
  {
    href: '/image-generator/jobs',
    label: 'All jobs',
    description: 'Track processing, failures, and completed image-generation work.',
    icon: List,
    badge: 'Operations',
  },
]

export default function ImageGeneratorDashboard() {
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([])
  const [recentAssets, setRecentAssets] = useState<GeneratedImageAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/image-generator/jobs?limit=10')
        .then(res => res.json())
        .catch(() => []),
      fetch('/api/image-generator/assets?limit=6')
        .then(res => res.json())
        .catch(() => ({ assets: [] })),
    ])
      .then(([jobsData, assetsData]) => {
        setRecentJobs(Array.isArray(jobsData) ? jobsData : [])
        setRecentAssets(Array.isArray(assetsData.assets) ? assetsData.assets : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stats = {
    jobs: recentJobs.length,
    proposalAssets: recentAssets.filter(asset => asset.workflowType === 'proposal').length,
    webAssets: recentAssets.filter(asset => asset.workflowType === 'web').length,
    approvedAssets: recentAssets.filter(asset => asset.status === 'approved').length,
  }

  return (
    <div className="space-y-8">
      <Header
        title="Image Generator"
        description="Portal-native image workflows for proposals, ecommerce, and reusable Print Room assets."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOWS.map(workflow => {
          const Icon = workflow.icon
          return (
            <Link key={workflow.label} href={workflow.href}>
              <Card variant="interactive" className="h-full p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pr-blue/10 text-pr-blue">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-foreground">{workflow.label}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflow.description}</p>
                    </div>
                  </div>
                  <Badge variant="blue">{workflow.badge}</Badge>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Recent jobs', value: stats.jobs, variant: 'gray' as const },
          { label: 'Proposal assets', value: stats.proposalAssets, variant: 'green' as const },
          { label: 'Web assets', value: stats.webAssets, variant: 'cyan' as const },
          { label: 'Approved assets', value: stats.approvedAssets, variant: 'success' as const },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-3xl font-medium text-foreground">{stat.value}</p>
              </div>
              <Badge variant={stat.variant}>{stat.label}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-foreground">Recent jobs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep an eye on current generation work across proposal, web, and technical outputs.
              </p>
            </div>
            <ButtonLink href="/image-generator/jobs">View all jobs</ButtonLink>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading jobs...</p>
          ) : (
            <JobList jobs={recentJobs} />
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-foreground">Latest reusable assets</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The most recent outputs available for proposal reuse or merchandising rollout.
              </p>
            </div>
            <ButtonLink href="/image-generator/library">Open library</ButtonLink>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading assets...</p>
          ) : recentAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reusable assets yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentAssets.slice(0, 4).map(asset => (
                <div key={asset.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="aspect-[4/3] bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.storageUrl} alt={asset.productLabel} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={asset.workflowType === 'proposal' ? 'green' : 'cyan'}>
                        {asset.workflowType === 'proposal' ? 'Proposal' : 'Web'}
                      </Badge>
                      <Badge variant={asset.status === 'approved' ? 'success' : 'gray'}>{asset.status}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{asset.productLabel}</p>
                    <p className="text-xs text-muted-foreground">{asset.briefSummary || asset.sourceItemName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-foreground transition-all duration-300 ease-spring hover:border-gray-300 hover:bg-gray-50"
    >
      {children}
    </Link>
  )
}
