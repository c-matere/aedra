import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9.6px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 leading-none",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow-none hover:opacity-90 border border-transparent",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-none hover:opacity-90",
                outline:
                    "border border-border bg-transparent text-foreground hover:bg-secondary",
                secondary:
                    "bg-secondary text-foreground border border-border hover:opacity-90",
                ghost: "hover:bg-secondary hover:text-foreground text-muted-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                glass: "bg-primary text-primary-foreground shadow-none hover:opacity-90 border border-transparent",
            },
            size: {
                default: "h-[36px] px-[20px] py-[8px]",
                sm: "h-8 rounded-[9.6px] px-3 text-xs",
                lg: "h-[44px] rounded-[9.6px] px-8 text-base",
                icon: "h-[36px] w-[36px]",
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
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
