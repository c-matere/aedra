import {
    Users,
    Mail,
    Phone,
    Search,
    Building2,
    CalendarDays,
    UserCheck,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { listTenants, listProperties, type TenantRecord } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { AddTenantButton, TenantRowActions, TenantRowClickable } from "./tenant-actions"

function statusBadge(status: string | undefined) {
    const s = status ?? "Active"
    if (s === "Active" || s === "ACTIVE")
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
            </span>
        )
    if (s === "Expiring Soon" || s === "EXPIRING")
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Expiring
            </span>
        )
    if (s === "Overdue" || s === "OVERDUE")
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600/15 border border-red-600/25 text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                Overdue
            </span>
        )
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
            {s}
        </span>
    )
}

function initials(first: string, last: string) {
    return `${first[0] ?? "?"}${last[0] ?? "?"}`.toUpperCase()
}

import { Pagination } from "@/components/ui/pagination"
import { redirect } from "next/navigation"

export default async function TenantsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string }>;
}) {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const resolvedParams = await searchParams
    const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1
    const search = resolvedParams.search || ""

    const [tenantsResult, propertiesResult] = await Promise.all([
        listTenants(sessionToken, { page, search }),
        listProperties(sessionToken, { limit: 100 })
    ])

    const tenantsData = tenantsResult.data
    const tenants: TenantRecord[] = tenantsData?.data ?? []
    const meta = tenantsData?.meta

    const active = tenants.filter(t => t.status === "Active" || t.status === "ACTIVE" || !t.status).length
    const expiring = tenants.filter(t => t.status === "Expiring Soon" || t.status === "EXPIRING").length
    const overdue = tenants.filter(t => t.status === "Overdue" || t.status === "OVERDUE").length

    const onSearchAction = async (formData: FormData) => {
        "use server"
        const query = formData.get("search") as string
        if (query) {
            redirect(`/admin/tenants?search=${encodeURIComponent(query)}`)
        } else {
            redirect("/admin/tenants")
        }
    }

    const onPageChangeAction = async (newPage: number) => {
        "use server"
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        params.set("page", newPage.toString())
        redirect(`/admin/tenants?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Page header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                        Tenants
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        {meta?.total ?? tenants.length} {(meta?.total ?? tenants.length) === 1 ? "tenant" : "tenants"} registered
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
                        <form action={onSearchAction}>
                            <input
                                name="search"
                                placeholder="Search tenants..."
                                defaultValue={search}
                                className="h-9 w-[220px] rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
                            />
                        </form>
                    </div>
                    <AddTenantButton role={role} properties={propertiesResult.data?.data ?? []} />
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Total Tenants</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{meta?.total ?? tenants.length}</div>
                        <p className="text-xs text-neutral-400 mt-1">across all properties</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Active Leases</CardTitle>
                        <UserCheck className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400">{active}</div>
                        <p className="text-xs text-neutral-400 mt-1">in good standing</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Expiring Soon</CardTitle>
                        <CalendarDays className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${expiring > 0 ? "text-red-400" : "text-white"}`}>{expiring}</div>
                        <p className="text-xs text-neutral-400 mt-1">leases ending within 90 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Alerts row */}
            {(expiring > 0 || overdue > 0) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {expiring > 0 && (
                        <div className="flex-1 flex items-center justify-between rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-red-300">{expiring} lease{expiring > 1 ? "s" : ""} expiring soon</p>
                                <p className="text-xs text-red-400/70 mt-0.5">Send renewal notices to avoid vacancies</p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/20 bg-transparent ml-4">
                                <Link href="/admin/leases">Review</Link>
                            </Button>
                        </div>
                    )}
                    {overdue > 0 && (
                        <div className="flex-1 flex items-center justify-between rounded-xl bg-red-600/8 border border-red-600/20 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-red-300">{overdue} overdue payment{overdue > 1 ? "s" : ""}</p>
                                <p className="text-xs text-red-400/70 mt-0.5">Follow up with tenants on outstanding rent</p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/20 bg-transparent ml-4">
                                <Link href="/admin/payments">Follow Up</Link>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Tenants table */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">All Tenants</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Manage leases, contact details, and payment history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        <div className="col-span-3">Tenant</div>
                        <div className="col-span-2 hidden md:block">Contact</div>
                        <div className="col-span-3 hidden lg:block">Unit / Property</div>
                        <div className="col-span-2">Rent</div>
                        <div className="col-span-1">Status</div>
                        <div className="col-span-1 text-right">Actions</div>
                    </div>
                    {/* Table rows */}
                    <div className="divide-y divide-white/5">
                        {tenants.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm text-neutral-500">
                                No tenants found. {search ? "Try a different search." : "Click Add Tenant to register your first tenant."}
                            </div>
                        )}
                        {tenants.map((t) => (
                            <TenantRowClickable
                                key={t.id}
                                tenantId={t.id}
                            >
                                {/* Name avatar */}
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                        {initials(t.firstName, t.lastName)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{t.firstName} {t.lastName}</p>
                                        <p className="text-xs text-neutral-500 truncate">ID: {t.id.substring(0, 8)}…</p>
                                    </div>
                                </div>
                                {/* Contact */}
                                <div className="col-span-2 hidden md:block space-y-0.5">
                                    <p className="text-xs text-neutral-300 flex items-center gap-1">
                                        <Mail className="h-3 w-3 text-neutral-500 flex-shrink-0" />
                                        <span className="truncate">{t.email ?? "—"}</span>
                                    </p>
                                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-neutral-500" />
                                        {t.phone ?? "—"}
                                    </p>
                                </div>
                                {/* Unit */}
                                <div className="col-span-3 hidden lg:block">
                                    <p className="text-sm font-medium text-white">{t.unitNumber ?? "—"}</p>
                                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                                        <Building2 className="h-3 w-3" />{t.propertyName ?? "—"}
                                    </p>
                                </div>
                                {/* Rent */}
                                <div className="col-span-2">
                                    {t.rentAmount ? (
                                        <>
                                            <p className="text-sm font-semibold text-white">KES {t.rentAmount.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-500">/ month</p>
                                        </>
                                    ) : (
                                        <span className="text-sm text-neutral-600">—</span>
                                    )}
                                </div>
                                {/* Status */}
                                <div className="col-span-1">
                                    {statusBadge(t.status)}
                                </div>
                                {/* Actions */}
                                <div className="col-span-1 flex justify-end">
                                    <TenantRowActions role={role} tenant={t} properties={propertiesResult.data?.data ?? []} />
                                </div>
                            </TenantRowClickable>
                        ))}
                    </div>

                    {meta && (
                        <div className="px-6 border-t border-white/10">
                            <Pagination
                                currentPage={meta.page}
                                totalPages={meta.totalPages}
                                onPageChange={onPageChangeAction}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
