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
    User,
    History,
    Search
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { fetchAdminSettings, fetchMe, getCompany, listCompanies, getLogoUrl, fetchAuditLogs } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { CompanyEditButton } from "./company-edit-button"
import { NotificationsEditButton } from "./notifications-edit-button"
import { BillingEditButton } from "./billing-edit-button"
import { CompanySelector } from "./company-selector"
import { ProfileEditButton } from "./profile-edit-button"
import { SecurityEditButton } from "./security-edit-button"
import { IntegrationsEditButton } from "./integrations-edit-button"

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

    const [settingsResult, meResult, auditResult] = await Promise.all([
        fetchAdminSettings(sessionToken),
        fetchMe(sessionToken),
        fetchAuditLogs(sessionToken)
    ])

    const userCompanyId = meResult.data?.user?.companyId
    const effectiveCompanyId = (role === "SUPER_ADMIN" && queryCompanyId) ? queryCompanyId : userCompanyId

    const [companyResult, allCompaniesResult] = await Promise.all([
        effectiveCompanyId ? getCompany(sessionToken, effectiveCompanyId) : Promise.resolve({ data: null, error: "No company found" }),
        role === "SUPER_ADMIN" ? listCompanies(sessionToken) : Promise.resolve({ data: null, error: null })
    ])

    const company = companyResult.data
    const allCompanies = allCompaniesResult.data || []
    const me = meResult.data?.user
    const logs = Array.isArray(auditResult.data?.logs) ? auditResult.data.logs : []

    const backendOnline = settingsResult.error === null && meResult.error === null

    return (
        <div className="flex flex-col gap-8 pb-10">

            {/* Page header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                        Settings
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        Personal profile and core company configuration.
                    </p>
                </div>
            </div>
            
            {/* Super Admin Company Selector */}
            {role === "SUPER_ADMIN" && allCompanies.length > 0 && (
                <CompanySelector 
                    companies={allCompanies} 
                    currentCompanyId={effectiveCompanyId || ""} 
                />
            )}

            <div className="grid gap-8 md:grid-cols-2">
                {/* 1. Profile Settings */}
                <Card className="bg-neutral-900 border-white/10 group overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <User className="h-5 w-5 text-purple-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-white">My Profile</CardTitle>
                                    <CardDescription className="text-xs text-neutral-500">Update your account identity.</CardDescription>
                                </div>
                            </div>
                            {me && <ProfileEditButton user={me} token={sessionToken} />}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">Full Name</p>
                                <p className="text-sm font-medium text-white">{me?.firstName} {me?.lastName}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">Platform Role</p>
                                <p className="text-xs font-black text-emerald-400 uppercase tracking-tighter">{me?.role}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-neutral-555 uppercase">Email Link</p>
                            <p className="text-sm font-medium text-white underline underline-offset-4 decoration-white/10 italic">{me?.email}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-neutral-555 uppercase">Phone Number</p>
                            <p className="text-sm font-medium text-white">{me?.phone || "Not provided"}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Company Settings */}
                <Card className="bg-neutral-900 border-white/10 group overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-white">Company Identity</CardTitle>
                                    <CardDescription className="text-xs text-neutral-500">Manege logo, billing, and alert cycles.</CardDescription>
                                </div>
                            </div>
                            {company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") && (
                                <CompanyEditButton company={company} token={sessionToken} />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                        <div className="flex items-center gap-4">
                            {company?.logo ? (
                                <img src={getLogoUrl(company.logo) || ""} alt="Logo" className="h-12 w-12 object-contain rounded border border-white/10 bg-white/5 p-1" />
                            ) : (
                                <div className="h-12 w-12 rounded border border-dashed border-white/10 flex items-center justify-center text-neutral-600 text-[10px] font-bold">NO LOGO</div>
                            )}
                            <div>
                                <p className="text-base font-black text-white">{company?.name ?? "Aedra Platform"}</p>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{company?.email ?? "support@aedra.co.ke"}</p>
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-neutral-555 uppercase tracking-tighter">Billing Cycle</p>
                                    {company && <BillingEditButton company={company} token={sessionToken} />}
                                </div>
                                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-xs text-neutral-500 mb-1 leading-none">Auto-Invoicing</p>
                                    <p className="text-sm font-black text-white">{company?.autoInvoicingEnabled ? "Enabled" : "Manual"}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-neutral-555 uppercase tracking-tighter">System Alerts</p>
                                    {company && <NotificationsEditButton company={company} token={sessionToken} />}
                                </div>
                                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-xs text-neutral-500 mb-1 leading-none">Rent Reminders</p>
                                    <p className="text-sm font-black text-white">{company?.rentReminderDaysBefore ?? 3}d Prior</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Security & Access */}
                <Card className="bg-neutral-900 border-white/10 group overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <Shield className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-white">Security & Access</CardTitle>
                                    <CardDescription className="text-xs text-neutral-500">Manege 2FA, IP allowlist, and WhatsApp OTP.</CardDescription>
                                </div>
                            </div>
                            {company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") && (
                                <SecurityEditButton company={company} token={sessionToken} />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">WhatsApp OTP</p>
                                <p className="text-sm font-medium text-white">{company?.waOtpEnabled ? "Active" : "Disabled"}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">2FA Status</p>
                                <p className="text-xs font-black text-blue-400 uppercase tracking-tighter">{company?.twoFactorAuthEnabled ? "Enabled" : "Off"}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-neutral-555 uppercase">Password Policy</p>
                            <p className="text-xs text-neutral-400 line-clamp-1 italic">{company?.passwordPolicy || "Default Policy"}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. API & Integrations */}
                <Card className="bg-neutral-900 border-white/10 group overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-orange-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-white">Integrations</CardTitle>
                                    <CardDescription className="text-xs text-neutral-500">M-Pesa, SMS Gateway & WhatsApp API.</CardDescription>
                                </div>
                            </div>
                            {company && (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") && (
                                <IntegrationsEditButton company={company} token={sessionToken} />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">SMS Provider</p>
                                <p className="text-sm font-medium text-white">{company?.smsProvider || "None"}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] font-bold text-neutral-555 uppercase">WhatsApp API</p>
                                <p className={`text-xs font-black uppercase tracking-tighter ${company?.waAccessToken ? "text-emerald-400" : "text-neutral-600"}`}>
                                    {company?.waAccessToken ? "Configured" : "Missing Keys"}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-neutral-555 uppercase">M-Pesa Env</p>
                            <p className="text-xs text-neutral-400 uppercase font-bold">{company?.mpesaEnvironment || "sandbox"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 3. Audit Logs (Moved from standalone as requested) */}
            <Card className="bg-neutral-900 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <div>
                        <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-blue-500" />
                            Security Audit Trail
                        </CardTitle>
                        <CardDescription className="text-neutral-500 text-xs">Platform-wide activity and access tracking.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${backendOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]"}`} />
                        <span className="text-[10px] font-black uppercase text-neutral-500">{backendOnline ? "Operational" : "Degraded"}</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {role === "SUPER_ADMIN" ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {logs.length > 0 ? (
                                logs.map((log: any) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                                                        'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {log.action?.substring(0, 1)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-xs font-bold text-white uppercase tracking-tighter">{log.action} {log.entity}</p>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${log.outcome === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {log.outcome}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-neutral-500">{new Date(log.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-32 flex flex-col items-center justify-center text-neutral-600">
                                    <Search className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-xs uppercase font-black tracking-widest italic">No activities recorded</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-32 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                            <History className="h-10 w-10 text-neutral-700 mb-4" />
                            <h4 className="text-white font-bold mb-1">Access Restricted</h4>
                            <p className="text-[11px] text-neutral-500">Only Super Admins can view the granular audit trail.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}
