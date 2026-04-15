'use client'

import Link from 'next/link'
import { FilePlus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface QuoteFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  manager: string
  onManagerChange: (value: string) => void
  managers: string[]
}

const selectClassName = 'h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-gray-400 focus:bg-gray-100 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]'

export function QuoteFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  manager,
  onManagerChange,
  managers,
}: QuoteFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_minmax(200px,1fr)] xl:flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search customer, reference, or manager"
            className="pl-11"
          />
        </div>

        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={selectClassName}
        >
          <option value="all">All statuses</option>
          <option value="created">Created</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>

        <select
          value={manager}
          onChange={(event) => onManagerChange(event.target.value)}
          className={selectClassName}
        >
          <option value="all">All managers</option>
          {managers.map((managerName) => (
            <option key={managerName} value={managerName}>
              {managerName}
            </option>
          ))}
        </select>
      </div>

      <Link href="/quote-tool/new" className="xl:shrink-0">
        <Button variant="accent" className="w-full xl:w-auto">
          <FilePlus className="mr-2 h-4 w-4" />
          New Quote
        </Button>
      </Link>
    </div>
  )
}
