"use client"

import { useState, useEffect } from "react"
import {
    Home,
    MapPin,
    Users,
    TrendingUp,
    Calendar,
    FileText,
    CreditCard,
    ChevronRight,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    Clock,
    User,
    Mail,
    Phone,
    Plus
} from "lucide-react"
import { AddInvoiceButton, AddPaymentButton, VacationNoticeButton, TerminateLeaseButton, CreateLeaseButton, ViewStatementButton } from "./lease-actions"
import { UserRole } from "@/lib/rbac"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelDescription
} from "@/components/ui/slide-panel"
import { getUnitById, listTenants, type UnitRecord, type TenantRecord } from "@/lib/backend-api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface UnitDetailsPanelProps {
    unitId: string | null
    token: string
    role: UserRole | null
    onClose: () => void
}

export function UnitDetailsPanel({ unitId, token, role, onClose }: UnitDetailsPanelProps) {
    const [unit, setUnit] = useState<UnitRecord | null>(null)
    const [tenants, setTenants] = useState<TenantRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchDetails = async () => {
        if (!unitId) return
        setLoading(true)
        setError(null)
        const res = await getUnitById(token, unitId)
        if (res.error) {
            setError(res.error)
        } else {
            setUnit(res.data)
        }
        
        // Also fetch tenants if they haven't been fetched yet
        if (tenants.length === 0) {
            const tenantsRes = await listTenants(token, { limit: 100 })
            if (!tenantsRes.error && tenantsRes.data) {
                setTenants(tenantsRes.data.data)
            }
        }

        setLoading(false)
    }

    useEffect(() => {
        if (!unitId) {
            setUnit(null)
            return
        }
        fetchDetails()
    }, [unitId, token])

    return (
        <SlidePanel open={!!unitId} onOpenChange={(open) => !open && onClose()}>
            <SlidePanelContent
                className="sm:max-w-3xl border-l border-[#dedcd1] bg-[#ffffff] shadow-none p-0"
                zIndex={200}
            >
                <div className="flex flex-col h-full p-6">
                    <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
                        <div className="flex items-center gap-4 mb-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-8 w-8 rounded-[9.6px] hover:bg-[#f0eee6] -ml-2"
                            >
                                <ArrowLeft className="h-4 w-4 text-[#73726c]" />
                            </Button>
                            <div className={cn(
                                "h-12 w-12 rounded-[9.6px] flex items-center justify-center border",
                                unit?.status === 'OCCUPIED' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' :
                                'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                            )}>
                                <Home className="h-6 w-6" />
                            </div>
                            <div>
                                <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">
                                    {loading ? "Loading..." : unit ? `Unit ${unit.unitNumber}` : "Unit Details"}
                                </SlidePanelTitle>
                                <SlidePanelDescription className="flex items-center gap-1.5 mt-1 text-[#73726c]">
                                    <MapPin className="h-3.5 w-3.5 text-[#9c9a92]" />
                                    {unit?.property?.name || "Property Unknown"} • {unit?.floor ? `Floor ${unit.floor}` : "Ground Floor"}
                                </SlidePanelDescription>
                            </div>
                        </div>
                    </SlidePanelHeader>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#73726c]">
                            <Loader2 className="h-8 w-8 animate-spin text-[#1f1e1d]" />
                            <p className="text-sm font-medium animate-pulse">Fetching unit history...</p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <h3 className="text-[#141413] font-semibold mb-2">Failed to load unit</h3>
                            <p className="text-[#73726c] text-sm mb-6">{error}</p>
                            <Button variant="outline" onClick={onClose}>Close</Button>
                        </div>
                    ) : unit ? (
                        <div className="flex-1 overflow-y-auto py-8 space-y-8 pr-2 custom-scrollbar">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="bg-[#ffffff] border-[#dedcd1] flex flex-col items-center justify-center p-4 shadow-none rounded-[16px]">
                                    <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest mb-1">Status</span>
                                    <Badge className={cn("rounded-[9.6px] border shadow-none",
                                        unit.status === 'OCCUPIED' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' :
                                        'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                                    )}>
                                        {unit.status}
                                    </Badge>
                                </Card>
                                <Card className="bg-[#ffffff] border-[#dedcd1] p-4 shadow-none rounded-[16px]">
                                    <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                        <TrendingUp className="h-3 w-3 text-[#9c9a92]" /> Rent
                                    </span>
                                    <div className="text-lg font-normal font-serif text-[#141413]">KES {unit.rentAmount?.toLocaleString()}</div>
                                </Card>
                                <Card className="bg-[#ffffff] border-[#dedcd1] p-4 shadow-none rounded-[16px]">
                                    <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                        <Users className="h-3 w-3 text-[#9c9a92]" /> Specs
                                    </span>
                                    <div className="text-lg font-normal font-serif text-[#141413]">{unit.bedrooms}BR · {unit.bathrooms}BA</div>
                                </Card>
                                <Card className="bg-[#ffffff] border-[#dedcd1] p-4 shadow-none rounded-[16px]">
                                    <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                        <Home className="h-3 w-3 text-[#9c9a92]" /> Size
                                    </span>
                                    <div className="text-lg font-normal font-serif text-[#141413]">{unit.sizeSqm ? `${unit.sizeSqm}m²` : "—"}</div>
                                </Card>
                            </div>

                            {/* Leases History */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                    Lease History ({unit.leases?.length || 0})
                                    <CreateLeaseButton unit={unit} role={role} tenants={tenants} onSuccess={fetchDetails} />
                                </h3>

                                {unit.leases && unit.leases.length > 0 ? (
                                    <div className="space-y-6">
                                        {unit.leases.map((lease) => (
                                            <Card key={lease.id} className="bg-[#ffffff] border-[#dedcd1] rounded-[16px] overflow-hidden shadow-none">
                                                <div className="bg-[#f0eee6] px-4 py-3 flex items-center justify-between border-b border-[#dedcd1]">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-[#1f1e1d]">
                                                        <Calendar className="h-4 w-4 text-[#73726c]" />
                                                        {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : 'N/A'}
                                                        <ChevronRight className="h-3 w-3 text-[#73726c]" />
                                                        {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Active'}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {lease.status === 'ACTIVE' && (
                                                            <>
                                                                <VacationNoticeButton leaseId={lease.id} unitId={unit.id} role={role} onSuccess={fetchDetails} />
                                                                <TerminateLeaseButton leaseId={lease.id} unitId={unit.id} role={role} onSuccess={fetchDetails} />
                                                            </>
                                                        )}
                                                        <Badge className={cn("rounded-[9.6px] border shadow-none",
                                                            lease.status === 'ACTIVE' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' : 'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                                                        )}>
                                                            {lease.status}
                                                        </Badge>
                                                        {lease.status === 'ACTIVE' && <ViewStatementButton leaseId={lease.id} />}
                                                    </div>
                                                </div>

                                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-[#73726c] uppercase tracking-wider">Tenant</p>
                                                        <div className="flex items-start gap-3">
                                                            <div className="h-10 w-10 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#1f1e1d]">
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-serif font-normal text-[#141413] text-sm">
                                                                    {lease.tenant?.firstName || 'Unknown'} {lease.tenant?.lastName || 'Tenant'}
                                                                </h4>
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    <span className="flex items-center gap-1 text-[11px] text-[#73726c]">
                                                                        <Mail className="h-3 w-3 text-[#73726c]" /> {lease.tenant?.email || '—'}
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-[11px] text-[#73726c]">
                                                                        <Phone className="h-3 w-3 text-[#73726c]" /> {lease.tenant?.phone || '—'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-[#73726c] uppercase tracking-wider">Financials</p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-[#f0eee6] p-2 rounded-[9.6px] border border-[#dedcd1]">
                                                                <p className="text-[9px] text-[#73726c] uppercase">Rent</p>
                                                                <p className="text-sm font-normal font-serif text-[#141413]">KES {lease.rentAmount?.toLocaleString() || 0}</p>
                                                            </div>
                                                            <div className="bg-[#f0eee6] p-2 rounded-[9.6px] border border-[#dedcd1]">
                                                                <p className="text-[9px] text-[#73726c] uppercase">Deposit</p>
                                                                <p className="text-sm font-normal font-serif text-[#141413]">KES {lease.deposit?.toLocaleString() || 0}</p>
                                                            </div>
                                                            {(lease as any).balance !== undefined && (lease as any).balance > 0 && (
                                                                <div className="bg-red-500/5 p-2 rounded-[9.6px] border border-red-500/20 col-span-2 text-red-800 text-sm font-normal font-serif">
                                                                    <p className="text-[9px] text-red-800 font-bold uppercase">Outstanding Balance (Arrears)</p>
                                                                    <p className="text-sm font-normal font-serif text-red-800">KES {(lease as any).balance.toLocaleString()}</p>
                                                                </div>
                                                            )}
                                                            {(lease as any).balance !== undefined && (lease as any).balance <= 0 && (
                                                                <div className="bg-[#ccdbe8]/20 p-2 rounded-[9.6px] border border-[#dedcd1] col-span-2 text-sm font-normal font-serif">
                                                                    <p className="text-[9px] text-[#141413] font-bold uppercase">Balance</p>
                                                                    <p className="text-sm font-normal font-serif text-[#141413]">PAID UP</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                                    <FileText className="h-3 w-3 text-[#9c9a92]" /> Recent Invoices
                                                                </h5>
                                                                <AddInvoiceButton leaseId={lease.id} role={role} onSuccess={fetchDetails} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                {lease.invoices && lease.invoices.length > 0 ? (
                                                                    lease.invoices.slice(0, 3).map(inv => (
                                                                        <div key={inv.id} className="flex items-center justify-between p-2 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] text-[#1f1e1d]">
                                                                            <span className="text-[11px] text-[#73726c] truncate max-w-[150px]">{inv.description}</span>
                                                                            <span className="text-[11px] font-normal font-serif text-[#141413]">KES {inv.amount?.toLocaleString() || 0}</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-[10px] text-[#73726c] italic">None</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                                    <CreditCard className="h-3 w-3 text-[#9c9a92]" /> Recent Payments
                                                                </h5>
                                                                <AddPaymentButton leaseId={lease.id} role={role} onSuccess={fetchDetails} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                {lease.payments && lease.payments.length > 0 ? (
                                                                    lease.payments.slice(0, 3).map(pmt => (
                                                                        <div key={pmt.id} className="flex items-center justify-between p-2 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] text-[#1f1e1d]">
                                                                            <span className="text-[11px] text-[#73726c]">{pmt.method}</span>
                                                                            <span className="text-[11px] font-normal font-serif text-[#141413]">KES {pmt.amount?.toLocaleString() || 0}</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-[10px] text-[#73726c] italic">None</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 rounded-[16px] border border-dashed border-[#dedcd1] bg-[#f0eee6]/10">
                                        <p className="text-sm text-[#73726c]">No occupancy history registered.</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    ) : null}
                </div>
            </SlidePanelContent>
        </SlidePanel>
    )
}
