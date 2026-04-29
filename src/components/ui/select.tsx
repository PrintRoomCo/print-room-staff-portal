import * as React from 'react'
import { cn } from '@/lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm text-foreground focus:outline-none focus:border-gray-400 focus:bg-gray-100 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
