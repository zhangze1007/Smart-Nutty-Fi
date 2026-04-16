import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-nutty-primary text-white hover:bg-nutty-secondary": variant === "default",
            "bg-[#92400E] text-white hover:bg-[#78350F]": variant === "destructive",
            "border border-nutty-border bg-nutty-card hover:bg-nutty-bg hover:text-nutty-text-main": variant === "outline",
            "bg-nutty-bg text-nutty-primary hover:bg-nutty-border": variant === "secondary",
            "hover:bg-nutty-bg hover:text-nutty-text-main": variant === "ghost",
            "text-nutty-primary underline-offset-4 hover:underline": variant === "link",
            "h-12 px-4 py-2": size === "default",
            "h-9 rounded-xl px-3": size === "sm",
            "h-14 rounded-2xl px-8 text-base": size === "lg",
            "h-12 w-12": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
