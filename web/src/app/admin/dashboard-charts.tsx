/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { PropertyRecord, TenantRecord } from "@/lib/backend-api"

interface DashboardChartsProps {
    properties: PropertyRecord[]
    tenants: TenantRecord[]
}

// Fallback revenue data (used when the API doesn't return monthlyRevenue)
const FALLBACK_REVENUE = [
    { name: "Jan", total: 0 },
    { name: "Feb", total: 0 },
    { name: "Mar", total: 0 },
    { name: "Apr", total: 0 },
    { name: "May", total: 0 },
    { name: "Jun", total: 0 },
    { name: "Jul", total: 0 },
]

export function DashboardCharts({ properties, tenants }: DashboardChartsProps) {
    // Occupancy data — build from real properties
    const occupancyData = properties.length > 0
        ? properties.map(p => ({
            name: p.name.split(" ").slice(0, 2).join(" "),
            occupied: p.occupiedUnits ?? 0,
            total: p.totalUnits ?? 0,
        })).filter(d => d.total > 0)
        : []

    // Revenue data — derive from properties monthlyRevenue if present
    // Otherwise show per-property bars from the total monthly revenue summed
    const hasRevenueData = properties.some(p => p.monthlyRevenue && p.monthlyRevenue > 0)
    const revenueData = hasRevenueData
        ? properties.map(p => ({
            name: p.name.split(" ").slice(0, 2).join(" "),
            total: p.monthlyRevenue ?? 0,
        }))
        : FALLBACK_REVENUE

    const tenantActiveCount = tenants.filter(t => !t.status || t.status === "Active" || t.status === "ACTIVE").length
    const tenantExpiringCount = tenants.filter(t => t.status === "Expiring Soon" || t.status === "EXPIRING").length
    const tenantOverdueCount = tenants.filter(t => t.status === "Overdue" || t.status === "OVERDUE").length

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Revenue / Property chart */}
                <Card className="col-span-4 border-white/10 shadow-md bg-neutral-900">
                    <CardHeader>
                        <CardTitle className="text-white font-semibold">
                            {hasRevenueData ? "Monthly Revenue per Property" : "Revenue Overview"}
                        </CardTitle>
                        <CardDescription className="text-neutral-400">
                            {hasRevenueData
                                ? "Monthly revenue (KES) by property — live from database"
                                : "Revenue data not yet available from API"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0 pr-6">
                        <div className="h-[320px] w-full">
                            {revenueData.some(d => d.total > 0) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} dx={-10} />
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                                            itemStyle={{ color: "#fff" }}
                                            formatter={(value: any) => [`KES ${Number(value).toLocaleString()}`, "Revenue"]}
                                        />
                                        <Area type="monotone" dataKey="total" stroke="#ffffff" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-neutral-500 text-sm">Revenue data not available from API</p>
                                        <p className="text-neutral-600 text-xs mt-1">Add properties with revenue data to see this chart</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Occupancy bar chart */}
                <Card className="col-span-3 border-white/10 shadow-md bg-neutral-900">
                    <CardHeader>
                        <CardTitle className="text-white font-semibold">Occupancy Rate</CardTitle>
                        <CardDescription className="text-neutral-400">
                            {occupancyData.length > 0
                                ? "Units occupied vs total capacity — live from database"
                                : "No occupancy data available yet"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[320px] w-full">
                            {occupancyData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={occupancyData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={70} />
                                        <Tooltip
                                            cursor={{ fill: "#ffffff05" }}
                                            contentStyle={{ backgroundColor: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                                            itemStyle={{ color: "#fff" }}
                                            formatter={(value: any, name: any, props: any) => {
                                                return [`${value} / ${props.payload.total} Units`, "Occupied"]
                                            }}
                                        />
                                        <Bar dataKey="occupied" radius={[0, 4, 4, 0]} barSize={32}>
                                            {occupancyData.map((entry, index) => {
                                                const pct = entry.total > 0 ? (entry.occupied / entry.total) : 0
                                                const color = pct >= 0.9 ? "#10b981" : pct >= 0.7 ? "#ffffff" : "#ef4444"
                                                return <Cell key={`cell-${index}`} fill={color} opacity={0.9} />
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-neutral-500 text-sm">No occupancy data yet</p>
                                        <p className="text-neutral-600 text-xs mt-1">Properties need unit data from the API</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tenant breakdown summary */}
            {tenants.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Active</p>
                        <p className="text-2xl font-bold text-emerald-400">{tenantActiveCount}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">tenants in good standing</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Expiring</p>
                        <p className={`text-2xl font-bold ${tenantExpiringCount > 0 ? "text-red-400" : "text-white"}`}>{tenantExpiringCount}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">leases ending soon</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Overdue</p>
                        <p className={`text-2xl font-bold ${tenantOverdueCount > 0 ? "text-red-300" : "text-white"}`}>{tenantOverdueCount}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">payments overdue</p>
                    </div>
                </div>
            )}
        </div>
    )
}
