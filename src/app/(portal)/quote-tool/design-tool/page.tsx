'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DesignToolEmbed } from '@/components/quote-tool/DesignToolEmbed'

export default function DesignToolPage() {
  const router = useRouter()
  const [staffToken, setStaffToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/quote-tool/token', { method: 'POST' })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to get token')
        }
        const { token } = await res.json()
        setStaffToken(token)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      } finally {
        setLoading(false)
      }
    }
    fetchToken()
  }, [])

  const handleQuoteSubmitted = useCallback((quoteId: string) => {
    router.push(`/quote-tool/quotes/${quoteId}`)
  }, [router])

  const handleError = useCallback((message: string) => {
    console.error('[QuoteTool] Error from design tool:', message)
  }, [])

  if (loading) {
    return (
      <div className="-m-4 flex h-screen items-center justify-center md:-m-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Initializing design tool...</p>
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

  return (
    <div className="-m-4 h-screen md:-m-8">
      <DesignToolEmbed
        staffToken={staffToken}
        onQuoteSubmitted={handleQuoteSubmitted}
        onError={handleError}
      />
    </div>
  )
}
