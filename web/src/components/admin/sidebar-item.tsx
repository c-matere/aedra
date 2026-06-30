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
    blue: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    emerald: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    amber: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    purple: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    indigo: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    rose: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" },
    gray: { bg: "bg-[#f0eee6]", border: "border-[#dedcd1]", icon: "text-[#73726c] group-hover:text-[#1f1e1d]" }
}

export function SidebarItem({ href, label, icon: Icon, isActive, color = "gray", onClick }: SidebarItemProps) {
    const variant = COLOR_VARIANTS[color] || COLOR_VARIANTS.gray

    return (
        <Link 
            href={href}
            onClick={onClick}
            className={cn(
                "group flex items-center gap-3 rounded-[9.6px] px-3 py-2 transition-all duration-300",
                isActive 
                    ? "bg-[#ccdbe8]/45 text-[#141413]" 
                    : "text-[#73726c] hover:bg-[#f0eee6] hover:text-[#1f1e1d]"
            )}
        >
            {/* Boxed Icon */}
            <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
                isActive 
                    ? "bg-[#ccdbe8] border-[#dedcd1]" 
                    : cn(variant.bg, variant.border),
                isActive ? "scale-105" : "group-hover:scale-110"
            )}>
                <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-[#141413]" : variant.icon)} />
            </div>

            {/* Label */}
            <span className={cn(
                "text-[13px] tracking-tight truncate transition-colors",
                isActive ? "text-[#141413] font-medium" : "text-[#73726c] group-hover:text-[#1f1e1d]"
            )}>
                {label}
            </span>
        </Link>
    )
}
