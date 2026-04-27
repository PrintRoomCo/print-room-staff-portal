'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Row = {
  id: string
  name: string
  organization_id: string
  discount_pct: number
  is_active: boolean
  created_at: string
  organizations: { name: string } | { name: string }[]
  items: { count: number }[] | null
}

type Org = { id: string; name: string }

export function CataloguesTable({
  rows,
  count,
  page,
  limit,
}: {
  rows: Row[]
  count: number
  page: number
  limit: number
}) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [orgs, setOrgs] = useState<Org[]>([])

  useEffect(() => {
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations ?? []))
      .catch(() => setOrgs([]))
  }, [])

  function setParam(k: string, v: string) {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set(k, v)
    else p.delete(k)
    p.delete('page')
    router.push(`${path}?${p.toString()}`)
  }

  function gotoPage(n: number) {
    const p = new URLSearchParams(sp.toString())
    p.set('page', String(n))
    router.push(`${path}?${p.toString()}`)
  }

  const totalPages = Math.max(1, Math.ceil(count / limit))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          defaultValue={sp.get('q') ?? ''}
          placeholder="Search by name…"
          className="rounded border-gray-300 text-sm"
          onBlur={(e) => setParam('q', e.target.value)}
        />
        <select
          className="rounded border-gray-300 text-sm"
          value={sp.get('org') ?? ''}
          onChange={(e) => setParam('org', e.target.value)}
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border-gray-300 text-sm"
          value={sp.get('active') ?? ''}
          onChange={(e) => setParam('active', e.target.value)}
        >
          <option value="">Active + inactive</option>
          <option value="yes">Active only</option>
          <option value="no">Inactive only</option>
        </select>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Organization</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Discount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                No catalogues yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const orgName = Array.isArray(r.organizations)
                ? r.organizations[0]?.name
                : r.organizations?.name
              const itemsCount = r.items?.[0]?.count ?? 0
              return (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link href={`/catalogues/${r.id}`} className="text-blue-600 underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{orgName ?? '—'}</td>
                  <td className="px-3 py-2">{itemsCount}</td>
                  <td className="px-3 py-2">{Number(r.discount_pct).toFixed(2)}%</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page} of {totalPages} · {count} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => gotoPage(page - 1)}
              className="rounded border px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => gotoPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
