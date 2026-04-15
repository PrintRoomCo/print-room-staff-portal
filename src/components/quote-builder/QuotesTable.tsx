'use client'

import Link from 'next/link'
import { ArrowDownUp, History, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QuoteStatusBadge } from '@/components/quote-builder/QuoteStatusBadge'
import { formatNZD } from '@/lib/quote-builder/pricing'
import type { QuoteListItem } from '@/lib/quote-builder/types'
import { useState } from 'react'

type SortField = 'customerName' | 'quoteReference' | 'accountManager' | 'createdAt' | 'status' | 'total'

interface QuotesTableProps {
  quotes: QuoteListItem[]
  onOpenHistory: (quote: QuoteListItem) => void
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function QuotesTable({ quotes, onOpenHistory }: QuotesTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  function handleSort(field: SortField) {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
        return currentField
      }

      setSortDirection(field === 'customerName' ? 'asc' : 'desc')
      return field
    })
  }

  const sortedQuotes = [...quotes].sort((left, right) => {
    const getValue = (quote: QuoteListItem) => {
      switch (sortField) {
        case 'customerName':
          return quote.customerName.toLowerCase()
        case 'quoteReference':
          return quote.quoteReference.toLowerCase()
        case 'accountManager':
          return quote.accountManager.toLowerCase()
        case 'status':
          return String(quote.status).toLowerCase()
        case 'total':
          return quote.total
        case 'createdAt':
        default:
          return new Date(quote.createdAt).getTime()
      }
    }

    const leftValue = getValue(left)
    const rightValue = getValue(right)

    if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1
    if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <SortableHead label="Customer Name" onClick={() => handleSort('customerName')} />
              <SortableHead label="Quote Reference" onClick={() => handleSort('quoteReference')} />
              <SortableHead label="Account Manager" onClick={() => handleSort('accountManager')} />
              <SortableHead label="Date Created" onClick={() => handleSort('createdAt')} />
              <SortableHead label="Status" onClick={() => handleSort('status')} />
              <SortableHead label="Quote Value" onClick={() => handleSort('total')} align="right" />
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedQuotes.map((quote) => (
              <tr key={quote.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{quote.customerName}</div>
                  {quote.customerEmail ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">{quote.customerEmail}</div>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-muted-foreground">{quote.quoteReference || 'Pending'}</td>
                <td className="px-4 py-4 text-muted-foreground">{quote.accountManager || 'Unassigned'}</td>
                <td className="px-4 py-4 text-muted-foreground">{formatDate(quote.createdAt)}</td>
                <td className="px-4 py-4">
                  <QuoteStatusBadge status={String(quote.status)} />
                </td>
                <td className="px-4 py-4 text-right font-medium text-foreground">{formatNZD(quote.total || 0)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/quote-tool/${quote.id}/edit`}>
                      <Button variant="secondary" size="sm">
                        <Pencil className="mr-2 h-4 w-4" />
                        View / Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => onOpenHistory(quote)}>
                      <History className="mr-2 h-4 w-4" />
                      History
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No quotes match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function SortableHead({
  label,
  onClick,
  align = 'left',
}: {
  label: string
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th className={`px-4 py-3 font-medium text-muted-foreground ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <ArrowDownUp className="h-3.5 w-3.5" />
      </button>
    </th>
  )
}
