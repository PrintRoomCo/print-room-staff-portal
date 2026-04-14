import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-28 w-full rounded-2xl bg-gray-50 border border-gray-200 px-5 py-3 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:bg-gray-100 transition-all duration-200 resize-none disabled:cursor-not-allowed disabled:opacity-50 focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
