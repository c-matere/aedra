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
    ChevronDown,
    Clock
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
    getCompany,
    backendBaseUrl
} from '@/lib/backend-api'
import type { PropertyRecord, PortfolioReportData } from '@/lib/backend-api'
import type { UserRole } from "@/lib/rbac"
import { ClipboardList } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UnitDetailsPanel } from "./unit-details"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RecurringExpenses } from "./recurring-expenses"
import { ListTodo, Settings, Printer } from "lucide-react"
import { generateFinancialStatementPdf, generatePropertyFinancialLedgerPdf } from "@/lib/report-pdf-generator"

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
    const [view, setView] = useState<'DETAILS' | 'RECURRING'>('DETAILS')

    const handleGenerateReport = async (format: 'PDF' | 'CSV' | 'FINANCIAL_PDF') => {
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

                const landlordName = property.landlord 
                    ? `${property.landlord.firstName} ${property.landlord.lastName}` 
                    : "Not Assigned";
                
                // Fetch Company Info for branding
                let companyData = null;
                if (property?.companyId) {
                    const companyRes = await getCompany(token, property.companyId);
                    if (companyRes.data) {
                        companyData = companyRes.data;
                    }
                }
                
                await generatePropertyFinancialLedgerPdf(reportRes.data, landlordName, companyData, property.units)
            } else if (format === 'FINANCIAL_PDF') {
                const reportRes = await getPortfolioReport(token, property.id)
                if (reportRes.error || !reportRes.data) {
                    alert(`Failed to fetch financial data: ${reportRes.error || "Unknown error"}`)
                    return
                }

                const landlordName = property.landlord 
                    ? `${property.landlord.firstName} ${property.landlord.lastName}` 
                    : "Not Assigned";
                
                // Fetch Company Info for branding (using Property's Company ID, not User's)
                let companyData = null;
                if (property?.companyId) {
                    const companyRes = await getCompany(token, property.companyId);
                    if (companyRes.data) {
                        companyData = companyRes.data;
                    }
                }
                
                await generateFinancialStatementPdf(reportRes.data, landlordName, companyData, property.units)
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
                <SlidePanelContent className="sm:max-w-2xl border-l border-[#dedcd1] bg-[#ffffff] shadow-none">
                    <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#1f1e1d]">
                                <Building2 className="h-6 w-6 text-[#141413]" />
                            </div>
                            <div>
                                <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">
                                    {loading ? "Loading..." : property?.name || "Property Details"}
                                </SlidePanelTitle>
                                <SlidePanelDescription className="flex items-center gap-1.5 mt-1 text-[#73726c]">
                                    <MapPin className="h-3.5 w-3.5 text-[#9c9a92]" />
                                    {property?.address || "Address not provided"}
                                </SlidePanelDescription>
                            </div>
                        </div>
                    </SlidePanelHeader>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#73726c]">
                            <Loader2 className="h-8 w-8 animate-spin text-[#1f1e1d]" />
                            <p className="text-sm font-medium animate-pulse">Fetching property data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="h-12 w-12 rounded-[9.6px] bg-red-500/5 border border-red-500/20 flex items-center justify-center mb-4">
                                <span className="text-red-800 text-xl font-bold">!</span>
                            </div>
                            <h3 className="text-[#141413] font-semibold mb-2">Failed to load property</h3>
                            <p className="text-[#73726c] text-sm mb-6">{error}</p>
                            <Button variant="outline" onClick={() => onClose()}>Close Panel</Button>
                        </div>
                    ) : property ? (
                        <div className="flex-1 overflow-y-auto py-8 space-y-8 pr-2 custom-scrollbar">
                            {/* View Toggle */}
                            <div className="flex p-1 bg-[#f0eee6] rounded-[9.6px] border border-[#dedcd1] w-fit">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setView('DETAILS')}
                                    className={`rounded-[9.6px] px-6 h-8 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                        view === 'DETAILS' ? "bg-[#ffffff] border border-[#dedcd1] text-[#141413]" : "text-[#73726c] hover:text-[#141413]"
                                    }`}
                                >
                                    Property Info
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setView('RECURRING')}
                                    className={`rounded-[9.6px] px-6 h-8 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                        view === 'RECURRING' ? "bg-[#ffffff] border border-[#dedcd1] text-[#141413]" : "text-[#73726c] hover:text-[#141413]"
                                    }`}
                                >
                                    <Clock className="w-3 h-3 mr-1.5" /> Recurring
                                </Button>
                            </div>

                            {view === 'RECURRING' ? (
                                <RecurringExpenses propertyId={property.id} token={token} />
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6]">
                                            <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5 text-[#9c9a92]" /> Units
                                            </span>
                                            <span className="text-2xl font-normal font-serif text-[#141413]">{property.totalUnits || 0}</span>
                                        </div>
                                        <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6]">
                                            <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-[#9c9a92]" /> Occupancy
                                            </span>
                                            <span className="text-2xl font-normal font-serif text-[#141413]">
                                                {property.totalUnits ? Math.round(((property.occupiedUnits || 0) / property.totalUnits) * 100) : 0}%
                                            </span>
                                        </div>
                                        <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6] overflow-hidden">
                                            <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                <TrendingUp className="h-3.5 w-3.5 text-[#9c9a92]" /> Revenue
                                            </span>
                                            <div className="flex items-baseline gap-1 min-w-0">
                                                <span className="text-[10px] font-bold text-[#73726c]">KES</span>
                                                <span className="text-base md:text-lg font-normal font-serif text-[#141413] truncate">
                                                    {property.monthlyRevenue?.toLocaleString() || "—"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col gap-1 transition-all hover:bg-[#f0eee6] ${property.vacatingUnits && property.vacatingUnits > 0 ? 'border-[#ccdbe8] bg-[#ccdbe8]/10' : ''}`}>
                                            <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-1.5">
                                                <ClipboardList className="h-3.5 w-3.5 text-[#9c9a92]" /> Notice
                                            </span>
                                            <span className="text-2xl font-normal font-serif text-[#141413]">
                                                {property.vacatingUnits || 0}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Description Section */}
                                    {property.description && (
                                        <section className="space-y-3">
                                            <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                                Property Description
                                            </h3>
                                            <p className="text-sm text-[#1f1e1d] leading-relaxed bg-[#f0eee6] p-4 rounded-[16px] border border-[#dedcd1] italic">
                                                &ldquo;{property.description}&rdquo;
                                            </p>
                                        </section>
                                    )}

                                    {/* Landlord Section */}
                                    {property.landlord && (
                                        <section className="space-y-4">
                                            <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                                Owner / Landlord
                                            </h3>
                                            <Card className="bg-[#ffffff] border-[#dedcd1] rounded-[16px] overflow-hidden shadow-none">
                                                <CardContent className="p-5 flex items-start gap-4">
                                                    <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#1f1e1d] flex-shrink-0">
                                                        <User className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-serif font-normal text-[#141413] text-base">
                                                            {property.landlord.firstName} {property.landlord.lastName}
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                                            <div className="flex items-center gap-2 text-sm text-[#73726c] bg-[#f0eee6] p-2 rounded-[9.6px] border border-[#dedcd1]">
                                                                <Mail className="h-3.5 w-3.5 text-[#73726c]" />
                                                                <span className="truncate">{property.landlord.email || "No email"}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-[#73726c] bg-[#f0eee6] p-2 rounded-[9.6px] border border-[#dedcd1]">
                                                                <Phone className="h-3.5 w-3.5 text-[#73726c]" />
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
                                            <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                                Available Units ({property.units?.length || 0})
                                            </h3>
                                            <Button variant="link" className="text-[#1f1e1d] text-xs h-auto p-0 hover:underline hover:text-[#141413]">
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
                                                        className="flex items-center justify-between p-3 rounded-[16px] bg-[#ffffff] border border-[#dedcd1] hover:bg-[#f0eee6] transition-all hover:translate-x-1 group cursor-pointer shadow-none"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "px-2.5 h-8 min-w-[36px] w-auto rounded-[9.6px] flex items-center justify-center text-[10px] font-bold border transition-colors shrink-0",
                                                                unit.status === 'OCCUPIED' ? 'bg-[#ccdbe8] border-[#dedcd1] text-[#141413]' :
                                                                'bg-[#f0eee6] border-[#dedcd1] text-[#73726c]'
                                                            )}>
                                                                {unit.unitNumber}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-[#1f1e1d] group-hover:underline transition-all">Unit {unit.unitNumber}</p>
                                                                    {unit.status === 'VACATING' && (
                                                                        <span className="px-1.5 py-0.5 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] text-[9px] font-bold text-[#73726c] uppercase tracking-tight">
                                                                            Notice Given
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-[#73726c] flex items-center gap-2 mt-0.5">
                                                                    {unit.bedrooms} BR · {unit.bathrooms} BA ·
                                                                    <span className={`font-bold ${
                                                                        unit.status === 'OCCUPIED' ? 'text-[#141413]' : 'text-[#73726c]'
                                                                    }`}>{unit.status}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-normal font-serif text-[#141413]">KES {unit.rentAmount?.toLocaleString() || "—"}</p>
                                                            <p className="text-[10px] text-[#73726c] uppercase tracking-tighter">per month</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 rounded-[16px] border border-dashed border-[#dedcd1] bg-[#f0eee6]/20">
                                                    <Home className="h-8 w-8 text-[#9c9a92] mx-auto mb-3" />
                                                    <p className="text-sm text-[#73726c]">No units registered for this property yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Location / Action Section */}
                                    <section className="pt-4 border-t border-[#dedcd1] grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="h-12 border-[#dedcd1] bg-[#ffffff] hover:bg-[#f0eee6] text-[#1f1e1d] font-medium rounded-[9.6px] shadow-none">
                                            <MapIcon className="mr-2 h-4 w-4 text-[#73726c]" /> View on Map
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="default"
                                                    disabled={isGenerating}
                                                    className="h-12 bg-primary text-primary-foreground hover:opacity-90 font-medium shadow-none rounded-[9.6px] border-none transition-all duration-300 group"
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
                                            <DropdownMenuContent align="end" className="w-48 bg-[#ffffff] border-[#dedcd1] text-[#1f1e1d] rounded-[9.6px] shadow-none p-1">
                                                <DropdownMenuItem
                                                    onClick={() => handleGenerateReport('PDF')}
                                                    className="flex items-center gap-2 p-3 hover:bg-[#f0eee6] hover:text-[#1f1e1d] cursor-pointer rounded-[9.6px] transition-colors"
                                                >
                                                    <FileText className="h-4 w-4 text-[#73726c]" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs underline-offset-1 text-[#1f1e1d]">Portable Document (PDF)</span>
                                                        <span className="text-[9px] text-[#73726c]">Best for printing & sharing</span>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleGenerateReport('FINANCIAL_PDF')}
                                                    className="flex items-center gap-2 p-3 hover:bg-[#f0eee6] hover:text-[#1f1e1d] cursor-pointer rounded-[9.6px] transition-colors"
                                                >
                                                    <Printer className="h-4 w-4 text-[#73726c]" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs text-[#1f1e1d]">Remittance Report (PDF)</span>
                                                        <span className="text-[9px] text-[#73726c]">Professional financial summary</span>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleGenerateReport('CSV')}
                                                    className="flex items-center gap-2 p-3 hover:bg-[#f0eee6] hover:text-[#1f1e1d] cursor-pointer rounded-[9.6px] transition-colors"
                                                >
                                                    <Printer className="h-4 w-4 text-[#73726c]" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs text-[#1f1e1d]">Financial Ledger (PDF)</span>
                                                        <span className="text-[9px] text-[#73726c]">Professional financial breakdown</span>
                                                    </div>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </section>
                                </>
                            )}
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
