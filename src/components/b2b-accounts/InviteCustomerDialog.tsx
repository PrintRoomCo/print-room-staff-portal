'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface InviteCustomerDialogProps {
  organizationId: string
  organizationName: string
}

export function InviteCustomerDialog({
  organizationId,
  organizationName,
}: InviteCustomerDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/b2b-accounts/${organizationId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          role: 'member',
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Invite failed (${res.status})`)
      }
      setMessage(`Invite sent to ${email.trim().toLowerCase()}`)
      setEmail('')
      setFirstName('')
      setLastName('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Invite customer
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite customer"
        description={`Send a magic-link invite for ${organizationName}.`}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={busy || !email.trim() || !firstName.trim()}
            >
              {busy ? 'Sending...' : 'Send invite'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600" htmlFor="invite-email">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600" htmlFor="invite-first">
                First name
              </label>
              <Input
                id="invite-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jamie"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600" htmlFor="invite-last">
                Last name
              </label>
              <Input
                id="invite-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Customer"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Phase A invites create a member-level portal user for this organization.
          </p>
          {message && <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p>}
          {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
