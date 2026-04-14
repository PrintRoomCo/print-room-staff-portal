'use client'

import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-gray-400" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Reports</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-md">
        Business reports and analytics are coming soon. This will be migrated from even-better-reports.
      </p>
    </div>
  )
}
