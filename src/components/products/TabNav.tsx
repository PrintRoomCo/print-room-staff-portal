'use client'

import { cn } from '@/lib/utils'

export interface TabDef {
  key: string
  label: string
}

interface Props {
  tabs: TabDef[]
  active: string
  onChange: (key: string) => void
}

export function TabNav({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" className="border-b border-gray-200 flex gap-2">
      {tabs.map(tab => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-[rgb(var(--color-brand-blue))] text-[rgb(var(--color-brand-blue))]'
                : 'border-transparent text-gray-500 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
