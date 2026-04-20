import type { Channel, ChannelsMap, ChannelState } from '@/types/products'
import { CHANNELS } from '@/types/products'

export { CHANNELS }
export type { Channel, ChannelState, ChannelsMap }

const CHANNEL_SET: ReadonlySet<string> = new Set(CHANNELS)

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && CHANNEL_SET.has(value)
}

/** Row shape returned by the PostgREST nested select `channels:product_type_activations(product_type,is_active)`. */
export interface ChannelRow {
  product_type: string
  is_active: boolean
}

/** Transform the nested-select array into a ChannelsMap. Silently drops rows with unknown channel names — the DB CHECK prevents this in practice. */
export function rowsToChannelsMap(rows: unknown): ChannelsMap {
  if (!Array.isArray(rows)) return {}
  const out: ChannelsMap = {}
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Partial<ChannelRow>
    if (!isChannel(r.product_type)) continue
    out[r.product_type] = r.is_active ? 'active' : 'inactive'
  }
  return out
}
