"use client"

import { useState, useEffect } from "react"
import {
    User,
    Mail,
    Phone,
    MapPin,
    FileText,
    ExternalLink,
    Loader2,
    Calendar,
    Building2,
    History,
    CheckCircle2,
    AlertCircle,
    ChevronRight
} from "lucide-react"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelDescription
} from "@/components/ui/slide-panel"
import { getTenantById, listLeases, type TenantRecord, type LeaseRecord } from "@/lib/backend-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface TenantDetailsPanelProps {
    tenantId: string | null
    token: string
    onClose: () => void
}

export function TenantDetailsPanel({ tenantId, token, onClose }: TenantDetailsPanelProps) {
    const [tenant, setTenant] = useState<TenantRecord | null>(null)
    const [leases, setLeases] = useState<LeaseRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!tenantId) {
            setTenant(null)
            setLeases([])
            return
        }

        async function fetchDetails() {
            setLoading(true)
            setError(null)
            try {
                const [tenantRes, leasesRes] = await Promise.all([
                    getTenantById(token, tenantId!),
                    listLeases(token, { tenantId: tenantId! })
                ])

                if (tenantRes.error) {
                    setError(tenantRes.error)
                } else {
                    setTenant(tenantRes.data)
                    setLeases(leasesRes.data?.data || [])
                }
            } catch (err) {
                setError("An unexpected error occurred.")
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
    }, [tenantId, token])

    return (
        <SlidePanel open={!!tenantId} onOpenChange={(open) => !open && onClose()}>
            <SlidePanelContent className="sm:max-w-2xl border-l border-white/5 bg-neutral-950/95 backdrop-blur-xl">
                <SlidePanelHeader className="border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <SlidePanelTitle className="text-2xl font-black text-white tracking-tight">
                                {loading ? "Loading..." : tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant Details"}
                            </SlidePanelTitle>
                            <SlidePanelDescription className="flex items-center gap-1.5 mt-1 font-medium">
                                <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${tenant?.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-400 border-white/10'}`}>
                                    {tenant?.status || "PROSPECT"}
                                </Badge>
                                <span className="text-neutral-500">· Member since {tenant && new Date().getFullYear()}</span>
                            </SlidePanelDescription>
                        </div>
                    </div>
                </SlidePanelHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Synchronizing Profile...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <h3 className="text-white font-bold mb-2">Sync Error</h3>
                        <p className="text-neutral-400 text-sm mb-6">{error}</p>
                        <Button variant="outline" onClick={() => onClose()}>Close Details</Button>
                    </div>
                ) : tenant ? (
                    <div className="flex-1 overflow-y-auto py-8 space-y-8 pr-2 custom-scrollbar">
                        {/* Essential Identity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.05]">
                                <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5">
                                    <Mail className="h-3 w-3 text-blue-400" /> Email
                                </span>
                                <span className="text-sm font-bold text-white truncate">{tenant.email || "No email provided"}</span>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.05]">
                                <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-emerald-400" /> Phone
                                </span>
                                <span className="text-sm font-bold text-white">{tenant.phone || "No phone provided"}</span>
                            </div>
                        </div>

                        {/* Current Placement */}
                        <section className="space-y-4">
                            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                Current Placement
                            </h3>
                            <Card className="bg-white/[0.02] border-white/10 overflow-hidden">
                                <CardContent className="p-6">
                                    {tenant.unitNumber ? (
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                    <Building2 className="h-6 w-6 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white">{tenant.propertyName}</p>
                                                    <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                                        Unit {tenant.unitNumber}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-tighter">Rent Amount</span>
                                                            <span className="text-sm font-black text-white">KES {tenant.rentAmount?.toLocaleString() || "—"}</span>
                                                        </div>
                                                        <div className="flex flex-col border-l border-white/10 pl-4">
                                                            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-tighter">Next Due</span>
                                                            <span className="text-sm font-black text-emerald-400">May 1st, 2026</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white">
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8 text-neutral-700" />
                                            <p className="text-sm text-neutral-500 italic">No active lease found for this tenant.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </section>

                        {/* Lease History */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <History className="h-3 w-3" /> Lease History
                                </h3>
                                <span className="text-[10px] font-black text-neutral-600 bg-white/5 px-2 py-0.5 rounded-full">{leases.length} RECORDS</span>
                            </div>

                            <div className="space-y-2">
                                {leases.length > 0 ? (
                                    leases.map((lease) => (
                                        <div key={lease.id} className="group p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${lease.status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-neutral-500/10 border-white/5 text-neutral-500'}`}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-white">Lease #{lease.id.slice(0, 5)}</p>
                                                        {lease.status === 'ACTIVE' && (
                                                            <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-widest">Active</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-neutral-500 mt-0.5 uppercase font-bold tracking-tighter">
                                                        {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : 'N/A'} — {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-white">KES {lease.rentAmount?.toLocaleString()}</p>
                                                    <p className="text-[9px] text-neutral-600 uppercase font-black">Monthly Rent</p>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-neutral-700 group-hover:text-white transition-colors" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl">
                                        <p className="text-xs text-neutral-600 italic uppercase font-black tracking-widest">Zero historical data</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                ) : null}
            </SlidePanelContent>
        </SlidePanel>
    )
}
