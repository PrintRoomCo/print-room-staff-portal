'use client'

import { CheckCircle2, FileText, XCircle, Clock3 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { QuoteBuilderDashboardCounts } from '@/lib/quote-builder/types'

interface QuoteStatsCardsProps {
  counts: QuoteBuilderDashboardCounts
}

const STAT_CARDS = [
  { key: 'total', label: 'Total Quotes', icon: FileText, accent: 'text-[rgb(var(--color-brand-blue))]' },
  { key: 'created', label: 'Created', icon: Clock3, accent: 'text-blue-600' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, accent: 'text-emerald-600' },
  { key: 'declined', label: 'Declined', icon: XCircle, accent: 'text-rose-600' },
] as const

export function QuoteStatsCards({ counts }: QuoteStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.key} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {counts[card.key]}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <Icon className={`h-5 w-5 ${card.accent}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
