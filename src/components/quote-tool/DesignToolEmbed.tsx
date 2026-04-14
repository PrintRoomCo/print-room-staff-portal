'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface DesignToolEmbedProps {
  staffToken: string
  onQuoteSubmitted?: (quoteId: string, data: Record<string, unknown>) => void
  onError?: (message: string) => void
}

type StaffOutboundMessage =
  | { type: 'LOADED' }
  | { type: 'QUOTE_SUBMITTED'; quoteId: string; data: Record<string, unknown> }
  | { type: 'NAVIGATION'; path: string }
  | { type: 'ERROR'; message: string }

export function DesignToolEmbed({ staffToken, onQuoteSubmitted, onError }: DesignToolEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const designToolUrl = process.env.NEXT_PUBLIC_DESIGN_TOOL_URL || ''
  const iframeSrc = `${designToolUrl}/staff-quote?token=${encodeURIComponent(staffToken)}&mode=staff`

  // Listen for messages from the design tool iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Validate origin matches design tool
      if (designToolUrl && !event.origin.startsWith(new URL(designToolUrl).origin)) {
        return
      }

      const data = event.data as StaffOutboundMessage
      if (!data || typeof data !== 'object' || !data.type) return

      switch (data.type) {
        case 'LOADED':
          setIsLoaded(true)
          break
        case 'QUOTE_SUBMITTED':
          onQuoteSubmitted?.(data.quoteId, data.data)
          break
        case 'ERROR':
          setHasError(true)
          onError?.(data.message)
          break
        case 'NAVIGATION':
          // Could track navigation state if needed
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [designToolUrl, onQuoteSubmitted, onError])

  // Send initialization message once iframe loads
  const handleIframeLoad = useCallback(() => {
    // The iframe's own JS will handle initialization via the URL token
    // We set a fallback timeout for the LOADED message
    const timeout = setTimeout(() => {
      if (!isLoaded) setIsLoaded(true)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [isLoaded])

  if (!designToolUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">Design tool URL not configured. Set NEXT_PUBLIC_DESIGN_TOOL_URL.</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
            <p className="mt-4 text-sm text-gray-600">Loading design tool...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg z-20">
          <div className="text-center">
            <p className="text-red-600 font-medium">Failed to load design tool</p>
            <button
              onClick={() => {
                setHasError(false)
                setIsLoaded(false)
                if (iframeRef.current) {
                  iframeRef.current.src = iframeSrc
                }
              }}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="w-full h-full border-0 rounded-lg"
        onLoad={handleIframeLoad}
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Design Tool - Staff Quote"
      />
    </div>
  )
}
