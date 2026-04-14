'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Saved Quotes</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Saved Quotes</h1>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Saved Quotes</h1>
        <Link
          href="/quote-tool"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No quotes yet. Create your first quote to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{quote.customer_name || '—'}</p>
                      {quote.customer_email && (
                        <p className="text-xs text-gray-500">{quote.customer_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{quote.customer_company || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_COLORS[quote.status] || 'secondary'}>
                      {quote.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(quote.total)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(quote.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/quote-tool/quotes/${quote.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
