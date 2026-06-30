import { Server, Building2, Users, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCharts } from "./dashboard-charts"
import {
    fetchMe,
    listProperties,
    listTenants,
    fetchReportRevenue,
    fetchReportSummary,
    fetchReportOccupancy,
} from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"

export default async function AdminDashboard() {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const meResult = await fetchMe(sessionToken)
    const propertiesResult = await listProperties(sessionToken)
    const tenantsResult = await listTenants(sessionToken)
    const summaryResult = await fetchReportSummary(sessionToken)
    const occupancyResult = await fetchReportOccupancy(sessionToken)
    const revenueResult = await fetchReportRevenue(sessionToken)

    const resolvedRole = meResult.data?.user.role
    const backendOnline = meResult.error === null
    const unpaidBalanceRaw = revenueResult.data?.unpaidBalance ?? 0
    const unpaidBalance = Math.abs(unpaidBalanceRaw)

    const properties = propertiesResult.data?.data ?? []
    const tenants = tenantsResult.data?.data ?? []
    const summary = summaryResult.data
    const occupancy = occupancyResult.data

    const totalPropertiesFromSummary = summary?.properties ?? 0
    const totalTenantsFromSummary = summary?.tenants ?? 0

    const totalUnitsFromSummary = summary?.units ?? 0
    const totalUnitsFromOccupancy = occupancy
        ? (occupancy.OCCUPIED ?? 0) + (occupancy.VACANT ?? 0) + (occupancy.UNDER_MAINTENANCE ?? 0)
        : 0
    const totalUnitsFromProps = properties.reduce((s, p) => s + (p.totalUnits ?? 0), 0)
    const totalUnits = totalUnitsFromSummary || totalUnitsFromOccupancy || totalUnitsFromProps

    const totalOccupiedFromOccupancy = occupancy?.OCCUPIED ?? 0
    const totalOccupiedFromProps = properties.reduce((s, p) => s + (p.occupiedUnits ?? 0), 0)
    const totalOccupied = totalOccupiedFromOccupancy || totalOccupiedFromProps

    const totalProperties =
        totalPropertiesFromSummary ||
        propertiesResult.data?.meta?.total ||
        properties.length

    const totalTenants =
        totalTenantsFromSummary ||
        tenantsResult.data?.meta?.total ||
        tenants.length

    return (
        <div className="flex flex-col gap-6 pb-10">
            <div className="space-y-1">
                <h2 className="text-3xl font-normal font-serif text-[#141413] tracking-tight">Overview</h2>
                <p className="text-[#73726c] font-medium text-sm">
                    {resolvedRole
                        ? `Welcome back. Signed in as ${resolvedRole.replace("_", " ")}.`
                        : "Authentication required."}
                </p>
            </div>

            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">API Status</CardTitle>
                        <Server className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-normal font-serif ${backendOnline ? "text-[#141413]" : "text-red-800"}`}>
                            {backendOnline ? "Connected" : "Disconnected"}
                        </div>
                        <p className="mt-1 text-xs text-[#73726c]">
                            {backendOnline ? "Live API responses active" : meResult.error}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">Total Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-[#141413]">{totalProperties}</div>
                        <p className="text-xs text-[#73726c] mt-1">across Mombasa County</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">Total Tenants</CardTitle>
                        <Users className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-[#141413]">{totalTenants}</div>
                        <p className="text-xs text-[#73726c] mt-1">across all properties</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">Avg Occupancy</CardTitle>
                        <Building2 className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        {totalUnits > 0 ? (
                            <>
                                <div className={`text-2xl font-normal font-serif ${totalOccupied / totalUnits >= 0.9 ? "text-[#141413]" : totalOccupied / totalUnits >= 0.7 ? "text-[#141413]" : "text-red-800"}`}>
                                    {Math.round((totalOccupied / totalUnits) * 100)}%
                                </div>
                                <p className="text-xs text-[#73726c] mt-1">{totalOccupied} / {totalUnits} units occupied</p>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-normal font-serif text-[#73726c]">—</div>
                                <p className="text-xs text-[#73726c] mt-1">No unit data from API yet</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">Arrears</CardTitle>
                        <Activity className="h-4 w-4 text-[#9c9a92]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-normal font-serif text-red-800">KES {unpaidBalance.toLocaleString()}</div>
                        <p className="text-xs text-[#73726c] mt-1 font-medium italic">Total outstanding balance</p>
                    </CardContent>
                </Card>
            </div>

            <DashboardCharts properties={properties} tenants={tenants} />
        </div>
    )
}
