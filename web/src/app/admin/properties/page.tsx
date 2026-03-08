import {
    Building2,
    MapPin,
    Search,
    Users,
    Home,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { listProperties, type PropertyRecord } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { AddPropertyButton } from "./property-actions"
import { PropertiesListClient } from "./properties-list-client"
import { Pagination } from "@/components/ui/pagination"
import { redirect } from "next/navigation"

export default async function PropertiesPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string, search?: string }>
}) {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const resolvedParams = await searchParams
    const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1
    const search = resolvedParams.search || ""

    const propertiesResult = await listProperties(sessionToken, { page, search })
    const propertiesData = propertiesResult.data
    const properties: PropertyRecord[] = propertiesData?.data ?? []
    const meta = propertiesData?.meta

    const totalUnitsTotal = properties.reduce((s, p) => s + (p.totalUnits ?? 0), 0)
    const totalOccupiedTotal = properties.reduce((s, p) => s + (p.occupiedUnits ?? 0), 0)
    const occupancyRatePortfolio = totalUnitsTotal > 0 ? Math.round((totalOccupiedTotal / totalUnitsTotal) * 100) : 0

    const onSearchAction = async (formData: FormData) => {
        "use server"
        const query = formData.get("search") as string
        if (query) {
            redirect(`/admin/properties?search=${encodeURIComponent(query)}`)
        } else {
            redirect("/admin/properties")
        }
    }

    const onPageChangeAction = async (newPage: number) => {
        "use server"
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        params.set("page", newPage.toString())
        redirect(`/admin/properties?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Page header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                        Properties
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        {meta?.total ?? properties.length} {(meta?.total ?? properties.length) === 1 ? "property" : "properties"} managed
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
                        <form action={onSearchAction} className="flex items-center gap-2">
                            <input
                                name="search"
                                placeholder="Search properties..."
                                defaultValue={search}
                                className="h-9 w-[220px] rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
                            />
                            <button type="submit" className="hidden">Search</button>
                        </form>
                    </div>
                    <AddPropertyButton role={role} />
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Total Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{meta?.total ?? properties.length}</div>
                        <p className="text-xs text-neutral-400 mt-1">across Mombasa County</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Total Units</CardTitle>
                        <Home className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{totalUnitsTotal > 0 ? totalUnitsTotal : "—"}</div>
                        <p className="text-xs text-neutral-400 mt-1">
                            {totalUnitsTotal > 0 ? `${totalOccupiedTotal} currently occupied` : "No unit data in current view"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-300">Avg Occupancy</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalUnitsTotal > 0 ? (occupancyRatePortfolio >= 90 ? "text-emerald-400" : occupancyRatePortfolio >= 70 ? "text-white" : "text-red-400") : "text-neutral-400"}`}>
                            {totalUnitsTotal > 0 ? `${occupancyRatePortfolio}%` : "—"}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">current view average</p>
                    </CardContent>
                </Card>
            </div>

            {/* Properties table */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-white">All Properties</CardTitle>
                    <CardDescription className="text-neutral-400">
                        {search ? `Searching for "${search}"` : "Click on any row to view full property details."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <PropertiesListClient
                        properties={properties}
                        token={sessionToken}
                        role={role}
                    />

                    {meta && (
                        <div className="px-6 border-t border-white/10">
                            <Pagination
                                currentPage={meta.page}
                                totalPages={meta.totalPages}
                                onPageChange={onPageChangeAction}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
