'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Org {
  id: string
  name: string
}

export function TrackOrgPicker() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Org[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!open || q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/organizations/search?q=${encodeURIComponent(q)}`)
      if (r.ok) {
        const json = (await r.json()) as { orgs?: Org[] }
        setResults(json.orgs ?? [])
      }
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Track new customer</Button>
  }

  return (
    <div className="flex flex-col gap-2 w-80">
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search organisations…"
      />
      <div className="border rounded-2xl bg-white max-h-64 overflow-auto">
        {results.map((o) => (
          <button
            key={o.id}
            onClick={() => router.push(`/inventory/${o.id}`)}
            className="block w-full text-left px-3 py-2 hover:bg-gray-50"
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
