'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export type B2BOnlyValue = 'master' | 'both' | 'only'

export function B2BOnlyFilter() {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const value = (sp.get('b2b_only') as B2BOnlyValue | null) ?? 'master'

  function set(v: B2BOnlyValue) {
    const params = new URLSearchParams(sp.toString())
    if (v === 'master') params.delete('b2b_only')
    else params.set('b2b_only', v)
    router.push(`${path}?${params.toString()}`)
  }

  return (
    <select
      className="rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm"
      value={value}
      onChange={(e) => set(e.target.value as B2BOnlyValue)}
    >
      <option value="master">Master only</option>
      <option value="both">Master + B2B-only</option>
      <option value="only">B2B-only</option>
    </select>
  )
}
