'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProductSearchResult {
  id: string
  name: string
  image_url: string | null
}

interface TrackProductPickerProps {
  orgId: string
}

export function TrackProductPicker({ orgId }: TrackProductPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/products/search?q=${encodeURIComponent(trimmed)}`
        )
        if (!r.ok || cancelled) return
        const json = await r.json()
        if (!cancelled) setResults(json.products ?? [])
      } catch {
        if (!cancelled) setResults([])
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        setResults([])
        setErrorMsg(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function track(productId: string) {
    setBusy(true)
    setErrorMsg(null)
    try {
      const r = await fetch(`/api/inventory/${orgId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        setErrorMsg(err.error ?? 'Failed to track product')
        setBusy(false)
        return
      }
      setOpen(false)
      setQuery('')
      setResults([])
      setBusy(false)
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to track product')
      setBusy(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Track new product</Button>
  }

  return (
    <div className="flex flex-col gap-2 w-80">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products…"
      />
      {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
      <div className="border rounded-2xl bg-white max-h-64 overflow-auto shadow-sm">
        {results.length === 0 && query.trim().length >= 2 && (
          <div className="px-3 py-2 text-xs text-gray-500">No matches.</div>
        )}
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            onClick={() => track(p.id)}
            className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                width={32}
                height={32}
                className="rounded object-cover w-8 h-8 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
            )}
            <span className="truncate text-sm">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setQuery('')
            setResults([])
            setErrorMsg(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
