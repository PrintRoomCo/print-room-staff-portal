'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { Card } from '@/components/ui/card'
import { QuoteFilters } from '@/components/quote-builder/QuoteFilters'
import { QuoteHistoryModal } from '@/components/quote-builder/QuoteHistoryModal'
import { QuoteStatsCards } from '@/components/quote-builder/QuoteStatsCards'
import { QuotesTable } from '@/components/quote-builder/QuotesTable'
import type {
  QuoteBuilderDashboardCounts,
  QuoteBuilderDashboardPayload,
  QuoteListItem,
} from '@/lib/quote-builder/types'

function emptyCounts(): QuoteBuilderDashboardCounts {
  return {
    total: 0,
    created: 0,
    accepted: 0,
    declined: 0,
  }
}

function normalizeQuote(raw: Record<string, unknown>): QuoteListItem {
  return {
    id: String(raw.id || ''),
    quoteReference: String(raw.quoteReference || raw.quote_reference || raw.reference || ''),
    customerName: String(raw.customerName || raw.customer_name || 'Unnamed Quote'),
    customerEmail: typeof raw.customerEmail === 'string'
      ? raw.customerEmail
      : typeof raw.customer_email === 'string'
        ? raw.customer_email
        : '',
    accountManager: String(raw.accountManager || raw.account_manager || raw.manager || ''),
    status: String(raw.status || 'created'),
    subtotal: typeof raw.subtotal === 'number' ? raw.subtotal : 0,
    total: typeof raw.total === 'number' ? raw.total : 0,
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.updated_at || raw.created_at || new Date().toISOString()),
  }
}

function deriveCounts(quotes: QuoteListItem[]): QuoteBuilderDashboardCounts {
  return quotes.reduce<QuoteBuilderDashboardCounts>((totals, quote) => {
    totals.total += 1
    if (String(quote.status) === 'created') totals.created += 1
    if (String(quote.status) === 'accepted') totals.accepted += 1
    if (String(quote.status) === 'declined') totals.declined += 1
    return totals
  }, emptyCounts())
}

export function QuotesDashboard() {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [counts, setCounts] = useState<QuoteBuilderDashboardCounts>(emptyCounts())
  const [managerOptions, setManagerOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const [historyQuote, setHistoryQuote] = useState<QuoteListItem | null>(null)

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let isCancelled = false

    async function fetchQuotes() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/quote-builder/quotes', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Quote dashboard request failed with status ${response.status}`)
        }

        const payload = await response.json() as QuoteBuilderDashboardPayload | { quotes?: Record<string, unknown>[] }
        const rawQuotes = Array.isArray(payload)
          ? payload as unknown as Record<string, unknown>[]
          : Array.isArray(payload.quotes)
            ? payload.quotes as unknown as Record<string, unknown>[]
            : []

        const nextQuotes = rawQuotes.map(normalizeQuote)
        const nextCounts = payload && 'counts' in payload && payload.counts
          ? { ...emptyCounts(), ...payload.counts }
          : deriveCounts(nextQuotes)
        const nextManagers = payload && 'managers' in payload && Array.isArray(payload.managers)
          ? payload.managers.filter(Boolean)
          : Array.from(new Set(nextQuotes.map((quote) => quote.accountManager).filter(Boolean))).sort()

        if (!isCancelled) {
          setQuotes(nextQuotes)
          setCounts(nextCounts)
          setManagerOptions(nextManagers)
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to load quote dashboard')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchQuotes()

    return () => {
      isCancelled = true
    }
  }, [])

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch = deferredSearch.trim()
      ? [
          quote.customerName,
          quote.quoteReference,
          quote.accountManager,
        ].some((value) => value.toLowerCase().includes(deferredSearch.toLowerCase()))
      : true
    const matchesStatus = statusFilter === 'all' || String(quote.status) === statusFilter
    const matchesManager = managerFilter === 'all' || quote.accountManager === managerFilter

    return matchesSearch && matchesStatus && matchesManager
  })

  return (
    <div className="space-y-8">
      <Header
        title="Quote Builder"
        description="Native dashboard for staff quote creation, filtering, and audit history."
      />

      <QuoteStatsCards counts={counts} />

      <QuoteFilters
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        manager={managerFilter}
        onManagerChange={setManagerFilter}
        managers={managerOptions}
      />

      {loading ? (
        <Card className="flex items-center justify-center p-16 text-sm text-muted-foreground">
          Loading quote dashboard…
        </Card>
      ) : error ? (
        <Card className="border-red-100 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h2 className="font-medium text-red-900">Quote builder API unavailable</h2>
              <p className="mt-1 text-sm text-red-800">{error}</p>
              <p className="mt-2 text-sm text-red-800/80">
                This dashboard is wired to the new `/api/quote-builder/*` routes and will start filling once those endpoints are available.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <QuotesTable quotes={filteredQuotes} onOpenHistory={setHistoryQuote} />
          <p className="text-sm text-muted-foreground">
            Showing {filteredQuotes.length} of {quotes.length} quotes
          </p>
        </>
      )}

      <QuoteHistoryModal quote={historyQuote} onClose={() => setHistoryQuote(null)} />
    </div>
  )
}
