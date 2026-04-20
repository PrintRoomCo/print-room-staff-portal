'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

function normalise(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (t.length === 0) return null
  if (t.length > 48) return null
  if (!/^[a-z0-9][a-z0-9\- ]*$/.test(t)) return null
  return t
}

export function TagPicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = draft.trim().toLowerCase()
    if (q.length === 0) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const run = async () => {
      const res = await fetch(`/api/products/tags?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const json = await res.json()
      if (cancelled) return
      const names = Array.isArray(json.tags) ? (json.tags as string[]) : []
      setSuggestions(names.filter(n => !value.includes(n)).slice(0, 8))
    }
    void run()
    return () => { cancelled = true }
  }, [draft, value])

  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addTag(raw: string) {
    const n = normalise(raw)
    if (!n) return
    if (value.includes(n)) {
      setDraft('')
      return
    }
    onChange([...value, n])
    setDraft('')
  }

  function removeTag(name: string) {
    onChange(value.filter(t => t !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-gray-600">Tags</legend>
      <div ref={wrapRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <Input
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={e => { setDraft(e.target.value); setOpen(true) }}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? 'Type a tag name or select existing' : ''}
            className="flex-1 min-w-[10rem] bg-transparent border-0 px-1 py-0 shadow-none focus:ring-0"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  )
}
