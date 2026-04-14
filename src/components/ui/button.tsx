import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "rounded-full border border-gray-200 bg-white text-foreground hover:bg-gray-50 hover:border-gray-300",
        ghost: "rounded-full hover:bg-gray-100 text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "rounded-full bg-[rgb(var(--color-brand-blue))] text-white shadow-sm hover:opacity-90 hover:shadow-md",
        danger: "rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow-md",
        "brand-outline": "rounded-full border-2 border-[rgb(var(--color-brand-blue))] bg-transparent text-[rgb(var(--color-brand-blue))] hover:bg-[rgb(var(--color-brand-blue))] hover:text-white hover:shadow-md",
      },
      size: {
        default: "h-10 px-6 py-2.5",
        sm: "h-9 rounded-full px-4",
        lg: "h-11 rounded-full px-8",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
