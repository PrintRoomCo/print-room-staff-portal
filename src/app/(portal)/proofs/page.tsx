'use client'

import { useEffect, useState } from 'react'

export default function ProofsPage() {
  const [staffToken, setStaffToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/proofs/token', { method: 'POST' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to get token')
        }
        const { token } = (await res.json()) as { token: string }
        setStaffToken(token)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      } finally {
        setLoading(false)
      }
    }
    fetchToken()
  }, [])

  const designToolUrl = process.env.NEXT_PUBLIC_DESIGN_TOOL_URL || ''

  if (loading) {
    return (
      <div className="-m-4 flex h-screen items-center justify-center md:-m-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading proof builder...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="-m-4 flex h-screen items-center justify-center md:-m-8">
        <div className="max-w-md text-center">
          <p className="font-medium text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!staffToken) return null

  if (!designToolUrl) {
    return (
      <div className="-m-4 flex h-screen items-center justify-center md:-m-8">
        <p className="text-sm text-gray-500">
          Design tool URL not configured. Set NEXT_PUBLIC_DESIGN_TOOL_URL.
        </p>
      </div>
    )
  }

  const iframeSrc = `${designToolUrl}/staff-quote/proof/new?token=${encodeURIComponent(staffToken)}`

  return (
    <div className="-m-4 h-screen md:-m-8">
      <iframe
        src={iframeSrc}
        className="h-full w-full rounded-lg border-0"
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Design Proof Builder"
      />
    </div>
  )
}
