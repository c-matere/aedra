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
  Shield,
  ChevronRight,
} from "lucide-react"
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

export interface NavItem {
  href: string
  label: string
  iconKey: keyof typeof ICON_MAP
  color?: string
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
            <nav className="flex flex-1 flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide py-4">
              {groups.map((group, groupIdx) => (
                <div key={groupIdx} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      {group.title}
                    </h3>
                    <ChevronRight className="h-3 w-3 text-neutral-600 rotate-90" />
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
                          onClick={() => setOpen(false)}
                        />
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
