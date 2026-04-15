'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Send, Copy } from 'lucide-react'
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

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'gray'> = {
  draft: 'gray',
  sent: 'info',
  accepted: 'success',
  rejected: 'destructive',
  expired: 'warning',
  converted: 'success',
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
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="max-w-4xl space-y-6">
        <Link href="/quote-tool/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to quotes
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Quote not found</h2>
          <p className="text-muted-foreground text-sm mt-2">{error || 'This quote may have been deleted.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Back link + page header */}
      <div>
        <Link href="/quote-tool/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to quotes
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {quote.customer_name || 'Unnamed Quote'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDate(quote.created_at)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[quote.status] || 'gray'} className="text-sm px-3 py-1">
            {quote.status}
          </Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(quote.subtotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Discount</p>
          <p className="text-2xl font-semibold text-foreground">{quote.discount_percent ?? 0}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(quote.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Valid Until</p>
          <p className="text-lg font-semibold text-foreground">
            {quote.valid_until
              ? new Date(quote.valid_until).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </Card>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-foreground">{quote.customer_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{quote.customer_email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium text-foreground">{quote.customer_company || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium text-foreground">{quote.customer_phone || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quote Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quote ID</span>
              <span className="font-mono text-xs text-muted-foreground">{quote.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium text-foreground">{formatDate(quote.updated_at)}</span>
            </div>
            {quote.monday_item_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monday.com</span>
                <span className="font-medium text-foreground">#{quote.monday_item_id}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff notes */}
      {quote.staff_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.staff_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="accent" onClick={() => router.push('/quote-tool')}>
          <FileText className="w-4 h-4 mr-2" />
          New Quote
        </Button>
        <Button
          variant="secondary"
          onClick={() => alert('Send to customer functionality coming soon')}
        >
          <Send className="w-4 h-4 mr-2" />
          Send to Customer
        </Button>
        <Button
          variant="secondary"
          onClick={() => alert('Duplicate functionality coming soon')}
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </Button>
      </div>
    </div>
  )
}
