"use client"

import { useState, useEffect } from "react"
import {
    FileText,
    Clock,
    User,
    Activity,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Receipt,
    CreditCard,
    Plus,
    History as HistoryIcon,
    Calendar,
    ChevronRight,
    Loader2,
    TrendingUp,
    Briefcase
} from "lucide-react"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelDescription,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelTrigger,
} from "@/components/ui/slide-panel"
import { Button } from "@/components/ui/button"
import {
    listPayments,
    listInvoices,
    type LeaseRecord,
    type PaymentRecord,
    type InvoiceRecord,
    type AuditLogRecord
} from "@/lib/backend-api"
import { getAuditLogsAction } from "@/lib/actions"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Refreshed component reference
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface LeaseDetailsPanelProps {
    lease: LeaseRecord
    token: string
    children?: React.ReactNode
}

export function LeaseDetailsPanel({ lease, token, children }: LeaseDetailsPanelProps) {
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("summary")
    const [loading, setLoading] = useState(false)
    const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            fetchTabData(activeTab)
        }
    }, [open, activeTab])

    async function fetchTabData(tab: string) {
        setLoading(true)
        setError(null)
        try {
            if (tab === "history") {
                const res = await getAuditLogsAction({ targetId: lease.id, limit: 50 })
                setAuditLogs(res.data?.logs || [])
            } else if (tab === "financials") {
                // Filtering happens on client for now as backend filter might be limited
                const [payRes, invRes] = await Promise.all([
                    listPayments(token, { limit: 100 }),
                    listInvoices(token, { limit: 100 })
                ])
                setPayments((payRes.data?.data || []).filter(p => p.leaseId === lease.id))
                setInvoices((invRes.data?.data || []).filter(i => i.leaseId === lease.id))
            }
        } catch (err) {
            setError("Failed to fetch data")
        } finally {
            setLoading(false)
        }
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                {children}
            </SlidePanelTrigger>
            <SlidePanelContent className="sm:max-w-2xl border-l border-white/5 bg-neutral-950/95 backdrop-blur-xl">
                <SlidePanelHeader className="border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Briefcase className="h-6 w-6 text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <SlidePanelTitle className="text-2xl font-black text-white tracking-tight">
                                {lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : "Lease Details"}
                            </SlidePanelTitle>
                            <SlidePanelDescription className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] font-black tracking-widest uppercase bg-white/5 border-white/10 text-neutral-400">
                                    {lease.status}
                                </Badge>
                                <span className="text-neutral-500 text-xs font-medium">· Unit {lease.unit?.unitNumber || lease.unitId}</span>
                            </SlidePanelDescription>
                        </div>
                    </div>
                </SlidePanelHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-6">
                    <TabsList className="bg-white/5 border border-white/5 p-1 rounded-xl w-full grid grid-cols-3">
                        <TabsTrigger value="summary" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white/10">Summary</TabsTrigger>
                        <TabsTrigger value="financials" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white/10">Financials</TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white/10">History</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto pt-6 pr-2 custom-scrollbar">
                        <TabsContent value="summary" className="mt-0 space-y-8">
                            {/* KPI Metrics */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10">
                                    <span className="text-[9px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-blue-400">
                                        <TrendingUp className="h-3 w-3" /> Rent
                                    </span>
                                    <span className="text-lg font-black text-white">KES {lease.rentAmount?.toLocaleString()}</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10">
                                    <span className="text-[9px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" /> Deposit
                                    </span>
                                    <span className="text-lg font-black text-white">KES {lease.deposit?.toLocaleString() || "—"}</span>
                                </div>
                                <div className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10 ${lease.balance && lease.balance > 0 ? 'ring-1 ring-red-500/50 bg-red-500/5' : ''}`}>
                                    <span className="text-[9px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-red-400">
                                        <AlertCircle className="h-3 w-3" /> Balance
                                    </span>
                                    <span className={`text-lg font-black ${lease.balance && lease.balance > 0 ? 'text-red-400' : 'text-white'}`}>KES {lease.balance?.toLocaleString() || 0}</span>
                                </div>
                            </div>

                            <section className="space-y-4">
                                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Lease Terms</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Start Date</p>
                                        <p className="text-sm font-bold text-white flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                                            {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">End Date</p>
                                        <p className="text-sm font-bold text-white flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                                            {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Continuous'}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Quick Actions</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button variant="outline" className="h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 font-bold">
                                        <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                                    </Button>
                                    <Button variant="outline" className="h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-blue-500/10 hover:text-blue-400 font-bold">
                                        <Receipt className="mr-2 h-4 w-4" /> Raise Invoice
                                    </Button>
                                </div>
                            </section>
                        </TabsContent>

                        <TabsContent value="financials" className="mt-0 space-y-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    <p className="text-xs font-black text-neutral-500 uppercase tracking-widest animate-pulse">Reconciling Ledger...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Statement of Account</h3>
                                        <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-neutral-500">LAST 12 MONTHS</span>
                                    </div>
                                    <div className="space-y-2">
                                        {[...invoices.map(i => ({ ...i, entryType: 'INVOICE' })), ...payments.map(p => ({ ...p, entryType: 'PAYMENT' }))]
                                            .sort((a, b) => new Date(b.dueDate || (b as any).paidAt).getTime() - new Date(a.dueDate || (a as any).paidAt).getTime())
                                            .map((entry: any, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${entry.entryType === 'INVOICE' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                            {entry.entryType === 'INVOICE' ? <Receipt className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-white uppercase tracking-tighter">{entry.description || entry.type || entry.method || entry.entryType}</p>
                                                            <p className="text-[10px] text-neutral-600 font-medium">{new Date(entry.dueDate || entry.paidAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-sm font-black ${entry.entryType === 'INVOICE' ? 'text-white' : 'text-emerald-400'}`}>
                                                            {entry.entryType === 'INVOICE' ? '-' : '+'} KES {entry.amount.toLocaleString()}
                                                        </p>
                                                        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">{entry.status || "CLEARED"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        {invoices.length === 0 && payments.length === 0 && (
                                            <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl italic text-neutral-600 text-xs font-black tracking-widest uppercase">
                                                No financial movements recorded
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-0">
                             {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
                                </div>
                            ) : (
                                <div className="relative border-l border-white/10 ml-3 space-y-8 pb-8 mt-4">
                                    {auditLogs.map((log) => (
                                        <div key={log.id} className="relative pl-8">
                                            <div className={cn(
                                                "absolute left-[-5.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 shadow-[0_0_8px_rgba(255,255,255,0.1)]",
                                                log.outcome === "SUCCESS" ? "bg-neutral-600" : "bg-red-500"
                                            )} />
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-black text-white uppercase tracking-tighter">
                                                        {log.action} {log.entity || 'LEASE'}
                                                    </p>
                                                    <Badge variant="ghost" className={`text-[8px] font-black uppercase px-1 h-3.5 ${log.outcome === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}`}>{log.outcome}</Badge>
                                                </div>
                                                <p className="text-[10px] text-neutral-500 font-medium">{new Date(log.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <div className="py-20 text-center text-neutral-600 text-xs italic uppercase font-black tracking-widest">Zero historical logs</div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </SlidePanelContent>
        </SlidePanel>
    )
}
