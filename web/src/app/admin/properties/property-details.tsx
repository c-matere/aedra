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
    Map as MapIcon
} from "lucide-react"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelDescription
} from "@/components/ui/slide-panel"
import { getPropertyById, type PropertyRecord } from "@/lib/backend-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UnitDetailsPanel } from "./unit-details"

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

    const handleGenerateReport = async () => {
        if (!property) return
        setIsGenerating(true)

        // Give it a small delay for UX "generating" feel
        await new Promise(r => setTimeout(r, 1200))

        const csvRows = [
            ["PROPERTY REPORT", property.name],
            ["ADDRESS", property.address || "N/A"],
            ["GENERATED AT", new Date().toLocaleString()],
            [""],
            ["UNIT NUMBER", "STATUS", "RENT", "BEDS", "BATHS"],
            ...(property.units?.map(u => [
                u.unitNumber,
                u.status,
                u.rentAmount || 0,
                u.bedrooms || 0,
                u.bathrooms || 0
            ]) || [])
        ]

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `${property.name.replace(/\s+/g, '_')}_Inventory_Report.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setIsGenerating(false)
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
                            <div className="grid grid-cols-3 gap-4">
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
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:bg-white/10">
                                    <span className="text-[10px] font-bold text-neutral-555 uppercase tracking-widest flex items-center gap-1.5 text-amber-400">
                                        <TrendingUp className="h-3 w-3" /> Revenue
                                    </span>
                                    <span className="text-lg font-black text-white truncate">
                                        {property.monthlyRevenue ? `KES ${property.monthlyRevenue.toLocaleString()}` : "—"}
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
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {unit.unitNumber.match(/\d+/)?.[0] || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Unit {unit.unitNumber}</p>
                                                        <p className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                                                            {unit.bedrooms} BR · {unit.bathrooms} BA ·
                                                            <span className={`font-bold ${unit.status === 'OCCUPIED' ? 'text-emerald-500/60' : 'text-blue-500/60'
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
                                <Button
                                    variant="glass"
                                    onClick={handleGenerateReport}
                                    disabled={isGenerating}
                                    className="h-12 bg-emerald-500 text-black font-black hover:bg-emerald-400 rounded-2xl shadow-lg border-none"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        "Generate Report"
                                    )}
                                </Button>
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
