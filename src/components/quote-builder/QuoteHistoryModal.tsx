'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageSquarePlus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { QuoteHistory, QuoteListItem } from '@/lib/quote-builder/types'

interface QuoteHistoryModalProps {
  quote: QuoteListItem | null
  onClose: () => void
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function QuoteHistoryModal({ quote, onClose }: QuoteHistoryModalProps) {
  const [history, setHistory] = useState<QuoteHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState('Internal note')
  const [noteBody, setNoteBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!quote) return

    let isCancelled = false

    async function fetchHistory() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/quote-builder/quotes/${quote.id}/history`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`History request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const nextHistory = Array.isArray(payload)
          ? payload as QuoteHistory[]
          : Array.isArray(payload.history)
            ? payload.history as QuoteHistory[]
            : []

        if (!isCancelled) {
          setHistory(nextHistory)
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to load history')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchHistory()

    return () => {
      isCancelled = true
    }
  }, [quote])

  useEffect(() => {
    if (!quote) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose, quote])

  if (!quote) {
    return null
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/quote-builder/quotes/${quote.id}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: noteTitle,
          detail: noteBody.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(`History note failed with status ${response.status}`)
      }

      const payload = await response.json()
      const entry = payload.history || payload.entry || payload.note

      if (entry) {
        setHistory((current) => [entry as QuoteHistory, ...current])
      }

      setNoteBody('')
      setNoteTitle('Internal note')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to add history note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Quote History</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.customerName} · {quote.quoteReference || 'No reference'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close history modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="grid grid-cols-[180px_140px_1fr] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <span>Date</span>
              <span>User</span>
              <span>Detail</span>
            </div>
            <div className="max-h-[58vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history…
                </div>
              ) : error ? (
                <div className="px-5 py-12 text-center text-sm text-destructive">{error}</div>
              ) : history.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No history entries yet.
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[180px_140px_1fr] gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
                    <div className="text-muted-foreground">{formatDate(entry.date)}</div>
                    <div className="font-medium text-foreground">{entry.user_name}</div>
                    <div>
                      <div className="font-medium text-foreground">{entry.action}</div>
                      <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{entry.detail}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[rgb(var(--color-brand-blue))]/10 p-3 text-[rgb(var(--color-brand-blue))]">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Add note</h3>
                <p className="text-sm text-muted-foreground">Append a comment to the quote audit log.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Action</label>
                <Input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Internal note" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Detail</label>
                <Textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Add context for the team"
                />
              </div>

              <Button variant="accent" className="w-full" disabled={saving || !noteBody.trim()} onClick={handleAddNote}>
                {saving ? 'Saving note…' : 'Add history note'}
              </Button>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  )
}
