import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

/**
 * v1 hard-codes the products sub-app to the 'uniforms' platform slice.
 * v1.1 will make this user-selectable; centralising the filter here lets
 * us swap call sites in one place.
 */
export const PLATFORM_SCOPE = 'uniforms' as const

export function withUniformsScope<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends PostgrestFilterBuilder<any, any, any, any>
>(query: T): T {
  return query.eq('platform', PLATFORM_SCOPE) as T
}
