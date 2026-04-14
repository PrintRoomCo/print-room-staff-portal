'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DesignToolEmbed } from '@/components/quote-tool/DesignToolEmbed'

export default function QuoteToolPage() {
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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Initializing quote tool...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!staffToken) return null

  return (
    <div className="h-[calc(100vh-4rem)]">
      <DesignToolEmbed
        staffToken={staffToken}
        onQuoteSubmitted={handleQuoteSubmitted}
        onError={handleError}
      />
    </div>
  )
}
