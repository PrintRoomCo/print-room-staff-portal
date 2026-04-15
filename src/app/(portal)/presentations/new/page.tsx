'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { PresentationField } from '@/components/presentations/presentation-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function NewPresentationPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    clientName: '',
    clientBrand: '',
    proposalTitle: '',
    seasonLabel: '',
    coverDateLabel: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createPresentation() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to create presentation')
      }

      const payload = await response.json()
      router.push(`/presentations/${payload.presentation.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create presentation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link
          href="/presentations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to presentations
        </Link>
      </div>

      <Header
        title="Create proposal"
        description="Start from the Print Room reusable proposal template and tailor it to a client brief."
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proposal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <PresentationField label="Client name">
            <Input
              value={form.clientName}
              onChange={event => setForm(current => ({ ...current, clientName: event.target.value }))}
              placeholder="Four Square"
            />
          </PresentationField>
          <PresentationField label="Client brand">
            <Input
              value={form.clientBrand}
              onChange={event => setForm(current => ({ ...current, clientBrand: event.target.value }))}
              placeholder="Four Square"
            />
          </PresentationField>
          <PresentationField label="Proposal title">
            <Input
              value={form.proposalTitle}
              onChange={event => setForm(current => ({ ...current, proposalTitle: event.target.value }))}
              placeholder="Proposed product range"
            />
          </PresentationField>
          <PresentationField label="Season label">
            <Input
              value={form.seasonLabel}
              onChange={event => setForm(current => ({ ...current, seasonLabel: event.target.value }))}
              placeholder="Summer 2026/27"
            />
          </PresentationField>
          <PresentationField label="Cover date">
            <Input
              value={form.coverDateLabel}
              onChange={event => setForm(current => ({ ...current, coverDateLabel: event.target.value }))}
              placeholder="April 2026"
            />
          </PresentationField>
          <div className="md:col-span-2">
            <PresentationField label="Internal notes">
              <Textarea
                value={form.notes}
                onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                placeholder="Optional brief notes for the proposal"
              />
            </PresentationField>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="accent" onClick={createPresentation} disabled={saving}>
          {saving ? 'Creating...' : 'Create proposal'}
        </Button>
        <Link href="/presentations">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
