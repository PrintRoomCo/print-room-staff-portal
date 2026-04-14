'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import type { StaffUser, StaffPermission } from '@/types/staff'

interface StaffContextType {
  staff: StaffUser | null
  loading: boolean
  hasPermission: (permission: StaffPermission) => boolean
  isAdmin: boolean
}

const StaffContext = createContext<StaffContextType | undefined>(undefined)

export function StaffProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setStaff(null)
      setLoading(false)
      return
    }

    async function loadStaffAccess() {
      try {
        const res = await fetch('/api/staff-access')
        if (!res.ok) {
          setStaff(null)
          setLoading(false)
          return
        }
        const data = await res.json()
        setStaff(data.staff)
      } catch {
        setStaff(null)
      } finally {
        setLoading(false)
      }
    }

    loadStaffAccess()
  }, [user])

  const hasPermission = (permission: StaffPermission) => {
    if (!staff) return false
    if (staff.role === 'super_admin') return true
    return staff.permissions.includes(permission)
  }

  const isAdmin = staff?.role === 'admin' || staff?.role === 'super_admin'

  return (
    <StaffContext.Provider value={{ staff, loading, hasPermission, isAdmin }}>
      {children}
    </StaffContext.Provider>
  )
}

export function useStaff() {
  const context = useContext(StaffContext)
  if (context === undefined) {
    throw new Error('useStaff must be used within a StaffProvider')
  }
  return context
}
