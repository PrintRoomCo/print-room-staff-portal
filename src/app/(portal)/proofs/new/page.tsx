'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/image-generator/header'
import { PresentationField } from '@/components/presentations/presentation-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface OrganizationOption {
  id: string
  name: string
}

export default function NewProofPage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [form, setForm] = useState({
    organizationId: '',
    customerName: '',
    customerEmail: '',
    jobName: '',
    jobReference: '',
  })
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations')
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to fetch organizations')
        }

        const payload = await response.json()
        setOrganizations(payload.organizations || [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch organizations')
      } finally {
        setLoadingOrganizations(false)
      }
    }

    fetchOrganizations()
  }, [])

  function updateForm(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function createProof() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to create proof')
      }

      const payload = await response.json()
      router.push(`/proofs/${payload.proof.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create proof')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link
          href="/proofs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to proofs
        </Link>
      </div>

      <Header title="Create proof" />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proof details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <PresentationField label="Organization">
            <select
              value={form.organizationId}
              onChange={event => updateForm('organizationId', event.target.value)}
              disabled={loadingOrganizations}
              className="flex h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-5 text-sm text-foreground transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:outline-none focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]"
            >
              <option value="">{loadingOrganizations ? 'Loading organizations...' : 'Select organization'}</option>
              {organizations.map(organization => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </PresentationField>
          <PresentationField label="Customer name">
            <Input
              value={form.customerName}
              onChange={event => updateForm('customerName', event.target.value)}
              placeholder="Allpress Espresso"
            />
          </PresentationField>
          <PresentationField label="Customer email">
            <Input
              type="email"
              value={form.customerEmail}
              onChange={event => updateForm('customerEmail', event.target.value)}
              placeholder="client@example.com"
            />
          </PresentationField>
          <PresentationField label="Job name">
            <Input
              value={form.jobName}
              onChange={event => updateForm('jobName', event.target.value)}
              placeholder="Allpress Espresso"
            />
          </PresentationField>
          <PresentationField label="Job reference">
            <Input
              value={form.jobReference}
              onChange={event => updateForm('jobReference', event.target.value)}
              placeholder="APR-2026"
            />
          </PresentationField>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="accent" onClick={createProof} disabled={saving || loadingOrganizations}>
          {saving ? 'Creating...' : 'Create proof'}
        </Button>
        <Link href="/proofs">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
