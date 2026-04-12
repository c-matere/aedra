"use client"

import React, { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Printer, Loader2, Calendar, ChevronLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchTenantStatement, getTenantStatementPdf, TenantStatementRecord } from "@/lib/backend-api"
import { format } from "date-fns"
import Link from "next/link"

export default function StatementClient({ token, leaseId }: { token: string, leaseId: string }) {
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [statement, setStatement] = useState<TenantStatementRecord | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)

    const startDate = searchParams.get("startDate") || ""
    const endDate = searchParams.get("endDate") || ""

    useEffect(() => {
        async function load() {
            if (!token || !leaseId) return
            setLoading(true)
            const res = await fetchTenantStatement(token, leaseId, {
                startDate: startDate || undefined,
                endDate: endDate || undefined
            })
            if (res.error) {
                setError(res.error)
            } else {
                setStatement(res.data)
            }
            setLoading(false)
        }
        load()
    }, [leaseId, token, startDate, endDate])

    const handleDownloadPdf = async () => {
        setDownloading(true)
        const res = await getTenantStatementPdf(token, leaseId, {
            startDate: startDate || undefined,
            endDate: endDate || undefined
        })
        if (res.data?.url) {
            // Trigger actual download link
            const link = document.createElement("a")
            link.href = res.data.url
            link.download = `statement_${leaseId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
        setDownloading(false)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                <p className="text-neutral-400 animate-pulse">Generating statement...</p>
            </div>
        )
    }

    if (error || !statement) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-6">
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl max-w-md text-center">
                    <h1 className="text-xl font-bold text-red-400 mb-2">Statement Error</h1>
                    <p className="text-neutral-400 mb-6">{error || "Failed to load statement data."}</p>
                    <Button onClick={() => window.history.back()} variant="outline" className="w-full">
                        <ChevronLeft className="h-4 w-4 mr-2" /> Go Back
                    </Button>
                </div>
            </div>
        )
    }

    const { company, tenant, property, unit, lease, ledger, summaries, openingBalance, closingBalance, range } = statement

    // Group ledger by month
    const groupedLedger: Record<string, typeof ledger> = {}
    ledger.forEach(item => {
        const month = format(new Date(item.date), "MMMM yyyy")
        if (!groupedLedger[month]) groupedLedger[month] = []
        groupedLedger[month].push(item)
    })

    return (
        <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 print:bg-white print:text-black py-8 px-4 sm:px-6 lg:px-8">
            {/* Action Bar (Hidden in Print) */}
            <div className="max-w-5xl mx-auto mb-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/properties`}>
                        <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                            <ChevronLeft className="h-4 w-4 mr-1" /> Dashboard
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white">Tenant Statement</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-900/20">
                        <Printer className="h-4 w-4 mr-2" /> Print Statement
                    </Button>
                    <Button onClick={handleDownloadPdf} disabled={downloading} variant="outline" className="border-white/10 hover:bg-white/5 text-neutral-300">
                        {downloading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 mr-2" />
                        )}
                        {downloading ? "Generating..." : "Save PDF"}
                    </Button>
                </div>
            </div>

            {/* Statement Container */}
            <div className="max-w-5xl mx-auto bg-white text-black shadow-2xl p-10 sm:p-16 relative overflow-hidden print:shadow-none print:p-0">
                
                {/* Header Strip */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900 print:hidden" />

                {/* Company Header */}
                <div className="flex flex-col md:flex-row justify-between gap-8 mb-12 border-b border-neutral-100 pb-12">
                    <div className="flex gap-6 items-start">
                        {company.logo ? (
                            <img src={company.logo} alt="Logo" className="w-20 h-20 object-contain grayscale" />
                        ) : (
                            <div className="w-20 h-20 bg-neutral-100 flex items-center justify-center font-bold text-3xl text-neutral-300">
                                {company.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-neutral-900 uppercase">{company.name}</h2>
                            <p className="text-neutral-500 max-w-xs text-sm mt-1 leading-relaxed">
                                {company.address || "No address provided"}
                            </p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col justify-end space-y-1">
                        <p className="text-sm font-medium text-neutral-600">Tel: {company.phone || "N/A"}</p>
                        <p className="text-sm text-neutral-500">{company.email || ""}</p>
                        {company.pinNumber && <p className="text-xs font-mono text-neutral-400 mt-2">PIN NO: {company.pinNumber}</p>}
                    </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">Client Information</h3>
                        <div>
                            <p className="text-sm font-bold text-neutral-900 leading-tight">{tenant.firstName} {tenant.lastName}</p>
                            <p className="text-xs text-neutral-500 mt-1">Tenant Code: <span className="font-mono">{tenant.tenantCode || "TC-" + tenant.id.slice(0, 6).toUpperCase()}</span></p>
                            <p className="text-xs text-neutral-500 mt-0.5">{tenant.phone || "No phone"}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">Lease Details</h3>
                        <div>
                            <p className="text-xs font-bold text-neutral-900">{property.name} — {unit.unitNumber}</p>
                            <p className="text-[11px] text-neutral-500 mt-1">{property.address || "N/A"}</p>
                            <div className="flex gap-4 mt-3">
                                <div className="text-[10px]">
                                    <p className="text-neutral-400 uppercase">Started</p>
                                    <p className="font-bold text-neutral-700">{format(new Date(lease.startDate), "dd-MMM-yyyy")}</p>
                                </div>
                                <div className="text-[10px]">
                                    <p className="text-neutral-400 uppercase">Rent</p>
                                    <p className="font-bold text-neutral-700">KES {lease.rentAmount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">Ledger Summary</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center bg-neutral-50 p-2 rounded">
                                <span className="text-[10px] text-neutral-500 uppercase">Opening Balance</span>
                                <span className="text-xs font-bold font-mono">KES {openingBalance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center bg-neutral-900 text-white p-2 rounded">
                                <span className="text-[10px] text-neutral-300 uppercase">Current Closing</span>
                                <span className="text-xs font-bold font-mono">KES {closingBalance.toLocaleString()}</span>
                            </div>
                            <p className="text-[9px] text-neutral-400 text-right italic">Sorted by date from {range.start !== "1970-01-01T00:00:00.000Z" ? format(new Date(range.start), "dd-MMM-yy") : "Start"} to {format(new Date(range.end), "dd-MMM-yy")}</p>
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="mb-12">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-y border-neutral-900">
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900 w-28">Date</th>
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900 w-32">Reference</th>
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900">Description</th>
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900 text-right w-24">Debit</th>
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900 text-right w-24">Credit</th>
                                <th className="py-3 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-900 text-right w-28 bg-neutral-50">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {Object.entries(groupedLedger).map(([month, items]) => (
                                <React.Fragment key={month}>
                                    <tr className="bg-neutral-50/50">
                                        <td colSpan={6} className="py-2 px-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100">{month}</td>
                                    </tr>
                                    {items.map((item, idx) => (
                                        <tr key={item.id} className="border-b border-neutral-50 group hover:bg-neutral-50/30 transition-colors">
                                            <td className="py-3 px-2 font-mono text-neutral-500">{format(new Date(item.date), "dd-MMM-yyyy")}</td>
                                            <td className="py-3 px-2 font-mono text-[10px]">{item.code}</td>
                                            <td className="py-3 px-2 text-neutral-600 leading-relaxed font-medium">{item.description}</td>
                                            <td className={`py-3 px-2 text-right tabular-nums ${item.debit > 0 ? 'text-neutral-900' : 'text-neutral-300'}`}>
                                                {item.debit > 0 ? item.debit.toLocaleString() + ".00" : "-"}
                                            </td>
                                            <td className={`py-3 px-2 text-right tabular-nums ${item.credit > 0 ? 'text-neutral-900' : 'text-neutral-300'}`}>
                                                {item.credit > 0 ? item.credit.toLocaleString() + ".00" : "-"}
                                            </td>
                                            <td className={`py-3 px-2 text-right tabular-nums font-bold bg-neutral-50 group-hover:bg-neutral-100 transition-colors ${item.balance > 0 ? 'text-neutral-900' : 'text-red-600'}`}>
                                                {item.balance.toLocaleString() + ".00"}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Grids */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-12 border-t border-neutral-100">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1 border-l-2 border-neutral-200">Invoice Summary</h4>
                        <div className="space-y-1.5 px-1">
                            {summaries.invoices.map(s => (
                                <div key={s.type} className="flex justify-between text-xs py-1 border-b border-neutral-50">
                                    <span className="text-neutral-500 font-medium">{s.type.replace(/_/g, " ")}</span>
                                    <span className="font-bold tabular-nums">{s.amount.toLocaleString()}.00</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-xs py-2 bg-neutral-900 text-white px-2 mt-2 rounded shadow-lg shadow-neutral-900/10">
                                <span className="font-bold">Total Debits</span>
                                <span className="font-black tabular-nums">{summaries.invoices.reduce((a,b) => a+b.amount, 0).toLocaleString()}.00</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1 border-l-2 border-neutral-200">Payment Summary</h4>
                        <div className="space-y-1.5 px-1">
                            {summaries.payments.map(s => (
                                <div key={s.type} className="flex justify-between text-xs py-1 border-b border-neutral-50">
                                    <span className="text-neutral-500 font-medium">{s.type.replace(/_/g, " ")}</span>
                                    <span className="font-bold tabular-nums">{s.amount.toLocaleString()}.00</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-xs py-2 bg-neutral-900 text-white px-2 mt-2 rounded shadow-lg shadow-neutral-900/10">
                                <span className="font-bold">Total Credits</span>
                                <span className="font-black tabular-nums">{summaries.payments.reduce((a,b) => a+b.amount, 0).toLocaleString()}.00</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1 border-l-2 border-neutral-200">Deposit Summary</h4>
                        <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                             <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-neutral-400 uppercase leading-none">Status</span>
                                <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded leading-none uppercase">Secured</span>
                             </div>
                             <div className="space-y-2">
                                <div className="flex justify-between text-[11px] border-b border-neutral-200/50 pb-1">
                                    <span className="text-neutral-500">L/L Held</span>
                                    <span className="font-bold">KES {lease.deposit?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[11px] border-b border-neutral-200/50 pb-1">
                                    <span className="text-neutral-500">Agent Held</span>
                                    <span className="font-bold">KES 0.00</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-bold text-neutral-900 pt-1">
                                    <span>Refundable</span>
                                    <span className="font-black">KES {lease.deposit?.toLocaleString()}</span>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Professional Footer Disclaimer */}
                <div className="mt-20 pt-8 border-t border-neutral-100 flex justify-between items-center text-[9px] text-neutral-400 uppercase font-medium tracking-tight">
                    <p>© {new Date().getFullYear()} {company.name} • Statement Generated via Aedra Platform</p>
                    <p>This is a computer generated document • Page 1 of 1</p>
                </div>

            </div>
        </div>
    )
}
