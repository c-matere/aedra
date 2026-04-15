"use client"

import { useState } from "react"
import { PropertyRecord } from "@/lib/backend-api"
import { UserRole } from "@/lib/rbac"
import { Building2, MapPin } from "lucide-react"
import { PropertyRowActions } from "./property-actions"
import { PropertyDetailsPanel } from "./property-details"

interface PropertiesListClientProps {
    properties: PropertyRecord[]
    token: string
    role: UserRole | null
}

function occupancyColor(occupied: number, total: number) {
    if (total === 0) return "text-neutral-400"
    const pct = occupied / total
    if (pct >= 0.9) return "text-emerald-400"
    if (pct >= 0.7) return "text-white"
    return "text-red-400"
}

function occupancyBar(occupied: number, total: number) {
    if (total === 0) return "bg-white/20"
    const pct = occupied / total
    if (pct >= 0.9) return "bg-emerald-500"
    if (pct >= 0.7) return "bg-white/60"
    return "bg-red-500"
}

function statusBadge(status: string | undefined) {
    const s = status ?? "Active"
    if (s === "Active" || s === "ACTIVE")
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
            </span>
        )
    if (s.toLowerCase().includes("renovation") || s.toLowerCase().includes("inactive"))
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {s}
            </span>
        )
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
            {s}
        </span>
    )
}

function typeBadge(type: string | undefined) {
    return (
        <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-white/5 border border-white/10 text-neutral-300">
            {type ?? "—"}
        </span>
    )
}

export function PropertiesListClient({ properties, token, role }: PropertiesListClientProps) {
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

    return (
        <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <div className="col-span-8 md:col-span-4">Property</div>
                <div className="col-span-2 hidden md:block">Type</div>
                <div className="col-span-3 md:col-span-3 lg:col-span-2">Occupancy</div>
                <div className="col-span-2 hidden lg:block">Revenue</div>
                <div className="col-span-2 hidden md:block lg:col-span-1">Status</div>
                <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-white/5">
                {properties.length === 0 && (
                    <div className="px-6 py-8 text-center text-sm text-neutral-500">
                        No properties found.
                    </div>
                )}
                {properties.map((p) => {
                    const occupied = p.occupiedUnits ?? 0
                    const total = p.totalUnits ?? 0

                    return (
                        <div
                            key={p.id}
                            onClick={() => setSelectedPropertyId(p.id)}
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                            {/* Name + address */}
                            <div className="col-span-8 md:col-span-4 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
                                    <Building2 className="h-4 w-4 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-neutral-100 truncate group-hover:text-emerald-400 transition-colors">{p.name}</p>
                                    <p className="text-xs text-neutral-500 flex items-center gap-1 truncate font-medium">
                                        <MapPin className="h-3 w-3" />{p.address ?? "—"}
                                    </p>
                                </div>
                            </div>
                            {/* Type */}
                            <div className="col-span-2 hidden md:block">
                                {typeBadge(p.propertyType)}
                            </div>
                            {/* Occupancy */}
                            <div className="col-span-3 md:col-span-3 lg:col-span-2">
                                {total > 0 ? (
                                    <>
                                        <div className={`text-sm font-bold ${occupancyColor(occupied, total)}`}>
                                            {occupied}/{total}
                                        </div>
                                        <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden hidden sm:block">
                                            <div
                                                className={`h-full rounded-full transition-all ${occupancyBar(occupied, total)}`}
                                                style={{ width: `${(occupied / total) * 100}%` }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-sm text-neutral-600">—</span>
                                )}
                            </div>
                            {/* Revenue */}
                            <div className="col-span-2 hidden lg:block">
                                {p.monthlyRevenue ? (
                                    <>
                                        <p className="text-sm font-bold text-neutral-100 tracking-tight">KES {p.monthlyRevenue.toLocaleString()}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] font-bold mt-0.5">/ month</p>
                                    </>
                                ) : (
                                    <span className="text-sm text-neutral-600">—</span>
                                )}
                            </div>
                            {/* Status */}
                            <div className="col-span-2 hidden md:block lg:col-span-1">
                                {statusBadge(p.status)}
                            </div>
                            {/* Actions */}
                            <div className="col-span-1 flex justify-end">
                                <PropertyRowActions role={role} property={p} />
                            </div>
                        </div>
                    )
                })}
            </div>

            <PropertyDetailsPanel
                propertyId={selectedPropertyId}
                token={token}
                role={role}
                onClose={() => setSelectedPropertyId(null)}
            />
        </>
    )
}
