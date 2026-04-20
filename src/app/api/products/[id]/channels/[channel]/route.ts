import { NextRequest, NextResponse } from 'next/server'
import {
  requireProductsStaffAccess,
  requireUniformsProduct,
  dbErrorResponse,
} from '@/lib/products/server'
import { isChannel, rowsToChannelsMap } from '@/lib/products/channels'

type PutState = 'off' | 'active' | 'inactive'
const VALID_STATES: ReadonlySet<string> = new Set<PutState>(['off', 'active', 'inactive'])

function isPutState(v: unknown): v is PutState {
  return typeof v === 'string' && VALID_STATES.has(v)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; channel: string }> }
) {
  const access = await requireProductsStaffAccess()
  if (access.error) return access.error

  const { id, channel } = await params
  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel.' }, { status: 400 })
  }

  const existing = await requireUniformsProduct(id)
  if (existing.error) return existing.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const state = (body as Record<string, unknown>)?.state
  if (!isPutState(state)) {
    return NextResponse.json({ error: 'Invalid state. Expected off | active | inactive.' }, { status: 400 })
  }

  if (state === 'off') {
    const { error } = await access.admin
      .from('product_type_activations')
      .delete()
      .eq('product_id', id)
      .eq('product_type', channel)
    if (error) return dbErrorResponse(error, 'Failed to remove channel.')
  } else {
    const { error } = await access.admin
      .from('product_type_activations')
      .upsert(
        {
          product_id: id,
          product_type: channel,
          is_active: state === 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,product_type' }
      )
    if (error) return dbErrorResponse(error, 'Failed to set channel state.')
  }

  const { data: rows, error: readErr } = await access.admin
    .from('product_type_activations')
    .select('product_type,is_active')
    .eq('product_id', id)
  if (readErr) return dbErrorResponse(readErr, 'Failed to re-read channels.')

  return NextResponse.json({ channels: rowsToChannelsMap(rows) })
}
