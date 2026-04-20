export const PRODUCT_TYPE_TAGS = ['workwear', 'preorder', 'b2b'] as const
export type ProductTypeTag = (typeof PRODUCT_TYPE_TAGS)[number]

/** Tags that pre-existed; preserved on save, no UI to add/remove in v1. */
export const RESERVED_TAGS = ['leavers', 'design-tool'] as const
export type ReservedTag = (typeof RESERVED_TAGS)[number]

export const ALLOWED_TAGS = [...PRODUCT_TYPE_TAGS, ...RESERVED_TAGS] as const
export type AllowedTag = (typeof ALLOWED_TAGS)[number]

export const PRODUCT_TYPE_TAG_LABELS: Record<ProductTypeTag, string> = {
  workwear: 'Workwear',
  preorder: 'Pre-order',
  b2b: 'B2B',
}

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_TAGS)

/**
 * Server-side guard. Filters incoming tags to only the controlled vocabulary.
 * Reserved tags currently on a product are preserved by the caller before
 * passing user-edited type tags through this guard.
 */
export function sanitiseProductTags(input: unknown): AllowedTag[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: AllowedTag[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    if (!ALLOWED_SET.has(value)) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value as AllowedTag)
  }
  return out
}

/**
 * Merge user-edited type tags with the reserved tags that were already on
 * the product. Used in PATCH handlers so a user editing Details cannot
 * inadvertently strip 'leavers' or 'design-tool'.
 */
export function mergeWithReservedTags(
  userTypeTags: readonly string[],
  existingTags: readonly string[]
): AllowedTag[] {
  const reservedFromExisting = existingTags.filter(
    (t): t is ReservedTag => (RESERVED_TAGS as readonly string[]).includes(t)
  )
  const sanitisedUser = sanitiseProductTags(userTypeTags).filter(
    t => !(RESERVED_TAGS as readonly string[]).includes(t)
  )
  return [...sanitisedUser, ...reservedFromExisting]
}
