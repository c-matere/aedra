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
    CreditCard,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { fetchAdminSettings, fetchMe, getCompany, backendBaseUrl, listCompanies, getLogoUrl } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { CompanyEditButton } from "./company-edit-button"
import { SecurityEditButton } from "./security-edit-button"
import { NotificationsEditButton } from "./notifications-edit-button"
import { IntegrationsEditButton } from "./integrations-edit-button"
import { BillingEditButton } from "./billing-edit-button"
import { CompanySelector } from "./company-selector"

export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""
    const resolvedSearchParams = await searchParams
    const queryCompanyId = resolvedSearchParams.companyId as string | undefined

    const [settingsResult, meResult] = await Promise.all([
        fetchAdminSettings(sessionToken),
        fetchMe(sessionToken),
    ])

    const userCompanyId = meResult.data?.user?.companyId
    const effectiveCompanyId = (role === "SUPER_ADMIN" && queryCompanyId) ? queryCompanyId : userCompanyId

    const [companyResult, allCompaniesResult] = await Promise.all([
        effectiveCompanyId ? getCompany(sessionToken, effectiveCompanyId) : Promise.resolve({ data: null, error: "No company found" }),
        role === "SUPER_ADMIN" ? listCompanies(sessionToken) : Promise.resolve({ data: null, error: null })
    ])

    const company = companyResult.data
    const allCompanies = allCompaniesResult.data || []

    const backendOnline = settingsResult.error === null && meResult.error === null

    const SETTING_SECTIONS = [
        {
            id: "company",
            icon: Building2,
            title: "Company Profile",
            description: "Update your company name, logo, and contact details.",
            items: [
                { label: "Logo", value: company?.logo || "No logo uploaded" },
                { label: "Company Name", value: company?.name ?? "Aedra Mombasa Ltd." },
                { label: "Support Email", value: company?.email ?? "support@aedra.co.ke" },
                { label: "Support Phone", value: company?.phone ?? "+254 700 000 000" },
                { label: "Address", value: company?.address ?? "Mombasa, Kenya" },
            ],
            editor: company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                <CompanyEditButton company={company} token={sessionToken} />
            ) : null
        },
        {
            id: "security",
            icon: Lock,
            title: "Security & Access",
            description: "Manage authentication policies and role permissions.",
            items: [
                { label: "Session Duration", value: `${company?.sessionDurationHours ?? 8} hours` },
                { label: "Password Policy", value: company?.passwordPolicy ?? "Min 8 chars + special character" },
                { label: "Two-Factor Auth", value: company?.twoFactorAuthEnabled ? "Enabled" : "Disabled" },
                { label: "IP Allowlist", value: company?.ipAllowlist ?? "Not configured" },
            ],
            editor: company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                <SecurityEditButton company={company} token={sessionToken} />
            ) : null
        },
        {
            id: "notifications",
            icon: Bell,
            title: "Notifications",
            description: "Configure email and SMS alert preferences.",
            items: [
                { label: "Rent Reminders", value: `${company?.rentReminderDaysBefore ?? 3} days before due` },
                { label: "Lease Expiry Alert", value: `${company?.leaseExpiryAlertDaysBefore ?? 90} days before expiry` },
                { label: "Payment Receipts", value: company?.paymentReceiptsEnabled ? "Enabled" : "Disabled" },
                { label: "Maintenance Updates", value: company?.maintenanceUpdatesEnabled ? "Enabled" : "Disabled" },
            ],
            editor: company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                <NotificationsEditButton company={company} token={sessionToken} />
            ) : null
        },
        {
            id: "integrations",
            icon: Globe,
            title: "API & Integrations",
            description: "Manage backend API connections and third-party integrations.",
            items: [
                { label: "API Base URL", value: backendBaseUrl() },
                { label: "M-Pesa Integration", value: company?.mpesaShortcode ? `Shortcode: ${company.mpesaShortcode} (${company.mpesaEnvironment})` : "Not configured" },
                { label: "SMS Provider", value: `${company?.smsProvider}${company?.africaTalkingApiKey ? " (Configured)" : " (Missing API Key)"}` },
                { label: "Map Provider", value: `${company?.mapProvider}${company?.mapboxAccessToken ? " (Configured)" : " (Missing Token)"}` },
            ],
            editor: company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                <IntegrationsEditButton company={company} token={sessionToken} />
            ) : null
        },
        {
            id: "billing",
            icon: CreditCard,
            title: "Billing & Invoicing",
            description: "Manage automatic invoicing and billing cycles.",
            items: [
                { label: "Automatic Invoicing", value: company?.autoInvoicingEnabled ? "Enabled" : "Disabled" },
                { label: "Invoicing Day", value: `Day ${company?.invoicingDay ?? 1} of the month` },
            ],
            editor: company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") ? (
                <BillingEditButton company={company} token={sessionToken} />
            ) : null
        },
    ]

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
            
            {/* Super Admin Company Selector */}
            {role === "SUPER_ADMIN" && allCompanies.length > 0 && (
                <CompanySelector 
                    companies={allCompanies} 
                    currentCompanyId={effectiveCompanyId || ""} 
                />
            )}

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
                                    {section.editor}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2 border-t border-white/5 pt-3">
                                    {section.items.map((item) => (
                                        <div key={item.label} className="flex items-center justify-between py-1">
                                            <span className="text-xs text-neutral-500">{item.label}</span>
                                            <span className="text-xs font-medium text-neutral-200 text-right max-w-[55%] truncate">
                                                {item.label === "Logo" && item.value && item.value !== "No logo uploaded" ? (
                                                    <img src={getLogoUrl(item.value as string) || ""} alt="Logo" className="h-8 w-8 object-contain rounded border border-white/10 ml-auto" />
                                                ) : (
                                                    item.value
                                                )}
                                            </span>
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
