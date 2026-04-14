'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { StaffProvider } from '@/contexts/StaffContext'
import { PortalShell } from '@/components/layout/PortalShell'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StaffProvider>
        <PortalShell>{children}</PortalShell>
      </StaffProvider>
    </AuthProvider>
  )
}
