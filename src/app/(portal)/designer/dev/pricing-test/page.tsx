import { calculateEmbroideryPriceV2 } from '@print-room-studio/pricing'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// Phase 1 demo gate. Removable once Phase 2 + Phase 3 wire pricing into the real canvas.
//
// The `as never` cast on `supabase` is a workaround for a known file: protocol type-clash:
// the package's dist/.d.ts files reference `@supabase/supabase-js@2.83.0` (the version
// resolved inside the studio monorepo at build time), while the staff portal resolves
// `@supabase/supabase-js@2.103.0` from its own node_modules. The two versions are
// structurally compatible at runtime but nominally distinct types. Two clean fixes:
//   (1) align the supabase-js version pinned in `print-room-studio/packages/pricing`
//       and re-publish the dist, OR
//   (2) consume the pricing package source directly (drop the dist build) via a tsconfig
//       `paths` alias. Both are out of scope for Phase 1.
type EmbroiderySupabaseArg = Parameters<typeof calculateEmbroideryPriceV2>[0]

export default async function PricingTestPage() {
  const supabase = getSupabaseAdmin()

  let result: unknown
  let error: string | null = null

  try {
    result = await calculateEmbroideryPriceV2(supabase as unknown as EmbroiderySupabaseArg, {
      qty: 50,
      widthMm: 80,
      heightMm: 80,
      garmentFamily: 'apparel',
      detailLevel: 'standard',
    })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Designer · Pricing test</h1>
      <p className="text-sm text-gray-500">
        Phase 1 demo gate — calls{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
          calculateEmbroideryPriceV2
        </code>{' '}
        from{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
          @print-room-studio/pricing
        </code>{' '}
        with sample inputs (qty=50, 80×80mm apparel, standard detail). A non-null result confirms
        the workspace dep is wired and the RPCs respond.
      </p>
      {error ? (
        <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-800">{error}</pre>
      ) : (
        <pre className="rounded-lg bg-gray-50 p-4 text-xs text-gray-800">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
