'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CatalogueEditorCatalogue } from './CatalogueEditor'

export function CatalogueSettingsForm({
  catalogue,
}: {
  catalogue: CatalogueEditorCatalogue
}) {
  const router = useRouter()
  const [name, setName] = useState(catalogue.name)
  const [description, setDescription] = useState(catalogue.description ?? '')
  const [isActive, setIsActive] = useState(catalogue.is_active)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [confirmStep, setConfirmStep] = useState(0) // 0 idle, 1 confirm, 2 deleting

  async function save() {
    setBusy(true)
    setError(null)
    setSavedAt(null)
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      is_active: isActive,
    }
    const r = await fetch(`/api/catalogues/${catalogue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Save failed')
      setBusy(false)
      return
    }
    setSavedAt(new Date().toLocaleTimeString())
    setBusy(false)
    router.refresh()
  }

  async function doDelete() {
    setConfirmStep(2)
    setError(null)
    const r = await fetch(`/api/catalogues/${catalogue.id}`, {
      method: 'DELETE',
    })
    if (!r.ok && r.status !== 204) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Delete failed')
      setConfirmStep(1)
      return
    }
    router.push('/catalogues')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-3">
        <label className="block text-sm">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Description
          <Textarea
            className="mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="accent"
            onClick={save}
            disabled={busy || !name.trim()}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
          {savedAt && (
            <span className="text-xs text-gray-500">Saved at {savedAt}</span>
          )}
        </div>
      </div>

      <div className="rounded border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
        <p className="mt-1 text-xs text-red-700">
          Deleting this catalogue removes all its items and pricing tiers. Master products are not affected.
        </p>
        {confirmStep === 0 && (
          <Button
            type="button"
            variant="danger"
            className="mt-3"
            onClick={() => setConfirmStep(1)}
          >
            Delete catalogue…
          </Button>
        )}
        {confirmStep === 1 && (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={doDelete}
            >
              Yes, permanently delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmStep(0)}
            >
              Cancel
            </Button>
          </div>
        )}
        {confirmStep === 2 && (
          <p className="mt-3 text-sm text-red-700">Deleting…</p>
        )}
      </div>
    </div>
  )
}
