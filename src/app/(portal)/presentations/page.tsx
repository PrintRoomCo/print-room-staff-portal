'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Presentation as PresentationIcon } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { PresentationSummary } from '@/types/presentations'

const STATUS_VARIANT: Record<PresentationSummary['status'], 'gray' | 'success' | 'info'> = {
  draft: 'gray',
  ready: 'success',
  archived: 'info',
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PresentationsPage() {
  const [presentations, setPresentations] = useState<PresentationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPresentations() {
      try {
        const response = await fetch('/api/presentations')
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to fetch presentations')
        }

        const payload = await response.json()
        setPresentations(payload.presentations || [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch presentations')
      } finally {
        setLoading(false)
      }
    }

    fetchPresentations()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <Header
          title="Presentations"
          description="Build reusable client proposals from the Print Room presentation template."
        />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Header
        title="Presentations"
        description="Build reusable client proposals from the Print Room presentation template."
        action={
          <Link href="/presentations/new">
            <Button variant="accent">Create proposal</Button>
          </Link>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {presentations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <PresentationIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">No presentations yet</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Create a proposal from the Print Room template to start editing client narrative, product stories,
            pricing, packaging ideas, and commercial terms.
          </p>
          <Link href="/presentations/new" className="mt-6">
            <Button variant="accent">Create proposal</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {presentations.map(presentation => (
            <Link key={presentation.id} href={`/presentations/${presentation.id}`}>
              <Card className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[presentation.status]}>
                        {presentation.status}
                      </Badge>
                      <Badge variant="gray">{presentation.sectionCount} sections</Badge>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-foreground">
                      {presentation.proposalTitle}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {presentation.clientBrand} for {presentation.clientName}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-[rgb(var(--color-brand-blue))]/10 text-[rgb(var(--color-brand-blue))] flex items-center justify-center">
                    <PresentationIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-muted-foreground">Season</p>
                    <p className="mt-1 font-medium text-foreground">{presentation.seasonLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-muted-foreground">Updated</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(presentation.updatedAt)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
