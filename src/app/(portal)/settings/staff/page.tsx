'use client'

import { useStaff } from '@/contexts/StaffContext'
import { Users } from 'lucide-react'

export default function ManageStaffPage() {
  const { isAdmin } = useStaff()

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground text-sm">You do not have permission to manage staff.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Manage Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add, remove, and manage staff user permissions.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-muted-foreground text-sm max-w-md">
          Staff management interface coming soon. For now, manage staff users directly in Supabase.
        </p>
      </div>
    </div>
  )
}
