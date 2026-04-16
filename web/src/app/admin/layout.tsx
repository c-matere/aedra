import * as React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
    Building2,
    LayoutDashboard,
    Settings,
    Users,
    CreditCard,
    Wallet,
    Wrench,
    FileText,
    BarChart3,
    Layers,
    Handshake,
    Receipt,
    FileSpreadsheet,
    UsersRound,
    Bell,
    FolderOpen,
    BriefcaseBusiness,
    LifeBuoy,
    Plug,
    Shield,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { TopNavProfile } from "@/components/auth/top-nav-profile"
import { MobileSidebar, type NavItem } from "@/components/admin/mobile-sidebar"
import { canAccessRoute, roleLabel } from "@/lib/rbac"
import { fetchMe, getCompany, getLogoUrl } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { SidebarNav } from "@/components/admin/sidebar-nav"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const roleFromCookie = await getRoleFromCookie()
    const sessionToken = await getSessionTokenFromCookie()
    const meResult = await fetchMe(sessionToken!)
    const rawRole = meResult.data?.user.role ?? null
    const companyId = meResult.data?.user.companyId

    const companyResult = companyId ? await getCompany(sessionToken!, companyId) : { data: null }
    const company = companyResult.data

    if (!rawRole) {
        redirect("/login?reason=unauthorized")
    }

    if (!canAccessRoute(rawRole, "/admin")) {
        redirect("/forbidden")
    }

    const role = rawRole
    type NavDefinition = NavItem & {
        icon: typeof LayoutDashboard
    }

    const navItems: NavDefinition[] = [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, iconKey: "dashboard", color: "indigo" },
        { href: "/admin/properties", label: "Properties", icon: Building2, iconKey: "properties", color: "blue" },
        { href: "/admin/tenants", label: "Tenants", icon: Users, iconKey: "tenants", color: "blue" },
        { href: "/admin/landlords", label: "Landlords", icon: Handshake, iconKey: "landlords", color: "blue" },
        { href: "/admin/leases", label: "Leases", icon: FileText, iconKey: "leases", color: "blue" },
        { href: "/admin/maintenance", label: "Maintenance", icon: Wrench, iconKey: "maintenance", color: "blue" },
        { href: "/admin/payments", label: "Payments", icon: CreditCard, iconKey: "payments", color: "emerald" },
        { href: "/admin/invoices", label: "Invoices", icon: FileSpreadsheet, iconKey: "invoices", color: "emerald" },
        { href: "/admin/expenses", label: "Expenses", icon: Receipt, iconKey: "expenses", color: "emerald" },
        { href: "/admin/office-finance", label: "Office Finance", icon: Wallet, iconKey: "officeFinance", color: "emerald" },
        { href: "/admin/staff", label: "Staff & Access", icon: UsersRound, iconKey: "staff", color: "amber" },
        { href: "/admin/documents", label: "Documents", icon: FolderOpen, iconKey: "documents", color: "amber" },
        { href: "/admin/vendors", label: "Vendors", icon: BriefcaseBusiness, iconKey: "vendors", color: "amber" },
        { href: "/admin/notifications", label: "Notifications", icon: Bell, iconKey: "notifications", color: "amber" },
        { href: "/admin/reports", label: "Reports", icon: BarChart3, iconKey: "reports", color: "purple" },
        { href: "/admin/integrations", label: "Integrations", icon: Plug, iconKey: "integrations", color: "purple" },
        { href: "/admin/support", label: "Support", icon: LifeBuoy, iconKey: "support", color: "purple" },
        { href: "/admin/settings", label: "Settings", icon: Settings, iconKey: "settings", color: "purple" },
    ]

    const accessibleNavItems = navItems.filter((item) => canAccessRoute(role, item.href))

    const groups = [
        {
            title: "General",
            items: accessibleNavItems.filter(i => ["/admin"].includes(i.href))
        },
        {
            title: "Real Estate",
            items: accessibleNavItems.filter(i => ["/admin/properties", "/admin/tenants", "/admin/landlords", "/admin/leases", "/admin/maintenance"].includes(i.href))
        },
        {
            title: "Financials",
            items: accessibleNavItems.filter(i => ["/admin/payments", "/admin/invoices", "/admin/expenses", "/admin/office-finance"].includes(i.href))
        },
        {
            title: "Tools & Ops",
            items: accessibleNavItems.filter(i => ["/admin/staff", "/admin/documents", "/admin/vendors", "/admin/notifications"].includes(i.href))
        },
        {
            title: "System",
            items: accessibleNavItems.filter(i => ["/admin/reports", "/admin/integrations", "/admin/rbac", "/admin/settings", "/admin/support"].includes(i.href))
        }
    ].filter(g => g.items.length > 0)

    // Explicitly strip non-serializable components (icons) before passing to Client Components
    const serializableGroups = groups.map(group => ({
        title: group.title,
        items: group.items.map(({ href, label, iconKey, color }) => ({
            href,
            label,
            iconKey,
            color,
        }))
    }))

    return (
        <div className="dark flex min-h-screen w-full flex-col bg-neutral-950 text-neutral-50 relative overflow-hidden">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />

            {/* Top Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center border-b border-white/10 bg-neutral-950 px-6 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                    {company?.logo ? (
                        <>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 shadow-inner overflow-hidden">
                                <img src={getLogoUrl(company.logo) || ""} alt="Logo" className="h-full w-full object-contain p-1" />
                            </div>
                            <span className="text-white">
                                {company.name}
                            </span>
                        </>
                    ) : (
                        <img src="/aedra-logo.png" alt="Aedra" className="h-8 w-auto hover:opacity-90 transition-opacity" />
                    )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <MobileSidebar groups={serializableGroups} />
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-neutral-300">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        System Operational
                    </div>

                    <TopNavProfile role={role} roleLabel={roleLabel(role)} />
                </div>
            </nav>

            <div className="flex flex-1 pt-16">
                {/* Sidebar */}
                <aside className="fixed left-0 top-16 bottom-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-neutral-950 md:flex py-6">
                    <SidebarNav groups={serializableGroups} />
                    <div className="mt-auto px-4 pt-4 border-t border-white/10">
                        <SignOutButton />
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10 z-10 w-full ml-0 md:ml-64">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
