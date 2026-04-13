"use client"

import Link from "next/link"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItemProps {
    href: string
    label: string
    icon: LucideIcon
    isActive: boolean
    color?: string
    onClick?: () => void
}

const COLOR_VARIANTS: Record<string, { bg: string; border: string; icon: string }> = {
    blue: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        icon: "text-blue-400"
    },
    emerald: {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        icon: "text-emerald-400"
    },
    amber: {
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        icon: "text-amber-400"
    },
    purple: {
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        icon: "text-purple-400"
    },
    indigo: {
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/20",
        icon: "text-indigo-400"
    },
    rose: {
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
        icon: "text-rose-400"
    },
    gray: {
        bg: "bg-neutral-500/10",
        border: "border-neutral-500/20",
        icon: "text-neutral-400"
    }
}

export function SidebarItem({ href, label, icon: Icon, isActive, color = "gray", onClick }: SidebarItemProps) {
    const variant = COLOR_VARIANTS[color] || COLOR_VARIANTS.gray

    return (
        <Link 
            href={href}
            onClick={onClick}
            className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300",
                isActive 
                    ? "bg-white/[0.08] text-white shadow-sm" 
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
            )}
        >
            {/* Boxed Icon */}
            <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
                variant.bg,
                variant.border,
                isActive ? "scale-105 shadow-lg shadow-white/5" : "group-hover:scale-110"
            )}>
                <Icon className={cn("h-4 w-4 transition-colors", variant.icon)} />
            </div>

            {/* Label */}
            <span className={cn(
                "text-[13px] font-medium tracking-tight truncate transition-colors",
                isActive ? "text-white" : "text-neutral-400 group-hover:text-white"
            )}>
                {label}
            </span>
        </Link>
    )
}
