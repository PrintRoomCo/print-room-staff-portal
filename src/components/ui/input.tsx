import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-2.5 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:bg-gray-100 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:[box-shadow:0_0_0_3px_rgba(0,0,0,0.06)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
