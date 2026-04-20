import { Card } from '@/components/ui/card'

interface OrgSummary {
  id: string
  name: string
  variantCount: number
  totalStock: number
  totalCommitted: number
  lastEventAt: string | null
}

export function OrgCard({ org }: { org: OrgSummary }) {
  return (
    <Card variant="interactive" className="p-4">
      <div className="font-medium">{org.name}</div>
      <div className="text-xs text-gray-500 mt-1">
        {org.variantCount} variants &middot; {org.totalStock} on hand &middot; {org.totalCommitted} committed
      </div>
      {org.lastEventAt && (
        <div className="text-xs text-gray-400 mt-1">
          Last:{' '}
          {new Intl.DateTimeFormat('en-NZ', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(org.lastEventAt))}
        </div>
      )}
    </Card>
  )
}
