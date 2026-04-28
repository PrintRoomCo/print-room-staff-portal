'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FileCheck } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ProofSummary } from '@/types/proofs'

const STATUS_VARIANT: Record<ProofSummary['status'], 'gray' | 'info' | 'success' | 'warning' | 'purple'> = {
  draft: 'gray',
  sent: 'info',
  approved: 'success',
  changes_requested: 'warning',
  superseded: 'purple',
  archived: 'gray',
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ProofsPage() {
  const [proofs, setProofs] = useState<ProofSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProofs() {
      try {
        const response = await fetch('/api/proofs')
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to fetch proofs')
        }

        const payload = await response.json()
        setProofs(payload.proofs || [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch proofs')
      } finally {
        setLoading(false)
      }
    }

    fetchProofs()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <Header title="Design proofs" action={<Link href="/proofs/new"><Button variant="accent">Create proof</Button></Link>} />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Header
        title="Design proofs"
        action={
          <Link href="/proofs/new">
            <Button variant="accent">Create proof</Button>
          </Link>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {proofs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileCheck className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">No proofs yet</h2>
          <Link href="/proofs/new" className="mt-6">
            <Button variant="accent">Create proof</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {proofs.map(proof => (
            <Link key={proof.id} href={`/proofs/${proof.id}`}>
              <Card className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[proof.status]}>{proof.status.replace('_', ' ')}</Badge>
                      <Badge variant="gray">{proof.designCount} designs</Badge>
                      <Badge variant="gray">{proof.orderLineCount} lines</Badge>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-foreground">
                      {proof.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {proof.organizationName} for {proof.customerName || proof.customerEmail}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-[rgb(var(--color-brand-blue))]/10 text-[rgb(var(--color-brand-blue))] flex items-center justify-center">
                    <FileCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-muted-foreground">Version</p>
                    <p className="mt-1 font-medium text-foreground">
                      {proof.versionNumber ? `v${proof.versionNumber}` : 'No version'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-muted-foreground">Updated</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(proof.updatedAt)}</p>
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
