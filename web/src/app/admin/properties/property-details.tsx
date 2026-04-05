"use client"

import { useState, useEffect } from "react"
import {
    Building2,
    MapPin,
    Home,
    Users,
    TrendingUp,
    Phone,
    Mail,
    User,
    Loader2,
    Layers,
    ChevronRight,
    Map as MapIcon,
    FileDown,
    FileText,
    ChevronDown
} from "lucide-react"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelDescription
} from "@/components/ui/slide-panel"
import {
    getPropertyById,
    getPortfolioReport,
    getMcKinseyReport,
    backendBaseUrl
} from '@/lib/backend-api'
import type { PropertyRecord, PortfolioReportData } from '@/lib/backend-api'
import type { UserRole } from "@/lib/rbac"
import { ClipboardList } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UnitDetailsPanel } from "./unit-details"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface PropertyDetailsPanelProps {
    propertyId: string | null
    token: string
    role: UserRole | null
    onClose: () => void
}

export function PropertyDetailsPanel({ propertyId, token, role, onClose }: PropertyDetailsPanelProps) {
    const [property, setProperty] = useState<PropertyRecord | null>(null)
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerateReport = async (format: 'PDF' | 'CSV') => {
        if (!property) return
        setIsGenerating(true)

        try {
            // Give it a small delay for UX "generating" feel
            await new Promise(r => setTimeout(r, 800))

            if (format === 'CSV') {
                const reportRes = await getPortfolioReport(token, property.id)
                if (reportRes.error || !reportRes.data) {
                    alert(`Failed to fetch financial data: ${reportRes.error || "Unknown error"}`)
                    return
                }

                const data = reportRes.data
                const totals = data.totals || {}
                const propertyInfo = data.property || {}
                const expensesByCategory = totals.expensesByCategory || []

                const commissionAmount = ((totals.payments || 0) * (propertyInfo.commissionPercentage || 0)) / 100

                const maintenanceExpenses = expensesByCategory
                    .filter(e => ['MAINTENANCE', 'REPAIR'].includes(e.category))
                    .reduce((sum, e) => sum + e.amount, 0)

                const utilityExpenses = expensesByCategory
                    .filter(e => e.category === 'UTILITY')
                    .reduce((sum, e) => sum + e.amount, 0)

                const otherExpenses = (totals.expenses || 0) - maintenanceExpenses - utilityExpenses
                const netLandlordShare = (totals.payments || 0) - commissionAmount - (totals.expenses || 0)

                const csvRows = [
                    ["PROPERTY FINANCIAL REPORT", (propertyInfo.name || property.name).toUpperCase()],
                    ["ADDRESS", propertyInfo.address || property.address || "N/A"],
                    ["REPORT MONTH", data.month || "Current Month"],
                    ["GENERATED AT", new Date().toLocaleString()],
                    [""],
                    ["BUILDING SUMMARY (FOR THE MONTH)"],
                    ["TOTAL RENT COLLECTED", `KES ${(totals.payments || 0).toLocaleString()}`],
                    ["AGENT COMMISSION", `KES ${commissionAmount.toLocaleString()} (${propertyInfo.commissionPercentage || 0}%)`],
                    ["MAINTENANCE & REPAIRS", `KES ${maintenanceExpenses.toLocaleString()}`],
                    ["UTILITIES", `KES ${utilityExpenses.toLocaleString()}`],
                    ["OTHER EXPENSES", `KES ${otherExpenses.toLocaleString()}`],
                    ["-----------------------------------"],
                    ["NET LANDLORD SHARE", `KES ${netLandlordShare.toLocaleString()}`],
                    [""],
                    ["UNIT BREAKDOWN"],
                    ["UNIT NUMBER", "TENANT", "STATUS", "EXPECTED RENT", "ACTUAL PAID", "BALANCE"],
                    ...(data.tenantPayments.map(tp => [
                        tp.unit,
                        tp.name,
                        "OCCUPIED",
                        tp.rentAmount || 0,
                        tp.paidThisMonth || 0,
                        (tp.rentAmount || 0) - (tp.paidThisMonth || 0)
                    ]) || [])
                ]

                // Add vacant units to the breakdown
                const occupiedUnitNumbers = new Set(data.tenantPayments.map(tp => tp.unit))
                property.units?.forEach(u => {
                    if (!occupiedUnitNumbers.has(u.unitNumber)) {
                        csvRows.push([
                            u.unitNumber,
                            "N/A",
                            u.status,
                            u.rentAmount || 0,
                            0,
                            0
                        ])
                    }
                })

                // Helper to escape CSV values
                const escapeCSV = (val: any) => {
                    const s = String(val ?? "");
                    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(" ")) {
                        return `"${s.replace(/"/g, '""')}"`;
                    }
                    return s;
                };

                const csvContent = "\uFEFF" + csvRows.map(row => row.map(escapeCSV).join(",")).join("\n")
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.setAttribute("href", url)
                link.setAttribute("download", `${property.name.replace(/\s+/g, '_')}_Financial_Report_${data.month.replace(/\s+/g, '_')}.csv`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            } else if (format === 'PDF') {
                const reportRes = await getMcKinseyReport(token, property.id)
                if (reportRes.error || !reportRes.data) {
                    alert(`Failed to generate McKinsey report: ${reportRes.error || "Unknown error"}`)
                    return
                }

                // Construct absolute URL
                const absoluteUrl = `${backendBaseUrl()}${reportRes.data.url}`

                // Open in new tab using hidden anchor to bypass popup blockers
                const link = document.createElement('a')
                link.href = absoluteUrl
                link.target = '_blank'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }
        } catch (err) {
            console.error("Report generation error:", err)
            alert("An unexpected error occurred during report generation. Please try again.")
        } finally {
            setIsGenerating(false)
        }
    }

    useEffect(() => {
        if (!propertyId) {
            setProperty(null)
            return
        }

        async function fetchDetails() {
            setLoading(true)
            setError(null)
            const res = await getPropertyById(token, propertyId!)
            if (res.error) {
                setError(res.error)
            } else {
                setProperty(res.data)
            }
            setLoading(false)
        }

        fetchDetails()
    }, [propertyId, token])

    return (
        <>
            <SlidePanel open={!!propertyId} onOpenChange={(open) => !open && onClose()}>
                <SlidePanelContent className="sm:max-w-2xl border-l border-white/5 bg-neutral-950/95 backdrop-blur-xl">
                    <SlidePanelHeader className="border-b border-white/5 pb-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Building2 className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <SlidePanelTitle className="text-2xl font-bold text-white tracking-tight">
                                    {loading ? "Loading..." : property?.name || "Property Details"}
                                </SlidePanelTitle>
                                <SlidePanelDescription className="flex items-center gap-1.5 mt-1">
                                    <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                                    {property?.address || "Address not provided"}
                                </SlidePanelDescription>
                            </div>
                        </div>
                    </SlidePanelHeader>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            <p className="text-sm font-medium animate-pulse">Fetching property data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                <span className="text-red-500 text-xl font-bold">!</span>
                            </div>
                            <h3 className="text-white font-semibold mb-2">Failed to load property</h3>
                            <p className="text-neutral-400 text-sm mb-6">{error}</p>
                            <Button variant="outline" onClick={() => onClose()}>Close Panel</Button>
                        </div>
                    ) : property ? (
                        <div className="flex-1 overflow-y-auto py-8 space-y-8 pr-2 custom-scrollbar">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10">
                                    <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5">
                                        <Layers className="h-3 w-3 text-blue-400" /> Units
                                    </span>
                                    <span className="text-2xl font-black text-white">{property.totalUnits || 0}</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10">
                                    <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-emerald-400">
                                        <Users className="h-3 w-3" /> Occupancy
                                    </span>
                                    <span className="text-2xl font-black text-white">
                                        {property.totalUnits ? Math.round(((property.occupiedUnits || 0) / property.totalUnits) * 100) : 0}%
                                    </span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10 overflow-hidden">
                                    <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-amber-400">
                                        <TrendingUp className="h-3 w-3" /> Revenue
                                    </span>
                                    <div className="flex items-baseline gap-1 min-w-0">
                                        <span className="text-[10px] font-bold text-neutral-500">KES</span>
                                        <span className="text-base md:text-lg font-black text-white truncate">
                                            {property.monthlyRevenue?.toLocaleString() || "—"}
                                        </span>
                                    </div>
                                </div>
                                <div className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10 ${property.vacatingUnits && property.vacatingUnits > 0 ? 'ring-1 ring-purple-500/50 bg-purple-500/5' : ''}`}>
                                    <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-purple-400">
                                        <ClipboardList className="h-3 w-3" /> Notice
                                    </span>
                                    <span className={`text-2xl font-black ${property.vacatingUnits && property.vacatingUnits > 0 ? 'text-purple-400' : 'text-white'}`}>
                                        {property.vacatingUnits || 0}
                                    </span>
                                </div>
                            </div>

                            {/* Description Section */}
                            {property.description && (
                                <section className="space-y-3">
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                        Property Description
                                    </h3>
                                    <p className="text-sm text-neutral-300 leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/5 italic">
                                        &ldquo;{property.description}&rdquo;
                                    </p>
                                </section>
                            )}

                            {/* Landlord Section */}
                            {property.landlord && (
                                <section className="space-y-4">
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                        Owner / Landlord
                                    </h3>
                                    <Card className="bg-emerald-500/5 border-emerald-500/20 overflow-hidden">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-inner">
                                                <User className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white text-base">
                                                    {property.landlord.firstName} {property.landlord.lastName}
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                                    <div className="flex items-center gap-2 text-sm text-neutral-400 bg-black/20 p-2 rounded-lg border border-white/5">
                                                        <Mail className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span className="truncate">{property.landlord.email || "No email"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-neutral-400 bg-black/20 p-2 rounded-lg border border-white/5">
                                                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span>{property.landlord.phone || "No phone"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </section>
                            )}

                            {/* Units Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                        Available Units ({property.units?.length || 0})
                                    </h3>
                                    <Button variant="link" className="text-emerald-400 text-xs h-auto p-0 hover:text-emerald-300">
                                        Manage Units <ChevronRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {property.units && property.units.length > 0 ? (
                                        property.units.map((unit) => (
                                            <div
                                                key={unit.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUnitId(unit.id);
                                                }}
                                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all hover:translate-x-1 group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black ${unit.status === 'OCCUPIED' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        unit.status === 'UNDER_MAINTENANCE' ? 'bg-amber-500/20 text-amber-400' :
                                                            unit.status === 'VACATING' ? 'bg-purple-500/20 text-purple-400' :
                                                                'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {unit.unitNumber.match(/\d+/)?.[0] || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Unit {unit.unitNumber}</p>
                                                            {unit.status === 'VACATING' && (
                                                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-400 uppercase tracking-tight">
                                                                    Notice Given
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                                                            {unit.bedrooms} BR · {unit.bathrooms} BA ·
                                                            <span className={`font-bold ${unit.status === 'OCCUPIED' ? 'text-emerald-500/60' :
                                                                unit.status === 'VACATING' ? 'text-purple-500/60' :
                                                                    'text-blue-500/60'
                                                                }`}>{unit.status}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-white">KES {unit.rentAmount?.toLocaleString() || "—"}</p>
                                                    <p className="text-[10px] text-neutral-500 uppercase tracking-tighter">per month</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                                            <Home className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
                                            <p className="text-sm text-neutral-500">No units registered for this property yet.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Location / Action Section */}
                            <section className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                                <Button variant="outline" className="h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl">
                                    <MapIcon className="mr-2 h-4 w-4 text-emerald-400" /> View on Map
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="default"
                                            disabled={isGenerating}
                                            className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg rounded-2xl border-none transition-all duration-300 group"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    Generate Report
                                                    <ChevronDown className="ml-1 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                </>
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-white/10 text-white rounded-xl shadow-2xl">
                                        <DropdownMenuItem
                                            onClick={() => handleGenerateReport('PDF')}
                                            className="flex items-center gap-2 p-3 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer rounded-lg transition-colors"
                                        >
                                            <FileText className="h-4 w-4 text-emerald-500" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs underline-offset-1">Portable Document (PDF)</span>
                                                <span className="text-[9px] text-neutral-500">Best for printing & sharing</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleGenerateReport('CSV')}
                                            className="flex items-center gap-2 p-3 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer rounded-lg transition-colors"
                                        >
                                            <FileDown className="h-4 w-4 text-emerald-500" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs">Spreadsheet (CSV)</span>
                                                <span className="text-[9px] text-neutral-500">Best for data analysis</span>
                                            </div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </section>
                        </div>
                    ) : null}
                </SlidePanelContent>
            </SlidePanel>

            <UnitDetailsPanel
                unitId={selectedUnitId}
                token={token}
                role={role}
                onClose={() => setSelectedUnitId(null)}
            />
        </>
    )
}

export function ClickablePropertyRow({
    property,
    children,
    onClick
}: {
    property: PropertyRecord;
    children: React.ReactNode;
    onClick: (id: string) => void
}) {
    return (
        <div
            onClick={() => onClick(property.id)}
            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors cursor-pointer group"
        >
            {children}
        </div>
    )
}
