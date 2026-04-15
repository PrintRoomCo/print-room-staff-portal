'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface StaffQuote {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_company: string | null
  status: string
  subtotal: number | null
  discount_percent: number | null
  total: number | null
  staff_notes: string | null
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SavedQuotesPage() {
  const [quotes, setQuotes] = useState<StaffQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchQuotes() {
      try {
        const res = await fetch('/api/quote-tool/quotes')
        if (!res.ok) throw new Error('Failed to fetch quotes')
        const data = await res.json()
        setQuotes(data.quotes || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quotes')
      } finally {
        setLoading(false)
      }
    }
    fetchQuotes()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <Header title="Saved Quotes" description="View and manage quotes created for customers" />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Header title="Saved Quotes" description="View and manage quotes created for customers" />
        <div className="text-center py-12 text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Header
        title="Saved Quotes"
        description="View and manage quotes created for customers"
        action={
          <Link href="/quote-tool/new">
            <Button variant="accent">New Quote</Button>
          </Link>
        }
      />

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">No quotes yet</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-md">
            Create your first quote to get started. Quotes will appear here once saved.
          </p>
          <Link href="/quote-tool/new" className="mt-6">
            <Button variant="accent">New Quote</Button>
          </Link>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quote-tool/quotes/${quote.id}`} className="font-medium text-foreground hover:underline">
                      {quote.customer_name || 'Unnamed'}
                    </Link>
                    {quote.customer_email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{quote.customer_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{quote.customer_company || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[quote.status] || 'gray'}>
                      {quote.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(quote.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(quote.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
