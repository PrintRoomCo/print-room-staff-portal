import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-emerald-100 text-emerald-800",
        warning: "border-transparent bg-amber-100 text-amber-800",
        info: "border-transparent bg-blue-100 text-blue-800",
        green: "bg-[rgb(var(--color-brand-yellow))] text-[rgb(var(--color-brand-blue))] border-[rgb(var(--color-brand-blue))]/15",
        blue: "bg-[rgb(var(--color-brand-blue))]/10 text-[rgb(var(--color-brand-blue))] border-[rgb(var(--color-brand-blue))]/20",
        yellow: "bg-[#F1FFA5] text-black border-black/10",
        red: "bg-red-50 text-red-800 border-red-200",
        gray: "bg-gray-50 text-gray-800 border-gray-200",
        purple: "bg-purple-50 text-purple-800 border-purple-200",
        orange: "bg-orange-50 text-orange-800 border-orange-200",
        cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
