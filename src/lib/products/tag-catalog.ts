import type { SupabaseClient } from '@supabase/supabase-js'

/** Max length for a tag. Keeps the catalog sensible without a DB constraint. */
const MAX_TAG_LEN = 48

const ALLOWED_CHAR = /^[a-z0-9][a-z0-9\- ]*$/

/** Normalise a user-entered tag name: trim, lowercase, collapse inner whitespace. Returns null if invalid / empty. */
export function sanitiseTagName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return null
  if (trimmed.length > MAX_TAG_LEN) return null
  if (!ALLOWED_CHAR.test(trimmed)) return null
  return trimmed
}

/** Sanitise an array of tag inputs and de-duplicate. Preserves first-seen order. */
export function sanitiseTagArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const name = sanitiseTagName(raw)
    if (!name) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

/** Upsert tag names into product_tag_catalog. Quiet on conflict — we only care that each name exists. */
export async function upsertTagCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  names: readonly string[],
  createdBy: string | null
): Promise<void> {
  if (names.length === 0) return
  const rows = names.map(name => ({ name, created_by: createdBy }))
  await admin
    .from('product_tag_catalog')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })
}

/** Read the catalog, optionally filtered by prefix for autocomplete. */
export async function readTagCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  prefix: string | null
): Promise<string[]> {
  let q = admin.from('product_tag_catalog').select('name').order('name')
  if (prefix && prefix.length > 0) {
    const safe = prefix.replace(/[%_]/g, '')
    q = q.ilike('name', `${safe}%`)
  }
  const { data, error } = await q.limit(500)
  if (error || !data) return []
  return data.map(r => r.name as string)
}
