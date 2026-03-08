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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
}

export interface SidebarNavItem {
    href: string
    label: string
    iconKey: string
}

export interface SidebarNavGroup {
    title: string
    items: SidebarNavItem[]
}

export function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
    const pathname = usePathname()

    return (
        <nav className="flex flex-1 flex-col gap-6 px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {groups.map((group, groupIdx) => (
                <div key={groupIdx} className="flex flex-col gap-2">
                    <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {group.title}
                    </h3>
                    <div className="flex flex-col gap-1">
                        {group.items.map((item) => {
                            const Icon = ICON_MAP[item.iconKey] ?? LayoutDashboard
                            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))

                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 transition-colors h-9 px-3",
                                            isActive ? "bg-white/10 text-white font-medium shadow-sm" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-neutral-400")} />
                                        <span className="truncate">{item.label}</span>
                                    </Button>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            ))}
        </nav>
    )
}
