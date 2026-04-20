'use client'

import { useState } from 'react'
import { CHANNEL_LABELS, CHANNELS, type Channel, type ChannelsMap } from '@/types/products'

type Cell = 'off' | 'active' | 'inactive'

interface Props {
  productId: string
  channels: ChannelsMap
  onChange: (next: ChannelsMap) => void
}

export function ChannelControlRow({ productId, channels, onChange }: Props) {
  const [busy, setBusy] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setCell(channel: Channel, next: Cell) {
    setBusy(channel)
    setError(null)
    try {
      const res = await fetch(
        `/api/products/${productId}/channels/${channel}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: next }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to update channel.')
        return
      }
      onChange(json.channels as ChannelsMap)
    } finally {
      setBusy(null)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-gray-600">Channels</legend>
      <div className="flex flex-col gap-1.5">
        {CHANNELS.map(channel => {
          const current: Cell = channels[channel] ?? 'off'
          const isBusy = busy === channel
          return (
            <div key={channel} className="flex items-center gap-3">
              <span className="text-sm text-foreground w-24">{CHANNEL_LABELS[channel]}</span>
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5">
                {(['off', 'active', 'inactive'] as const).map(cell => {
                  const selected = current === cell
                  return (
                    <button
                      key={cell}
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (cell !== current) void setCell(channel, cell)
                      }}
                      className={
                        'px-3 py-1 text-xs rounded-full transition-colors ' +
                        (selected
                          ? 'bg-white shadow text-foreground'
                          : 'text-gray-500 hover:text-foreground')
                      }
                    >
                      {cell === 'off' ? 'Off' : cell === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </fieldset>
  )
}
