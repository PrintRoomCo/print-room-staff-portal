import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-gray-300 bg-gray-50 text-[rgb(var(--color-brand-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-brand-blue))]/30 focus:ring-offset-1 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 accent-[rgb(var(--color-brand-blue))]',
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
