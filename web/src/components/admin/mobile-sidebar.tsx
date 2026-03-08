"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
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

export interface NavItem {
  href: string
  label: string
  iconKey: keyof typeof ICON_MAP
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export function MobileSidebar({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 shrink-0 bg-neutral-950 p-4 shadow-2xl border-r border-white/10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-semibold text-white tracking-tight">Navigation</span>
              <Button variant="ghost" size="icon" className="text-neutral-400" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex flex-1 flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide">
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
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-neutral-400")} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  )
}
