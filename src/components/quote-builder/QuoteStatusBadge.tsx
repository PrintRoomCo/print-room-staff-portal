'use client'

import { Badge } from '@/components/ui/badge'

const STATUS_VARIANTS: Record<string, 'info' | 'success' | 'destructive' | 'warning' | 'gray'> = {
  created: 'info',
  draft: 'gray',
  sent: 'info',
  accepted: 'success',
  declined: 'destructive',
  expired: 'warning',
  archived: 'gray',
}

function formatStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] || 'gray'}>
      {formatStatus(status)}
    </Badge>
  )
}
