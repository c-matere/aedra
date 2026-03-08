"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const SlidePanel = DialogPrimitive.Root

const SlidePanelTrigger = DialogPrimitive.Trigger

const SlidePanelClose = DialogPrimitive.Close

const SlidePanelPortal = DialogPrimitive.Portal

const SlidePanelOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
))
SlidePanelOverlay.displayName = DialogPrimitive.Overlay.displayName

const SlidePanelContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
        zIndex?: number;
        overlayClassName?: string;
    }
>(({ className, children, zIndex, overlayClassName, style, ...props }, ref) => (
    <SlidePanelPortal>
        <SlidePanelOverlay
            className={overlayClassName}
            style={zIndex ? { zIndex } : undefined}
        />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-white/10 bg-neutral-950 shadow-lg p-6 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-lg flex flex-col overflow-y-auto",
                className
            )}
            style={{
                ...style,
                ...(zIndex ? { zIndex: zIndex + 5 } : {})
            }}
            {...props}
        >
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                <X className="h-5 w-5 text-neutral-400 hover:text-white transition-colors" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
            {children}
        </DialogPrimitive.Content>
    </SlidePanelPortal>
))
SlidePanelContent.displayName = DialogPrimitive.Content.displayName

const SlidePanelHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-2 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
SlidePanelHeader.displayName = "SlidePanelHeader"

const SlidePanelFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
SlidePanelFooter.displayName = "SlidePanelFooter"

const SlidePanelTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-white", className)}
        {...props}
    />
))
SlidePanelTitle.displayName = DialogPrimitive.Title.displayName

const SlidePanelDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-neutral-400", className)}
        {...props}
    />
))
SlidePanelDescription.displayName = DialogPrimitive.Description.displayName

export {
    SlidePanel,
    SlidePanelPortal,
    SlidePanelOverlay,
    SlidePanelTrigger,
    SlidePanelClose,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelFooter,
    SlidePanelTitle,
    SlidePanelDescription,
}
