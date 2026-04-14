'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StaffQuote {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_company: string | null
  customer_phone: string | null
  status: string
  quote_data: Record<string, unknown>
  design_snapshots: unknown[] | null
  subtotal: number | null
  discount_percent: number | null
  total: number | null
  staff_notes: string | null
  valid_until: string | null
  monday_item_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'outline',
  converted: 'default',
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '—'
  return `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string
  const [quote, setQuote] = useState<StaffQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/quote-tool/quotes/${quoteId}`)
        if (!res.ok) throw new Error('Failed to fetch quote')
        const data = await res.json()
        setQuote(data.quote)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quote')
      } finally {
        setLoading(false)
      }
    }
    if (quoteId) fetchQuote()
  }, [quoteId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="space-y-4">
        <Link href="/quote-tool/quotes" className="text-sm text-blue-600 hover:underline">
          &larr; Back to quotes
        </Link>
        <p className="text-red-600">{error || 'Quote not found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/quote-tool/quotes" className="text-sm text-blue-600 hover:underline">
            &larr; Back to quotes
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Quote Details</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_COLORS[quote.status] || 'secondary'} className="text-sm">
            {quote.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium">{quote.customer_name || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Email:</span>{' '}
              <span className="font-medium">{quote.customer_email || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Company:</span>{' '}
              <span className="font-medium">{quote.customer_company || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Phone:</span>{' '}
              <span className="font-medium">{quote.customer_phone || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quote Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            {(quote.discount_percent ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({quote.discount_percent}%):</span>
                <span>-{formatCurrency((quote.subtotal ?? 0) * ((quote.discount_percent ?? 0) / 100))}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total:</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quote Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500">Quote ID:</span>
              <p className="font-mono text-xs mt-1">{quote.id}</p>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <p className="mt-1">{formatDate(quote.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>
              <p className="mt-1">{formatDate(quote.updated_at)}</p>
            </div>
            <div>
              <span className="text-gray-500">Valid Until:</span>
              <p className="mt-1">{formatDate(quote.valid_until)}</p>
            </div>
          </div>
          {quote.staff_notes && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-gray-500">Staff Notes:</span>
              <p className="mt-1 whitespace-pre-wrap">{quote.staff_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="default"
          onClick={() => router.push('/quote-tool')}
        >
          Create New Quote
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // TODO: Implement send to customer
            alert('Send to customer functionality coming soon')
          }}
        >
          Send to Customer
        </Button>
      </div>
    </div>
  )
}
