'use client'

import { AuthProvider } from '@/contexts/AuthContext'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {children}
      </div>
    </AuthProvider>
  )
}
