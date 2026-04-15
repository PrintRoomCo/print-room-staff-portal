import type { ReactNode } from 'react'

interface PresentationFieldProps {
  label: string
  children: ReactNode
}

export function PresentationField({ label, children }: PresentationFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
