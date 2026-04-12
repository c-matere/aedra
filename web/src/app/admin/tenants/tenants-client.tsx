"use client"

import { useState } from "react"
import {
    Users,
    Mail,
    Phone,
    Search,
    Building2,
    CalendarDays,
    UserCheck,
    MoreHorizontal
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TenantDetailsPanel } from "./tenant-details"
import { TenantRowActions } from "./tenant-actions"
import type { TenantRecord, PropertyRecord, PaginatedResponse } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"
import { Pagination } from "@/components/ui/pagination"

interface TenantsClientProps {
    tenants: TenantRecord[]
    properties: PropertyRecord[]
    meta?: PaginatedResponse<TenantRecord>["meta"]
    role: UserRole | null
    token: string
    search: string
    onSearch: (formData: FormData) => void
    onPageChange: (page: number) => void
}

function statusBadge(status: string | undefined) {
    const s = status ?? "Active"
    if (s === "Active" || s === "ACTIVE")
        return (
            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
            </Badge>
        )
    if (s === "Expiring Soon" || s === "EXPIRING")
        return (
            <Badge variant="outline" className="bg-red-500/10 border-red-500/20 text-red-400 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Expiring
            </Badge>
        )
    return (
        <Badge variant="outline" className="bg-neutral-500/10 border-white/10 text-neutral-400 tracking-tight">
            {s}
        </Badge>
    )
}

function initials(first: string, last: string) {
    return `${first[0] ?? "?"}${last[0] ?? "?"}`.toUpperCase()
}

export function TenantsClient({ tenants, properties, meta, role, token, search, onSearch, onPageChange }: TenantsClientProps) {
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

    const active = tenants.filter(t => t.status === "Active" || t.status === "ACTIVE" || !t.status).length
    const expiring = tenants.filter(t => t.status === "Expiring Soon" || t.status === "EXPIRING").length

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Page header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                        Tenants
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        {meta?.total ?? tenants.length} {(meta?.total ?? tenants.length) === 1 ? "tenant" : "tenants"} registered
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
                        <form action={onSearch}>
                            <input
                                name="search"
                                placeholder="Search tenants..."
                                defaultValue={search}
                                className="h-9 w-[220px] rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
                            />
                        </form>
                    </div>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-white/5 border-white/10 group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total Tenants</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">{meta?.total ?? tenants.length}</div>
                        <p className="text-[10px] text-neutral-600 uppercase font-black mt-1">across all properties</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active Leases</CardTitle>
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-400 group-hover:translate-x-1 transition-transform">{active}</div>
                        <p className="text-[10px] text-neutral-600 uppercase font-black mt-1">in good standing</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Expiring Soon</CardTitle>
                        <CalendarDays className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-black group-hover:translate-x-1 transition-transform ${expiring > 0 ? "text-red-400" : "text-white"}`}>{expiring}</div>
                        <p className="text-[10px] text-neutral-600 uppercase font-black mt-1">leases ending within 90 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tenants table */}
            <Card className="bg-neutral-900 border-white/10">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold text-white">All Tenants</CardTitle>
                    <CardDescription className="text-neutral-500">
                        Manage contact details and platform-wide occupancy history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        <div className="col-span-4">Tenant Identity</div>
                        <div className="col-span-3 hidden md:block">Current Placement</div>
                        <div className="col-span-3">Financial Standing</div>
                        <div className="col-span-2 text-right">Context</div>
                    </div>
                    
                    <div className="divide-y divide-white/5">
                        {tenants.map((t) => (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedTenantId(t.id)}
                                className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-white/[0.03] transition-all cursor-pointer group"
                            >
                                <div className="col-span-4 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white flex-shrink-0 group-hover:border-blue-500/50 transition-colors shadow-inner">
                                        {initials(t.firstName, t.lastName)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors truncate">{t.firstName} {t.lastName}</p>
                                        <p className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                            <Mail className="h-3 w-3" /> {t.email || "No email"}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-span-3 hidden md:block">
                                    <p className="text-sm font-bold text-white uppercase tracking-tighter truncate">{t.propertyName || "—"}</p>
                                    <p className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5 font-medium">
                                        <Building2 className="h-3 w-3" /> Unit {t.unitNumber || "N/A"}
                                    </p>
                                </div>

                                <div className="col-span-3">
                                    <p className="text-sm font-black text-white">KES {t.rentAmount?.toLocaleString() || "—"}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        {statusBadge(t.status)}
                                    </div>
                                </div>

                                <div className="col-span-2 flex justify-end">
                                    <TenantRowActions role={role} tenant={t} properties={properties} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {meta && (
                        <div className="px-6 py-4 border-t border-white/5">
                            <Pagination
                                currentPage={meta.page}
                                totalPages={meta.totalPages}
                                onPageChange={onPageChange}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <TenantDetailsPanel 
                tenantId={selectedTenantId}
                token={token}
                onClose={() => setSelectedTenantId(null)}
            />
        </div>
    )
}
