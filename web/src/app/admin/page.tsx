import { Server, Building2, Users, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCharts } from "./dashboard-charts"
import {
    fetchMe,
    listProperties,
    listTenants,
    fetchReportRevenue,
} from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"

export default async function AdminDashboard() {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const meResult = await fetchMe(sessionToken)
    const propertiesResult = await listProperties(sessionToken)
    const tenantsResult = await listTenants(sessionToken)
    const revenueResult = await fetchReportRevenue(sessionToken)

    const resolvedRole = meResult.data?.user.role
    const backendOnline = meResult.error === null
    const unpaidBalance = revenueResult.data?.unpaidBalance || 0

    const properties = propertiesResult.data?.data ?? []
    const tenants = tenantsResult.data?.data ?? []

    const totalUnits = properties.reduce((s, p) => s + (p.totalUnits ?? 0), 0)
    const totalOccupied = properties.reduce((s, p) => s + (p.occupiedUnits ?? 0), 0)

    return (
        <div className="flex flex-col gap-6 pb-10">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Overview</h2>
                <p className="text-neutral-400 font-medium text-sm">
                    {resolvedRole
                        ? `Welcome back. Signed in as ${resolvedRole.replace("_", " ")}.`
                        : "Authentication required."}
                </p>
            </div>

            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">API Status</CardTitle>
                        <Server className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl font-semibold ${backendOnline ? "text-emerald-400" : "text-red-400"}`}>
                            {backendOnline ? "Connected" : "Disconnected"}
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">
                            {backendOnline ? "Live API responses active" : meResult.error}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Total Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{properties.length}</div>
                        <p className="text-xs text-neutral-400 mt-1">across Mombasa County</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Total Tenants</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{tenants.length}</div>
                        <p className="text-xs text-neutral-400 mt-1">across all properties</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Avg Occupancy</CardTitle>
                        <Building2 className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        {totalUnits > 0 ? (
                            <>
                                <div className={`text-2xl font-bold ${totalOccupied / totalUnits >= 0.9 ? "text-emerald-400" : totalOccupied / totalUnits >= 0.7 ? "text-white" : "text-red-400"}`}>
                                    {Math.round((totalOccupied / totalUnits) * 100)}%
                                </div>
                                <p className="text-xs text-neutral-400 mt-1">{totalOccupied} / {totalUnits} units occupied</p>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-neutral-500">—</div>
                                <p className="text-xs text-neutral-400 mt-1">No unit data from API yet</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-400 font-bold">Arrears</CardTitle>
                        <Activity className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-red-400">KES {unpaidBalance.toLocaleString()}</div>
                        <p className="text-xs text-neutral-500 mt-1 font-medium italic">Total outstanding balance</p>
                    </CardContent>
                </Card>
            </div>

            <DashboardCharts properties={properties} tenants={tenants} />
        </div>
    )
}
