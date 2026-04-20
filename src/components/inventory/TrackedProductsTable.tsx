import Link from 'next/link'
import { Card } from '@/components/ui/card'

interface TrackedProduct {
  id: string
  name: string
  image_url: string | null
  variantCount: number
  totalStock: number
  totalCommitted: number
}

interface TrackedProductsTableProps {
  orgId: string
  products: TrackedProduct[]
}

export function TrackedProductsTable({ orgId, products }: TrackedProductsTableProps) {
  if (!products.length) {
    return (
      <div className="text-gray-500">
        No products tracked for this customer yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {products.map((p) => (
        <Link key={p.id} href={`/inventory/${orgId}/${p.id}`}>
          <Card variant="interactive" className="p-4 flex items-center gap-4">
            {p.image_url ? (
              // Plain <img> avoids needing to allowlist arbitrary product image
              // hosts in next.config.ts.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                width={64}
                height={64}
                className="rounded object-cover w-16 h-16 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-gray-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {p.variantCount} variants &middot; {p.totalStock} on hand &middot;{' '}
                {p.totalCommitted} committed
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
