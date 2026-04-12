"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal, Building2, UserCircle, Layers, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelDescription,
    SlidePanelTrigger,
} from "@/components/ui/slide-panel"
import type {
    CreatePropertyPayload,
    PropertyRecord,
} from "@/lib/backend-api"
import {
    createPropertyAction,
    updatePropertyAction,
    deletePropertyAction,
} from "@/lib/actions"
import type { UserRole } from "@/lib/rbac"
import { FieldSchema, parseForm, parseText, parseFloatValue } from "@/lib/form-helpers"

type CreatePropertyFormValues = {
    name: string
    address?: string
    propertyType?: string
    description?: string
    commissionPercentage?: number
    landlordFirstName?: string
    landlordLastName?: string
    landlordEmail?: string
    landlordPhone?: string
}

type UpdatePropertyFormValues = {
    name: string
    address?: string
    location?: string
    propertyType?: string
    description?: string
    commissionPercentage?: number
}

const propertyCreateFieldSchema: FieldSchema[] = [
    {
        name: "name",
        required: true,
        parser: parseText,
        errorMessage: "Property name is required.",
    },
    {
        name: "address",
        parser: parseText,
    },
    {
        name: "propertyType",
        parser: parseText,
    },
    {
        name: "description",
        parser: parseText,
    },
    {
        name: "commissionPercentage",
        parser: parseFloatValue,
    },
    {
        name: "landlordFirstName",
        parser: parseText,
    },
    {
        name: "landlordLastName",
        parser: parseText,
    },
    {
        name: "landlordEmail",
        parser: parseText,
    },
    {
        name: "landlordPhone",
        parser: parseText,
    },
]

const propertyUpdateFieldSchema: FieldSchema[] = [
    {
        name: "name",
        required: true,
        parser: parseText,
        errorMessage: "Property name is required.",
    },
    {
        name: "address",
        parser: parseText,
    },
    {
        name: "propertyType",
        parser: parseText,
    },
    {
        name: "description",
        parser: parseText,
    },
    {
        name: "commissionPercentage",
        parser: parseFloatValue,
    },
]

export function AddPropertyButton({ role }: { role: UserRole | null }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const canMutate = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"

    // Unit Batches state
    const [unitBatches, setUnitBatches] = useState<Array<{
        id: string; // just for react keys
        prefix: string;
        count: number;
        bedrooms: number;
        bathrooms: number;
        rentAmount: number;
    }>>([])

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate) {
            setError("You do not have permission to create properties.")
            return
        }
        setLoading(true)
        setError(null)

        const { values, errors } = parseForm<CreatePropertyFormValues>(propertyCreateFieldSchema, new FormData(e.currentTarget))
        if (errors.length > 0) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const {
            name,
            address,
            propertyType,
            description,
            commissionPercentage,
            landlordFirstName,
            landlordLastName,
            landlordEmail,
            landlordPhone,
        } = values

        if (!name) {
            setError("Property name is required.")
            setLoading(false)
            return
        }

        const payload: CreatePropertyPayload = {
            name,
            address,
            location: values.location,
            propertyType: propertyType || "RESIDENTIAL",
            description,
            commissionPercentage: commissionPercentage || 0,
        }

        if (landlordFirstName && landlordLastName) {
            payload.landlord = {
                firstName: landlordFirstName,
                lastName: landlordLastName,
                email: landlordEmail || undefined,
                phone: landlordPhone || undefined,
            }
        }

        if (unitBatches.length > 0) {
            payload.unitBatches = unitBatches.map(b => ({
                prefix: b.prefix,
                count: b.count,
                bedrooms: b.bedrooms,
                bathrooms: b.bathrooms,
                rentAmount: b.rentAmount,
            }))
        }

        const res = await createPropertyAction(role, payload)
        if (res.error) {
            setError(res.error)
        } else {
            setUnitBatches([])
            setOpen(false)
            router.refresh()
        }
        setLoading(false)
    }

    const addUnitBatch = () => {
        setUnitBatches([...unitBatches, {
            id: crypto.randomUUID(),
            prefix: "Apt",
            count: 1,
            bedrooms: 1,
            bathrooms: 1,
            rentAmount: 30000
        }])
    }

    const updateBatch = (id: string, field: string, value: string | number) => {
        setUnitBatches(batches => batches.map(b => {
            if (b.id !== id) return b
            return { ...b, [field]: value }
        }))
    }

    const removeBatch = (id: string) => {
        setUnitBatches(batches => batches.filter(b => b.id !== id))
    }

    return (
        <SlidePanel open={open} onOpenChange={(val) => {
            if (!val) {
                // reset on close
                setUnitBatches([])
                setError(null)
            }
            setOpen(val)
        }}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="glass"
                    disabled={!canMutate}
                    className="font-semibold border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                </Button>
            </SlidePanelTrigger>
            {/* Make the panel wider to accommodate the complex form */}
            <SlidePanelContent className="sm:max-w-2xl">
                <SlidePanelHeader>
                    <SlidePanelTitle>Add Property</SlidePanelTitle>
                    <SlidePanelDescription>
                        Register a new property, assign a landlord, and auto-generate units.
                    </SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="flex-1 flex flex-col gap-8 py-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {/* Section 1: Property Details */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <Building2 className="h-4 w-4 text-emerald-400" />
                            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">1. Property Details</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <label className="text-sm font-medium text-neutral-300">Property Name *</label>
                                <Input name="name" required placeholder="e.g. Nyali Estates" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <label className="text-sm font-medium text-neutral-300">Property Type</label>
                                <select name="propertyType" className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                                    <option value="RESIDENTIAL" className="bg-neutral-900">Residential</option>
                                    <option value="COMMERCIAL" className="bg-neutral-900">Commercial</option>
                                    <option value="MIXED_USE" className="bg-neutral-900">Mixed Use</option>
                                    <option value="INDUSTRIAL" className="bg-neutral-900">Industrial</option>
                                    <option value="LAND" className="bg-neutral-900">Land</option>
                                </select>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-sm font-medium text-neutral-300">Address (Display)</label>
                                <Input name="address" placeholder="e.g. Links Road, Nyali, Mombasa" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-sm font-medium text-neutral-300">Property Location (Internal/City)</label>
                                <Input name="location" placeholder="e.g. Mombasa" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-sm font-medium text-neutral-300">Description</label>
                                <textarea name="description" rows={2} className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Optional notes about the property..." />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <label className="text-sm font-medium text-neutral-300">Commission Percentage (%)</label>
                                <Input type="number" step="0.01" name="commissionPercentage" placeholder="e.g. 10" className="bg-white/5 border-white/10 text-white" />
                                <p className="text-[10px] text-neutral-500">How much the office earns from rent collections.</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Landlord Details */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <UserCircle className="h-4 w-4 text-emerald-400" />
                            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">2. Landlord Identification</h3>
                        </div>
                        <p className="text-xs text-neutral-400">Provide details to create a new landlord record. Leave blank if you want to assign a landlord later.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">First Name</label>
                                <Input name="landlordFirstName" placeholder="e.g. Mwangi" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                                <Input name="landlordLastName" placeholder="e.g. Kariuki" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Email Address</label>
                                <Input type="email" name="landlordEmail" placeholder="mwangik@example.com" className="bg-white/5 border-white/10 text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Phone Number</label>
                                <Input name="landlordPhone" placeholder="+254 712 345678" className="bg-white/5 border-white/10 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Unit Auto-Generation */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-emerald-400" />
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">3. Auto-Generate Units</h3>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addUnitBatch} className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300">
                                <Plus className="h-3 w-3 mr-1" /> Add Batch
                            </Button>
                        </div>
                        <p className="text-xs text-neutral-400">Generate multiple units instantly. E.g. Prefix &ldquo;Apt&rdquo; with count &ldquo;10&rdquo; creates Apt 1, Apt 2... Apt 10.</p>

                        <div className="space-y-3">
                            {unitBatches.length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-white/10 rounded-lg text-sm text-neutral-500 bg-white/5">
                                    No units will be generated. You can add units manually later.
                                </div>
                            ) : (
                                unitBatches.map((batch) => (
                                    <div key={batch.id} className="grid grid-cols-12 gap-3 p-3 rounded-lg border border-white/10 bg-black/40 items-start relative pb-10 sm:pb-3">
                                        <div className="col-span-6 sm:col-span-3 space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500">Prefix</label>
                                            <Input value={batch.prefix} onChange={e => updateBatch(batch.id, "prefix", e.target.value)} className="h-8 text-sm bg-white/5 border-none text-white focus-visible:ring-1 focus-visible:ring-emerald-500" />
                                        </div>
                                        <div className="col-span-3 sm:col-span-2 space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500">Count</label>
                                            <Input type="number" min="1" max="100" value={batch.count} onChange={e => updateBatch(batch.id, "count", parseInt(e.target.value) || 1)} className="h-8 text-sm bg-white/5 border-none text-white focus-visible:ring-1 focus-visible:ring-emerald-500" />
                                        </div>
                                        <div className="col-span-3 sm:col-span-2 space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500">Beds</label>
                                            <Input type="number" min="0" value={batch.bedrooms} onChange={e => updateBatch(batch.id, "bedrooms", parseInt(e.target.value) || 0)} className="h-8 text-sm bg-white/5 border-none text-white focus-visible:ring-1 focus-visible:ring-emerald-500" />
                                        </div>
                                        <div className="col-span-6 sm:col-span-2 space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500">Baths</label>
                                            <Input type="number" min="0" value={batch.bathrooms} onChange={e => updateBatch(batch.id, "bathrooms", parseInt(e.target.value) || 0)} className="h-8 text-sm bg-white/5 border-none text-white focus-visible:ring-1 focus-visible:ring-emerald-500" />
                                        </div>
                                        <div className="col-span-6 sm:col-span-2 space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500">Rent (KES)</label>
                                            <Input type="number" min="0" value={batch.rentAmount} onChange={e => updateBatch(batch.id, "rentAmount", parseInt(e.target.value) || 0)} className="h-8 text-sm bg-white/5 border-none text-white focus-visible:ring-1 focus-visible:ring-emerald-500" />
                                        </div>
                                        <div className="absolute bottom-2 right-2 sm:static sm:col-span-1 pt-5 flex justify-end">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeBatch(batch.id)} className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300">
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="pt-6 mt-auto">
                        <Button
                            type="submit"
                            variant="glass"
                            disabled={loading || !canMutate}
                            className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 border-none shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                            Create Property Profile
                        </Button>
                    </div>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function PropertyRowActions({ role, property }: { role: UserRole | null; property: PropertyRecord }) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const canMutate = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"

    // Using a simple inline menu open state
    const [menuOpen, setMenuOpen] = useState(false)

    async function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const { values, errors } = parseForm<UpdatePropertyFormValues>(propertyUpdateFieldSchema, new FormData(e.currentTarget))
        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const { name, address, location, propertyType, description, commissionPercentage } = values

        if (!name) {
            setError("Property name is required.")
            setLoading(false)
            return
        }

        const res = await updatePropertyAction(role, property.id, { name, address, location, propertyType, description, commissionPercentage })
        if (res.error) {
            setError(res.error)
        } else {
            setEditOpen(false)
            router.refresh()
        }
        setLoading(false)
    }

    async function onDelete() {
        if (!canMutate) return
        if (!confirm(`Are you sure you want to delete ${property.name}?`)) return
        setLoading(true)
        const res = await deletePropertyAction(role, property.id)
        if (res.error) {
            alert(`Failed to delete: ${res.error}`)
        } else {
            router.refresh()
        }
        setLoading(false)
        setMenuOpen(false)
    }

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white transition-opacity"
                disabled={loading || !canMutate}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!canMutate) return;
                    setMenuOpen(!menuOpen);
                }}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>

            {menuOpen && (
                <div
                    className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-white/10 bg-neutral-900 shadow-2xl z-50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()} // Keep row click from triggering
                >
                    <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
                        onClick={() => {
                            setMenuOpen(false);
                            setEditOpen(true);
                        }}
                    >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                </div>
            )}

            {/* Click outside backdrop for custom menu */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                    }}
                />
            )}

            <SlidePanel open={editOpen} onOpenChange={setEditOpen}>
                <SlidePanelContent>
                    <SlidePanelHeader>
                        <SlidePanelTitle>Edit Property</SlidePanelTitle>
                        <SlidePanelDescription>
                            Update details for {property.name}.
                        </SlidePanelDescription>
                    </SlidePanelHeader>
                    <form onSubmit={onEditSubmit} className="space-y-6 py-6 flex-1">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Property Name</label>
                            <Input
                                name="name"
                                required
                                defaultValue={property.name}
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Address (Display)</label>
                            <Input
                                name="address"
                                defaultValue={property.address || ""}
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Location (Internal)</label>
                            <Input
                                name="location"
                                defaultValue={property.location || ""}
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Property Type</label>
                            <select
                                name="propertyType"
                                defaultValue={property.propertyType || "RESIDENTIAL"}
                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                                <option value="RESIDENTIAL" className="bg-neutral-900">Residential</option>
                                <option value="COMMERCIAL" className="bg-neutral-900">Commercial</option>
                                <option value="MIXED_USE" className="bg-neutral-900">Mixed Use</option>
                                <option value="INDUSTRIAL" className="bg-neutral-900">Industrial</option>
                                <option value="LAND" className="bg-neutral-900">Land</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Description</label>
                            <textarea
                                name="description"
                                rows={2}
                                defaultValue={property.description || ""}
                                className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                placeholder="Optional notes about the property..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Commission Percentage (%)</label>
                            <Input
                                type="number"
                                step="0.01"
                                name="commissionPercentage"
                                defaultValue={property.commissionPercentage ?? 0}
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="pt-6">
                            <Button
                                type="submit"
                                variant="glass"
                                className="w-full"
                                disabled={loading || !canMutate}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </SlidePanelContent>
            </SlidePanel>
        </div>
    )
}
