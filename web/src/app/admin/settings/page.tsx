import {
    Shield,
    Globe,
    Bell,
    Database,
    Users,
    Lock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    Building2,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { fetchAdminSettings, fetchMe, getCompany } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { CompanyEditButton } from "./company-edit-button"

export default async function SettingsPage() {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const [settingsResult, meResult] = await Promise.all([
        fetchAdminSettings(sessionToken),
        fetchMe(sessionToken),
    ])

    const companyId = meResult.data?.user?.companyId
    const companyResult = companyId ? await getCompany(sessionToken, companyId) : { data: null, error: "No company found" }
    const company = companyResult.data

    const backendOnline = settingsResult.error === null && meResult.error === null

    const SETTING_SECTIONS = [
        {
            id: "company",
            icon: Building2,
            title: "Company Profile",
            description: "Update your company name, logo, and contact details.",
            items: [
                { label: "Company Name", value: company?.name ?? "Aedra Mombasa Ltd." },
                { label: "Support Email", value: company?.email ?? "support@aedra.co.ke" },
                { label: "Support Phone", value: company?.phone ?? "+254 700 000 000" },
                { label: "Address", value: company?.address ?? "Mombasa, Kenya" },
            ],
        },
        {
            id: "security",
            icon: Lock,
            title: "Security & Access",
            description: "Manage authentication policies and role permissions.",
            items: [
                { label: "Session Duration", value: "8 hours" },
                { label: "Password Policy", value: "Min 8 chars + special character" },
                { label: "Two-Factor Auth", value: "Disabled" },
                { label: "IP Allowlist", value: "Not configured" },
            ],
        },
        {
            id: "notifications",
            icon: Bell,
            title: "Notifications",
            description: "Configure email and SMS alert preferences.",
            items: [
                { label: "Rent Reminders", value: "3 days before due" },
                { label: "Lease Expiry Alert", value: "90 days before expiry" },
                { label: "Payment Receipts", value: "Enabled" },
                { label: "Maintenance Updates", value: "Enabled" },
            ],
        },
        {
            id: "api",
            icon: Globe,
            title: "API & Integrations",
            description: "Manage backend API connections and third-party integrations.",
            items: [
                { label: "API Base URL", value: "http://localhost:4001" },
                { label: "M-Pesa Integration", value: "Sandbox (Daraja API)" },
                { label: "SMS Provider", value: "Africa's Talking" },
                { label: "Map Provider", value: "Mapbox GL" },
            ],
        },
    ]

    const SECTION_EDIT_PATH: Record<string, string> = {
        security: "/admin/staff",
        notifications: "/admin/notifications",
        api: "/admin/integrations",
    }

    return (
        <div className="flex flex-col gap-8 pb-10">

            {/* Page header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                        Settings
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        Manage platform configuration and access controls.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* API status badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${backendOnline
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}>
                        {backendOnline
                            ? <CheckCircle className="h-3.5 w-3.5" />
                            : <AlertCircle className="h-3.5 w-3.5" />
                        }
                        {backendOnline ? "Backend Online" : "Backend Offline"}
                    </div>
                </div>
            </div>

            {/* Role info card */}
            <div className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${role === "SUPER_ADMIN"
                ? "bg-white/5 border-white/10"
                : "bg-red-500/8 border-red-500/20"
                }`}>
                <Shield className={`h-5 w-5 mt-0.5 flex-shrink-0 ${role === "SUPER_ADMIN" ? "text-neutral-400" : "text-red-400"}`} />
                <div>
                    <p className={`text-sm font-semibold ${role === "SUPER_ADMIN" ? "text-white" : "text-red-300"}`}>
                        {role === "SUPER_ADMIN"
                            ? "Full Access — Super Admin"
                            : role === "COMPANY_ADMIN"
                                ? "Limited Access — Company Admin"
                                : "Read-Only — Company Staff"}
                    </p>
                    <p className={`text-xs mt-0.5 ${role === "SUPER_ADMIN" ? "text-neutral-400" : "text-red-400/70"}`}>
                        {role === "SUPER_ADMIN"
                            ? "You can view and modify all settings on this page."
                            : "Some settings are restricted to Super Admin only. Contact your system administrator."}
                    </p>
                    {settingsResult.data?.requiredRoles && (
                        <p className="text-xs text-neutral-500 mt-1">
                            Required roles: {settingsResult.data.requiredRoles.join(", ")}
                        </p>
                    )}
                </div>
            </div>

            {/* API Status detail */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Database className="h-4 w-4 text-neutral-400" />
                            Backend API Status
                        </CardTitle>
                        <CardDescription className="text-neutral-400 mt-1">
                            {settingsResult.data?.message ?? settingsResult.error ?? "No response from API"}
                        </CardDescription>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full ${backendOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]"}`} />
                </CardHeader>
            </Card>

            {/* Settings sections */}
            <div className="grid gap-6 md:grid-cols-2">
                {SETTING_SECTIONS.map((section) => {
                    const Icon = section.icon
                    return (
                        <Card key={section.id} className="group">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                            <Icon className="h-4 w-4 text-neutral-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold text-white">{section.title}</CardTitle>
                                            <CardDescription className="text-xs text-neutral-500 mt-0.5">{section.description}</CardDescription>
                                        </div>
                                    </div>
                                    {section.id === "company" && company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                                        <CompanyEditButton company={company} token={sessionToken} />
                                    ) : (
                                        <Button asChild variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs text-neutral-400">
                                            <Link href={SECTION_EDIT_PATH[section.id] ?? "/admin/settings"}>
                                                Edit <ChevronRight className="ml-1 h-3 w-3" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2 border-t border-white/5 pt-3">
                                    {section.items.map((item) => (
                                        <div key={item.label} className="flex items-center justify-between py-1">
                                            <span className="text-xs text-neutral-500">{item.label}</span>
                                            <span className="text-xs font-medium text-neutral-200 text-right max-w-[55%] truncate">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Roles definition */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4 text-neutral-400" />
                        Role Permissions
                    </CardTitle>
                    <CardDescription className="text-neutral-400">
                        Overview of access levels for each role in the platform.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                        {[
                            {
                                role: "Company Staff",
                                color: "border-white/10",
                                perms: ["View dashboard", "View properties", "View tenants", "Log maintenance"],
                                restricted: ["Settings", "Audit logs", "Billing"],
                            },
                            {
                                role: "Company Admin",
                                color: "border-white/15",
                                perms: ["All staff permissions", "Manage properties", "Manage tenants", "Company settings"],
                                restricted: ["Audit logs", "System settings"],
                            },
                            {
                                role: "Super Admin",
                                color: "border-white/20",
                                perms: ["Full platform access", "All audit logs", "System configuration", "User management"],
                                restricted: [],
                            },
                        ].map((r) => (
                            <div key={r.role} className={`rounded-xl border ${r.color} bg-white/[0.03] p-4 space-y-3`}>
                                <p className="text-sm font-semibold text-white">{r.role}</p>
                                <div className="space-y-1">
                                    {r.perms.map(p => (
                                        <p key={p} className="text-xs text-neutral-300 flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                                            {p}
                                        </p>
                                    ))}
                                    {r.restricted.map(p => (
                                        <p key={p} className="text-xs text-neutral-600 flex items-center gap-2">
                                            <AlertCircle className="h-3 w-3 text-neutral-700 flex-shrink-0" />
                                            {p}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

        </div>
    )
}
