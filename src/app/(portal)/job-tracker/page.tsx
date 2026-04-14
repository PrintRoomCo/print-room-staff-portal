'use client'

import { ClipboardList } from 'lucide-react'

export default function JobTrackerPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <ClipboardList className="w-8 h-8 text-gray-400" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Job Tracker</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-md">
        Production job tracking is coming soon. This will be migrated from the existing job tracker in print-room-studio.
      </p>
    </div>
  )
}
