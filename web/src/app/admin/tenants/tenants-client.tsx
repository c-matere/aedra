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
import { AddTenantButton, TenantRowActions } from "./tenant-actions"
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
    const normalized = s.toUpperCase()
    if (normalized === "ACTIVE" || normalized === "Active")
        return (
            <Badge variant="outline" className="bg-[#ccdbe8] border-[#dedcd1] text-[#141413] gap-1.5 rounded-[9.6px] shadow-none hover:bg-[#ccdbe8]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1f1e1d]" /> Active
            </Badge>
        )
    if (normalized === "EXPIRING" || normalized === "Expiring Soon")
        return (
            <Badge variant="outline" className="bg-red-50/5 border border-red-500/20 text-red-800 gap-1.5 rounded-[9.6px] shadow-none hover:bg-red-50/5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-800" /> Expiring
            </Badge>
        )
    return (
        <Badge variant="outline" className="bg-[#f0eee6] border-[#dedcd1] text-[#73726c] rounded-[9.6px] shadow-none hover:bg-[#f0eee6]">
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
                    <h1 className="text-3xl font-normal font-serif text-[#141413] tracking-tight">
                        Tenants
                    </h1>
                    <p className="text-[#73726c] text-sm">
                        {meta?.total ?? tenants.length} {(meta?.total ?? tenants.length) === 1 ? "tenant" : "tenants"} registered
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#73726c] pointer-events-none" />
                        <form action={onSearch}>
                            <input
                                name="search"
                                placeholder="Search tenants..."
                                defaultValue={search}
                                className="h-9 w-[220px] rounded-[9.6px] border border-[#dedcd1] bg-[#ffffff] pl-9 pr-3 text-sm text-[#141413] placeholder-[#9c9a92] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                            />
                        </form>
                    </div>
                    <AddTenantButton role={role} properties={properties} />
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Total Tenants</CardTitle>
                        <Users className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-[#141413] group-hover:translate-x-0.5 transition-transform">{meta?.total ?? tenants.length}</div>
                        <p className="text-[10px] text-[#73726c] uppercase font-bold tracking-wider mt-1">across all properties</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Active Leases</CardTitle>
                        <UserCheck className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-[#141413] group-hover:translate-x-0.5 transition-transform">{active}</div>
                        <p className="text-[10px] text-[#73726c] uppercase font-bold tracking-wider mt-1">in good standing</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Expiring Soon</CardTitle>
                        <CalendarDays className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-[#141413] group-hover:translate-x-0.5 transition-transform">{expiring}</div>
                        <p className="text-[10px] text-[#73726c] uppercase font-bold tracking-wider mt-1">leases ending within 90 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tenants table */}
            <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-normal font-serif text-[#141413]">All Tenants</CardTitle>
                    <CardDescription className="text-[#73726c]">
                        Manage contact details and platform-wide occupancy history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#dedcd1] text-[10px] font-bold uppercase tracking-[0.15em] text-[#73726c]">
                        <div className="col-span-4">Tenant Identity</div>
                        <div className="col-span-3 hidden md:block">Current Placement</div>
                        <div className="col-span-3">Financial Standing</div>
                        <div className="col-span-2 text-right">Context</div>
                    </div>
                    
                    <div className="divide-y divide-[#dedcd1]">
                        {tenants.map((t) => (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedTenantId(t.id)}
                                className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-[#f0eee6] transition-all cursor-pointer group"
                            >
                                <div className="col-span-4 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-xs font-bold text-[#1f1e1d] flex-shrink-0 group-hover:border-[#1f1e1d] transition-colors shadow-none">
                                        {initials(t.firstName, t.lastName)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#1f1e1d] group-hover:underline transition-colors truncate">{t.firstName} {t.lastName}</p>
                                        <p className="text-[11px] text-[#73726c] flex items-center gap-1.5 mt-0.5">
                                            <Mail className="h-3 w-3" /> {t.email || "No email"}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-span-3 hidden md:block">
                                    <p className="text-sm font-normal font-serif text-[#141413] truncate">{t.propertyName || "—"}</p>
                                    <p className="text-[11px] text-[#73726c] flex items-center gap-1.5 mt-0.5 font-medium">
                                        <Building2 className="h-3 w-3" /> Unit {t.unitNumber || "N/A"}
                                    </p>
                                </div>

                                <div className="col-span-3">
                                    <p className="text-sm font-normal font-serif text-[#141413]">KES {t.rentAmount?.toLocaleString() || "—"}</p>
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
                        <div className="px-6 py-4 border-t border-[#dedcd1]">
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
