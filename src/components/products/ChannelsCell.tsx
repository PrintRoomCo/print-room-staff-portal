import { CHANNEL_LABELS, CHANNELS, type ChannelsMap } from '@/types/products'

interface Props {
  channels: ChannelsMap
}

export function ChannelsCell({ channels }: Props) {
  const parts: string[] = []
  for (const channel of CHANNELS) {
    const state = channels[channel]
    if (!state) continue
    const label = CHANNEL_LABELS[channel]
    parts.push(state === 'inactive' ? `${label} (paused)` : label)
  }

  if (parts.length === 0) {
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <span className="text-xs text-gray-600">
      {parts.join(' · ')}
    </span>
  )
}
