'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

type SearchHit = {
  id: string
  name: string
  image_url?: string | null
  sku?: string | null
}

export function AddFromMasterDialog({
  catalogueId,
  onClose,
  onAdded,
}: {
  catalogueId: string
  onClose: () => void
  onAdded: () => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/products/search?q=${encodeURIComponent(query.trim())}`,
        )
        if (!r.ok) {
          setError('Search failed')
          setResults([])
          return
        }
        const d = (await r.json()) as { products?: SearchHit[] }
        setResults(d.products ?? [])
        setError(null)
      } catch {
        setError('Search failed')
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function add(productId: string) {
    setAdding(productId)
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogueId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_product_id: productId }),
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Add failed')
      setAdding(null)
      return
    }
    setAdding(null)
    await onAdded()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add from master products"
      description="Search for an existing master product to copy into this catalogue. Master pricing tiers will auto-copy."
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Input
        autoFocus
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-3 max-h-80 overflow-y-auto">
        {error && (
          <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {query.trim().length < 2 ? (
          <p className="text-sm text-gray-500">
            Type at least 2 characters to search.
          </p>
        ) : loading ? (
          <p className="text-sm text-gray-500">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500">No matching products.</p>
        ) : (
          <ul className="divide-y">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-100" />
                )}
                <div className="flex-1">
                  <div className="text-sm">{p.name}</div>
                  {p.sku && (
                    <div className="text-xs text-gray-500">{p.sku}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => add(p.id)}
                  disabled={adding === p.id}
                >
                  {adding === p.id ? 'Adding…' : 'Add'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
