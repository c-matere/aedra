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
    History
} from "lucide-react"
import type {
    ReportSummary,
    ReportOccupancy,
    ReportRevenue
} from "@/lib/backend-api"
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

interface ReportsClientProps {
    summary: ReportSummary | null
    occupancy: ReportOccupancy | null
    revenue: ReportRevenue | null
    auditLogs: any | null
    role: string | null
}

export function ReportsClient({ summary, occupancy, revenue, auditLogs, role }: ReportsClientProps) {
    const [isGenerating, setIsGenerating] = useState(false)

    const handleSystemExport = async () => {
        setIsGenerating(true)
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
        setIsGenerating(false)
    }

    const occupancyChartData = occupancy ? [
        { name: 'Occupied', value: occupancy.OCCUPIED, color: '#10b981' },
        { name: 'Vacant', value: occupancy.VACANT, color: '#3b82f6' },
        { name: 'Maintenance', value: occupancy.UNDER_MAINTENANCE, color: '#f59e0b' },
    ].filter(d => d.value > 0) : []

    const logs = Array.isArray(auditLogs?.logs) ? auditLogs.logs : []

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Business Intelligence</h1>
                    <p className="text-neutral-400 text-sm font-medium mt-1">Platform-wide analytics and audit trail</p>
                </div>
                <Button
                    variant="glass"
                    onClick={handleSystemExport}
                    disabled={isGenerating}
                    className="bg-emerald-500 text-black font-black border-none shadow-lg shadow-emerald-500/10"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Report...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            Export System Analytics
                        </>
                    )}
                </Button>
            </div>

            {/* Main Stats */}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupancy Chart */}
                <Card className="bg-neutral-900 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white text-lg font-bold">Occupancy Distribution</CardTitle>
                        <CardDescription className="text-neutral-500">Breakdown of unit status across the portfolio</CardDescription>
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

                {/* Audit Logs Table */}
                <Card className="bg-neutral-900 border-white/10 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-white text-lg font-bold">Audit Trail</CardTitle>
                            <CardDescription className="text-neutral-500">Security and system activity logs</CardDescription>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
                            <History className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {role === "SUPER_ADMIN" ? (
                            <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {logs.length > 0 ? (
                                    logs.map((log: any) => (
                                        <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                                                            'bg-blue-500/10 text-blue-400'
                                                    }`}>
                                                    {log.action?.substring(0, 1)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white uppercase tracking-tighter">{log.action} {log.entity}</p>
                                                    <p className="text-[10px] text-neutral-500">{new Date(log.timestamp).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.outcome === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {log.outcome}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-neutral-600">
                                        <Search className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-xs">No recent activity found</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                                <Users className="h-10 w-10 text-neutral-700 mb-4" />
                                <h4 className="text-white font-bold mb-1">Access Restricted</h4>
                                <p className="text-xs text-neutral-500">Only Super Admins can view the granular audit trail.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
