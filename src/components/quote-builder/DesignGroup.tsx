'use client'

import { Layers3 } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface DesignGroupProps {
  name: string
  itemCount: number
  children: React.ReactNode
}

export function DesignGroup({ name, itemCount, children }: DesignGroupProps) {
  return (
    <Card className="overflow-hidden border-[rgb(var(--color-brand-blue))]/10">
      <div className="flex items-center justify-between border-b border-[rgb(var(--color-brand-blue))]/10 bg-[rgb(var(--color-brand-blue))]/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 text-[rgb(var(--color-brand-blue))] shadow-sm">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">Shared design group · {itemCount} products</p>
          </div>
        </div>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </Card>
  )
}
