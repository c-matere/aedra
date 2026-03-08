"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal, FileText } from "lucide-react"
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
import { Combobox } from "@/components/ui/combobox"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import {
    createTenantAction,
    updateTenantAction,
    deleteTenantAction,
    listPropertiesAction,
} from "@/lib/actions"
import type {
    TenantRecord,
    PropertyRecord,
} from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"
import { FieldSchema, parseForm, parseText } from "@/lib/form-helpers"

type TenantFormValues = {
    firstName: string
    lastName: string
    email?: string
    propertyId: string
}

const tenantFieldSchema: FieldSchema[] = [
    {
        name: "firstName",
        required: true,
        parser: parseText,
        errorMessage: "First name is required.",
    },
    {
        name: "lastName",
        required: true,
        parser: parseText,
        errorMessage: "Last name is required.",
    },
    {
        name: "email",
        required: false,
        parser: parseText,
    },
    {
        name: "propertyId",
        required: true,
        parser: parseText,
        errorMessage: "Property is required.",
    },
]

export function AddTenantButton({
    role,
    properties,
}: {
    role: UserRole | null
    properties: PropertyRecord[]
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [propertyId, setPropertyId] = useState("")
    const canMutate = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate) {
            setError("You do not have permission to create tenants.")
            return
        }
        setLoading(true)
        setError(null)

        const { values, errors } = parseForm<TenantFormValues>(tenantFieldSchema, new FormData(e.currentTarget))
        if (errors.length > 0) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const { firstName, lastName, email, propertyId } = values
        if (!firstName || !lastName || !propertyId) {
            setError("First name, last name, and property are required.")
            setLoading(false)
            return
        }

        const res = await createTenantAction(role, {
            firstName,
            lastName,
            email,
            propertyId,
        })

        if (res.error) {
            setError(res.error)
        } else {
            setOpen(false)
            setPropertyId("")
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="glass"
                    disabled={!canMutate}
                    className="font-semibold border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tenant
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent>
                <SlidePanelHeader>
                    <SlidePanelTitle>Add Tenant</SlidePanelTitle>
                    <SlidePanelDescription>
                        Register a new tenant and assign them to a property.
                    </SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-6 py-6 flex-1">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">First Name</label>
                            <Input
                                name="firstName"
                                required
                                placeholder="John"
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Last Name</label>
                            <Input
                                name="lastName"
                                required
                                placeholder="Doe"
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Email Address (Optional)</label>
                        <Input
                            name="email"
                            type="email"
                            placeholder="john.doe@example.com"
                            className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Property</label>
                        <AsyncCombobox
                            name="propertyId"
                            onSearch={async (query) => {
                                const res = await listPropertiesAction(role, { search: query })
                                return (res.data?.data ?? []).map(p => ({ value: p.id, label: p.name }))
                            }}
                            value={propertyId}
                            onValueChange={setPropertyId}
                            placeholder="Search properties..."
                            required
                            initialOptions={properties.map(p => ({ value: p.id, label: p.name }))}
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
                            Create Tenant
                        </Button>
                    </div>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function TenantRowClickable({ tenantId, children }: { tenantId: string, children: React.ReactNode }) {
    const router = useRouter()
    return (
        <div
            onClick={() => router.push(`/admin/leases?tenantId=${tenantId}`)}
            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors cursor-pointer group"
        >
            {children}
        </div>
    )
}

export function TenantRowActions({
    role,
    tenant,
    properties,
}: {
    role: UserRole | null
    tenant: TenantRecord
    properties: PropertyRecord[]
}) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const canMutate = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"

    const [menuOpen, setMenuOpen] = useState(false)
    const [editValues, setEditValues] = useState<Partial<TenantFormValues>>({
        propertyId: tenant.propertyId ?? ""
    })

    async function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const { values, errors } = parseForm<TenantFormValues>(tenantFieldSchema, new FormData(e.currentTarget))
        if (errors.length > 0) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const { firstName, lastName, email, propertyId } = values
        if (!firstName || !lastName) {
            setError("First name and last name are required.")
            setLoading(false)
            return
        }

        const res = await updateTenantAction(role, tenant.id, { firstName, lastName, email, propertyId })
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
        if (!confirm(`Are you sure you want to delete ${tenant.firstName} ${tenant.lastName}?`)) return
        setLoading(true)
        const res = await deleteTenantAction(role, tenant.id)
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
                    if (!canMutate) return
                    setMenuOpen(!menuOpen);
                }}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>

            {menuOpen && (
                <div
                    className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-white/10 bg-neutral-900 shadow-2xl z-50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
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
                    <Link
                        href={`/admin/leases?tenantId=${tenant.id}`}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
                    >
                        <FileText className="h-3.5 w-3.5" /> View Leases
                    </Link>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                </div>
            )}

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
                        <SlidePanelTitle>Edit Tenant</SlidePanelTitle>
                        <SlidePanelDescription>
                            Update personal details for {tenant.firstName} {tenant.lastName}.
                        </SlidePanelDescription>
                    </SlidePanelHeader>
                    <form onSubmit={onEditSubmit} className="space-y-6 py-6 flex-1">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">First Name</label>
                                <Input
                                    name="firstName"
                                    required
                                    defaultValue={tenant.firstName}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                                <Input
                                    name="lastName"
                                    required
                                    defaultValue={tenant.lastName}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Email Address (Optional)</label>
                            <Input
                                name="email"
                                type="email"
                                defaultValue={tenant.email || ""}
                                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Property</label>
                            <AsyncCombobox
                                name="propertyId"
                                onSearch={async (query) => {
                                    const res = await listPropertiesAction(role, { search: query })
                                    return (res.data?.data ?? []).map(p => ({ value: p.id, label: p.name }))
                                }}
                                value={editValues.propertyId}
                                onValueChange={(val) => setEditValues(prev => ({ ...prev, propertyId: val }))}
                                placeholder="Search properties..."
                                required
                                initialOptions={properties.map(p => ({ value: p.id, label: p.name }))}
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
