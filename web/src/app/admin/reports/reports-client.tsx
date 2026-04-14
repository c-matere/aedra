"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Download,
    FileText,
    TrendingUp,
    Users,
    Loader2,
    Calendar,
    ChevronRight,
    Search,
    History,
    FileDown,
    Building2,
    PieChart as PieChartIcon,
    BarChart3,
    Printer
} from "lucide-react"
import { generateFinancialStatementPdf } from "@/lib/report-pdf-generator"
import type {
    ReportSummary,
    ReportOccupancy,
    ReportRevenue,
    PropertyRecord
} from "@/lib/backend-api"
import {
    getPortfolioReport,
    getMcKinseyReport,
    backendBaseUrl
} from '@/lib/backend-api'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from "recharts"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ReportsClientProps {
    summary: ReportSummary | null
    occupancy: ReportOccupancy | null
    revenue: ReportRevenue | null
    auditLogs: any | null
    role: string | null
    token: string
    properties: PropertyRecord[]
}

export function ReportsClient({ summary, occupancy, revenue, auditLogs, role, token, properties }: ReportsClientProps) {
    const [isGeneratingSystem, setIsGeneratingSystem] = useState(false)
    const [isGeneratingEntity, setIsGeneratingEntity] = useState(false)
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("")

    const handleSystemExport = async () => {
        setIsGeneratingSystem(true)
        await new Promise(r => setTimeout(r, 1500))

        const csvRows = [
            ["AEDRA SYSTEM REPORT", new Date().toLocaleString()],
            [""],
            ["SUMMARY"],
            ["Total Properties", summary?.properties || 0],
            ["Total Units", summary?.units || 0],
            ["Total Tenants", summary?.tenants || 0],
            ["Active Leases", summary?.activeLeases || 0],
            [""],
            ["OCCUPANCY STATUS"],
            ["Occupied", occupancy?.OCCUPIED || 0],
            ["Vacant", occupancy?.VACANT || 0],
            ["Maintenance", occupancy?.UNDER_MAINTENANCE || 0],
            [""],
            ["REVENUE"],
            ["Total Revenue (KES)", revenue?.totalRevenue || 0],
        ]

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Aedra_System_Report_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setIsGeneratingSystem(false)
    }

    const handleGenerateEntityReport = async (format: 'PDF' | 'CSV' | 'FINANCIAL_PDF') => {
        if (!selectedPropertyId) return
        const property = properties.find(p => p.id === selectedPropertyId)
        if (!property) return

        setIsGeneratingEntity(true)

        try {
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

                const landlordName = property.landlord 
                    ? `${property.landlord.firstName} ${property.landlord.lastName}` 
                    : "Not Assigned";

                const csvRows = [
                    ["PROPERTY FINANCIAL REPORT", (propertyInfo.name || property.name).toUpperCase()],
                    ["LANDLORD", landlordName],
                    ["ADDRESS", propertyInfo.address || property.address || "N/A"],
                    ["REPORT MONTH", data.month || "Current Month"],
                    ["GENERATED AT", new Date().toLocaleString()],
                    [""],
                    ["UNIT BREAKDOWN"],
                    ["UNIT NUMBER", "TENANT", "EXPECTED RENT", "ACTUAL PAID", "BALANCE"],
                    ...(data.tenantPayments.map(tp => [
                        tp.unit,
                        tp.name,
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
                            "",
                            "",
                            "",
                            ""
                        ])
                    }
                })

                csvRows.push(
                    [""],
                    ["BUILDING SUMMARY (FOR THE MONTH)"],
                    ["TOTAL RENT COLLECTED", `KES ${(totals.payments || 0).toLocaleString()}`],
                    ["AGENT COMMISSION", `KES ${commissionAmount.toLocaleString()} (${propertyInfo.commissionPercentage || 0}%)`],
                    ["MAINTENANCE & REPAIRS", `KES ${maintenanceExpenses.toLocaleString()}`],
                    ["UTILITIES", `KES ${utilityExpenses.toLocaleString()}`],
                    ["OTHER EXPENSES", `KES ${otherExpenses.toLocaleString()}`],
                    ["-----------------------------------"],
                    ["NET LANDLORD SHARE", `KES ${netLandlordShare.toLocaleString()}`],
                )

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
                link.setAttribute("download", `${property.name.replace(/\s+/g, '_')}_Financial_Report.csv`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            } else if (format === 'FINANCIAL_PDF') {
                const landlordName = property.landlord 
                    ? `${property.landlord.firstName} ${property.landlord.lastName}` 
                    : "Not Assigned";
                
                generateFinancialStatementPdf(reportRes.data, landlordName, property.units)
            } else if (format === 'PDF') {
                const reportRes = await getMcKinseyReport(token, property.id)
                if (reportRes.error || !reportRes.data) {
                    alert(`Failed to generate McKinsey report: ${reportRes.error || "Unknown error"}`)
                    return
                }
                const absoluteUrl = `${backendBaseUrl()}${reportRes.data.url}`
                window.open(absoluteUrl, '_blank')
            }
        } catch (err) {
            console.error("Report generation error:", err)
            alert("An unexpected error occurred during report generation.")
        } finally {
            setIsGeneratingEntity(false)
        }
    }

    const occupancyChartData = occupancy ? [
        { name: 'Occupied', value: occupancy.OCCUPIED, color: '#10b981' },
        { name: 'Vacant', value: occupancy.VACANT, color: '#3b82f6' },
        { name: 'Maintenance', value: occupancy.UNDER_MAINTENANCE, color: '#f59e0b' },
    ].filter(d => d.value > 0) : []

    const logs = Array.isArray(auditLogs?.logs) ? auditLogs.logs : []

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-emerald-400" />
                        Business Intelligence
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        Platform-wide analytics and entity-specific reporting.
                    </p>
                </div>
                <Button
                    variant="glass"
                    onClick={handleSystemExport}
                    disabled={isGeneratingSystem}
                    className="bg-emerald-500 text-black font-black border-none shadow-lg shadow-emerald-500/10"
                >
                    {isGeneratingSystem ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            Export Portfolio Analytics
                        </>
                    )}
                </Button>
            </div>

            {/* Main Stats KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Revenue", value: `KES ${revenue?.totalRevenue?.toLocaleString() || 0}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Total Units", value: summary?.units || 0, icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Active Tenants", value: summary?.tenants || 0, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
                    { label: "Occupancy Rate", value: summary?.units ? `${Math.round(((occupancy?.OCCUPIED || 0) / summary.units) * 100)}%` : "0%", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10" },
                ].map((stat, i) => (
                    <Card key={i} className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</CardTitle>
                            <div className={`${stat.bg} p-2 rounded-lg`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Charts */}
                <div className="lg:col-span-8 space-y-8">
                    <Card className="bg-neutral-900 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                                <PieChartIcon className="h-5 w-5 text-emerald-500" />
                                Occupancy Distribution
                            </CardTitle>
                            <CardDescription className="text-neutral-500">Breakdown of unit status across the entire portfolio</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                {occupancyChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={occupancyChartData}
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {occupancyChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-neutral-600 text-sm">No unit data available</div>
                                )}
                            </div>
                            <div className="flex justify-center gap-6 mt-4">
                                {occupancyChartData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-xs text-neutral-400 font-medium">{d.name} ({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Generation Tools */}
                <div className="lg:col-span-4 space-y-8">
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-emerald-500" />
                            Entity Report Center
                        </h2>
                        <Card className="bg-neutral-900 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-neutral-300">Generate Property Report</CardTitle>
                                <CardDescription className="text-xs text-neutral-555 uppercase font-bold tracking-tighter">Select a property to begin</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl">
                                        <SelectValue placeholder="Select Property..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                        {properties.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                 <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button 
                                            variant="outline" 
                                            disabled={!selectedPropertyId || isGeneratingEntity}
                                            onClick={() => handleGenerateEntityReport('PDF')}
                                            className="border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 text-xs font-bold rounded-xl h-14"
                                        >
                                            <FileText className="h-4 w-4 mr-2 text-emerald-500" />
                                            AI Report
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            disabled={!selectedPropertyId || isGeneratingEntity}
                                            onClick={() => handleGenerateEntityReport('CSV')}
                                            className="border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 text-xs font-bold rounded-xl h-14"
                                        >
                                            <FileDown className="h-4 w-4 mr-2 text-emerald-500" />
                                            CSV Ledger
                                        </Button>
                                    </div>
                                    <Button 
                                        variant="outline"
                                        disabled={!selectedPropertyId || isGeneratingEntity}
                                        onClick={() => handleGenerateEntityReport('FINANCIAL_PDF')}
                                        className="w-full border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 text-xs font-bold rounded-xl h-14"
                                    >
                                        <Printer className="h-4 w-4 mr-2 text-emerald-500" />
                                        Print Statement (PDF)
                                    </Button>
                                </div>
                                {isGeneratingEntity && (
                                    <div className="flex items-center gap-2 justify-center text-[10px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Building your data...
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </div>
    )
}
