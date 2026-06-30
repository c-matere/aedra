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
import { cn } from "@/lib/utils"

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
            <SlidePanelContent className="sm:max-w-2xl border-l border-[#dedcd1] bg-[#ffffff] shadow-none">
                <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#1f1e1d]">
                            <User className="h-6 w-6 text-[#141413]" />
                        </div>
                        <div>
                            <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">
                                {loading ? "Loading..." : tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant Details"}
                            </SlidePanelTitle>
                            <SlidePanelDescription className="flex items-center gap-1.5 mt-1 text-[#73726c]">
                                <Badge className={cn("rounded-[9.6px] border shadow-none", 
                                    tenant?.status === 'ACTIVE' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' : 'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                                )}>
                                    {tenant?.status || "PROSPECT"}
                                </Badge>
                                <span>· Member since {tenant && new Date().getFullYear()}</span>
                            </SlidePanelDescription>
                        </div>
                    </div>
                </SlidePanelHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#73726c]">
                        <Loader2 className="h-8 w-8 animate-spin text-[#1f1e1d]" />
                        <p className="text-sm font-medium animate-pulse">Synchronizing Profile...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="h-12 w-12 text-red-800 mb-4" />
                        <h3 className="text-[#141413] font-semibold mb-2">Sync Error</h3>
                        <p className="text-[#73726c] text-sm mb-6">{error}</p>
                        <Button variant="outline" onClick={() => onClose()}>Close Details</Button>
                    </div>
                ) : tenant ? (
                    <div className="flex-1 overflow-y-auto py-8 space-y-8 pr-2 custom-scrollbar">
                        {/* Essential Identity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6] shadow-none">
                                <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-[#9c9a92]" /> Email
                                </span>
                                <span className="text-sm font-normal font-serif text-[#141413] truncate">{tenant.email || "No email provided"}</span>
                            </div>
                            <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6] shadow-none">
                                <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-[#9c9a92]" /> Phone
                                </span>
                                <span className="text-sm font-normal font-serif text-[#141413]">{tenant.phone || "No phone provided"}</span>
                            </div>
                        </div>

                        {/* Current Placement */}
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                Current Placement
                            </h3>
                            <Card className="bg-[#ffffff] border-[#dedcd1] rounded-[16px] overflow-hidden shadow-none">
                                <CardContent className="p-6">
                                    {tenant.unitNumber ? (
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center flex-shrink-0 text-[#1f1e1d]">
                                                    <Building2 className="h-6 w-6 text-[#141413]" />
                                                </div>
                                                <div>
                                                    <p className="font-serif font-normal text-sm text-[#141413]">{tenant.propertyName}</p>
                                                    <p className="text-xs text-[#73726c] flex items-center gap-1.5 mt-0.5">
                                                        Unit {tenant.unitNumber}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-[#73726c] uppercase tracking-tighter">Rent Amount</span>
                                                            <span className="text-sm font-normal font-serif text-[#141413]">KES {tenant.rentAmount?.toLocaleString() || "—"}</span>
                                                        </div>
                                                        <div className="flex flex-col border-l border-[#dedcd1] pl-4">
                                                            <span className="text-[9px] font-bold text-[#73726c] uppercase tracking-tighter">Next Due</span>
                                                            <span className="text-sm font-normal font-serif text-[#141413]">May 1st, 2026</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-[#73726c] hover:text-[#141413]">
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8 text-[#9c9a92]" />
                                            <p className="text-sm text-[#73726c] italic">No active lease found for this tenant.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </section>

                        {/* Lease History */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-[#9c9a92]" /> Lease History
                                </h3>
                                <span className="text-[10px] font-bold text-[#73726c] bg-[#f0eee6] border border-[#dedcd1] px-2 py-0.5 rounded-[9.6px]">{leases.length} RECORDS</span>
                            </div>

                            <div className="space-y-2">
                                {leases.length > 0 ? (
                                    leases.map((lease) => (
                                        <div 
                                            key={lease.id} 
                                            onClick={() => window.open(`/admin/properties/leases/${lease.id}/statement`, '_blank')}
                                            className="group p-4 rounded-[16px] bg-[#ffffff] border border-[#dedcd1] hover:bg-[#f0eee6] hover:border-[#dedcd1] transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] shadow-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("h-10 w-10 rounded-[9.6px] flex items-center justify-center border",
                                                    lease.status === 'ACTIVE' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' : 'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                                                )}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-[#1f1e1d] uppercase tracking-tight group-hover:underline">Lease #{lease.id.slice(0, 5)}</p>
                                                        {lease.status === 'ACTIVE' && (
                                                            <span className="text-[8px] font-bold bg-[#ccdbe8] text-[#141413] border border-[#dedcd1] px-1.5 py-0.5 rounded-[9.6px] uppercase tracking-widest shadow-none">Active</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-[#73726c] mt-0.5 uppercase font-medium tracking-tighter">
                                                        {lease.startDate ? new Date(lease.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} — {lease.endDate ? new Date(lease.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs font-normal font-serif text-[#141413]">KES {lease.rentAmount?.toLocaleString()}</p>
                                                    <p className="text-[9px] text-[#73726c] uppercase font-bold">Monthly Rent</p>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-[#73726c] group-hover:text-[#141413] group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-[#dedcd1] rounded-[16px] bg-[#f0eee6]/20">
                                        <p className="text-xs text-[#73726c] italic uppercase font-bold tracking-widest">Zero historical data</p>
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
