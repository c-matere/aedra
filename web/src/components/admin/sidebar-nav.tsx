"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Building2,
    Users,
    CreditCard,
    Wallet,
    Receipt,
    FileSpreadsheet,
    Wrench,
    FileText,
    Layers,
    Handshake,
    UsersRound,
    Bell,
    FolderOpen,
    BriefcaseBusiness,
    LifeBuoy,
    Plug,
    BarChart3,
    Settings,
    Shield,
    ChevronRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SidebarItem } from "./sidebar-item"

const ICON_MAP: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    properties: Building2,
    tenants: Users,
    payments: CreditCard,
    officeFinance: Wallet,
    expenses: Receipt,
    invoices: FileSpreadsheet,
    maintenance: Wrench,
    leases: FileText,
    units: Layers,
    landlords: Handshake,
    staff: UsersRound,
    notifications: Bell,
    documents: FolderOpen,
    vendors: BriefcaseBusiness,
    support: LifeBuoy,
    integrations: Plug,
    reports: BarChart3,
    settings: Settings,
    rbac: Shield,
}

export interface SidebarNavItem {
    href: string
    label: string
    iconKey: string
    color?: string
}

export interface SidebarNavGroup {
    title: string
    items: SidebarNavItem[]
}

export function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
    const pathname = usePathname()

    return (
        <nav className="flex flex-1 flex-col gap-8 px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent py-4">
            {groups.map((group, groupIdx) => (
                <div key={groupIdx} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-3 group/header cursor-default">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500 group-hover/header:text-neutral-400 transition-colors">
                            {group.title}
                        </h3>
                        <ChevronRight className="h-3 w-3 text-neutral-600 group-hover/header:text-neutral-400 transition-colors rotate-90" />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                        {group.items.map((item) => {
                            const Icon = ICON_MAP[item.iconKey] ?? LayoutDashboard
                            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))

                            return (
                                <SidebarItem 
                                    key={item.href}
                                    href={item.href}
                                    label={item.label}
                                    icon={Icon}
                                    isActive={isActive}
                                    color={item.color}
                                />
                            )
                        })}
                    </div>
                </div>
            ))}
        </nav>
    )
}
