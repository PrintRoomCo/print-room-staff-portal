'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useStaff } from '@/contexts/StaffContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { staff, loading: staffLoading } = useStaff()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-in')
    }
  }, [authLoading, user, router])

  if (authLoading || staffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground text-sm">Access denied.</p>
          <p className="text-muted-foreground text-xs">
            Your account does not have staff access. Contact an administrator.
          </p>
        </div>
      </div>
    )
  }

  return <Sidebar>{children}</Sidebar>
}
