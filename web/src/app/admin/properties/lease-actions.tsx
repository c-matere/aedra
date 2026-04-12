"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Loader2, Plus, XCircle, Trash2, Calendar, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelDescription,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelTrigger,
} from "@/components/ui/slide-panel"
import { Switch } from "@/components/ui/switch"
import {
    createInvoiceAction,
    createPaymentAction,
    updateLeaseAction,
    updateUnitAction,
    createLeaseAction
} from "@/lib/actions"
import { Combobox } from "@/components/ui/combobox"
import {
    CreateInvoicePayload,
    CreatePaymentPayload,
    UpdateUnitPayload,
    CreateLeasePayload
} from "@/lib/backend-api"
import { parseForm, parseNumber, parseText, parseDate, FieldSchema } from "@/lib/form-helpers"
import type { UserRole } from "@/lib/rbac"
import type { TenantRecord, UnitRecord } from "@/lib/backend-api"

const INVOICE_TYPES = ["RENT", "MAINTENANCE", "PENALTY", "UTILITY", "OTHER"]
const PAYMENT_METHODS = ["MPESA", "BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"]
const PAYMENT_TYPES = ["RENT", "DEPOSIT", "PENALTY", "UTILITY", "OTHER"]

const invoiceFieldSchema: FieldSchema[] = [
    { name: "description", required: true, parser: parseText, errorMessage: "Description is required." },
    { name: "amount", required: true, parser: parseNumber, errorMessage: "Amount must be a valid number." },
    { name: "dueDate", required: true, parser: parseText, errorMessage: "Due date is required." },
    { name: "type", required: false, parser: parseText },
]

const paymentFieldSchema: FieldSchema[] = [
    { name: "amount", required: true, parser: parseNumber, errorMessage: "Amount must be a valid number." },
    { name: "paidAt", required: false, parser: parseText },
    { name: "method", required: false, parser: parseText },
    { name: "type", required: false, parser: parseText },
    { name: "reference", required: false, parser: parseText },
    { name: "notes", required: false, parser: parseText },
]

function canMutate(role: UserRole | null) {
    return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "COMPANY_STAFF"
}

interface AddActionProps {
    leaseId: string
    role: UserRole | null
    onSuccess?: () => void
}

export function AddInvoiceButton({ leaseId, role, onSuccess }: AddActionProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) return

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const { values, errors } = parseForm<any>(invoiceFieldSchema, formData)
        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const res = await createInvoiceAction(role, {
            ...values,
            leaseId,
        } as CreateInvoicePayload)

        if (res.error) {
            setError(res.error)
        } else {
            setOpen(false)
            if (onSuccess) onSuccess()
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md hover:bg-white/10"
                    disabled={!canMutate(role)}
                >
                    <Plus className="h-3 w-3 text-neutral-400" />
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent zIndex={300}>
                <SlidePanelHeader>
                    <SlidePanelTitle>Add Invoice</SlidePanelTitle>
                    <SlidePanelDescription>Create a new invoice for this lease.</SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-6">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Description</label>
                        <Input name="description" placeholder="e.g. Rent for March 2026" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
                        <Input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Due Date</label>
                        <Input name="dueDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Type</label>
                        <select name="type" defaultValue="RENT" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                            {INVOICE_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Invoice
                    </Button>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function AddPaymentButton({ leaseId, role, onSuccess }: AddActionProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) return

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const { values, errors } = parseForm<any>(paymentFieldSchema, formData)
        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const res = await createPaymentAction(role, {
            ...values,
            leaseId,
        } as CreatePaymentPayload)

        if (res.error) {
            setError(res.error)
        } else {
            setOpen(false)
            if (onSuccess) onSuccess()
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md hover:bg-white/10"
                    disabled={!canMutate(role)}
                >
                    <Plus className="h-3 w-3 text-neutral-400" />
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent zIndex={300}>
                <SlidePanelHeader>
                    <SlidePanelTitle>Add Payment</SlidePanelTitle>
                    <SlidePanelDescription>Record a new payment for this lease.</SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-6">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
                        <Input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Paid At</label>
                        <Input name="paidAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Method</label>
                            <select name="method" defaultValue="MPESA" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                                {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Type</label>
                            <select name="type" defaultValue="RENT" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                                {PAYMENT_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Reference / Receipt No.</label>
                        <Input name="reference" placeholder="e.g. RKX123456" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Notes (Optional)</label>
                        <Input name="notes" placeholder="Additional details..." />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Record Payment
                    </Button>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}
export function VacationNoticeButton({ leaseId, unitId, role, onSuccess }: AddActionProps & { unitId?: string }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) return

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const moveOutDate = formData.get("moveOutDate") as string

        const res = await updateLeaseAction(role, leaseId, {
            endDate: moveOutDate
        })

        if (res.error) {
            setError(res.error)
        } else {
            if (unitId) {
                const unitRes = await updateUnitAction(role, unitId, { status: 'VACATING' } as UpdateUnitPayload)
                if (unitRes.error) {
                    setError(`Lease updated, but unit status failed: ${unitRes.error}`)
                    setLoading(false)
                    return
                }
            }
            setOpen(false)
            if (onSuccess) onSuccess()
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[10px] font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10 uppercase tracking-wider"
                    disabled={!canMutate(role)}
                >
                    <ClipboardList className="h-3 w-3 mr-1" />
                    Notice
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent zIndex={300}>
                <SlidePanelHeader>
                    <SlidePanelTitle>Vacation Notice</SlidePanelTitle>
                    <SlidePanelDescription>Schedule an expected move-out date for the tenant.</SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-6">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Expected Move-Out Date</label>
                        <Input name="moveOutDate" type="date" required defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Notice
                    </Button>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function TerminateLeaseButton({ leaseId, unitId, role, onSuccess }: AddActionProps & { unitId?: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleTerminate() {
        if (!confirm("Are you sure you want to terminate this lease? This will also mark the unit as VACANT.")) return
        if (!canMutate(role)) return

        setLoading(true)
        const res = await updateLeaseAction(role, leaseId, { status: 'TERMINATED' })

        if (res.error) {
            alert(`Failed to terminate lease: ${res.error}`)
            setLoading(false)
            return
        }

        if (unitId) {
            const unitRes = await updateUnitAction(role, unitId, { status: 'VACANT' } as UpdateUnitPayload)
            if (unitRes.error) {
                alert(`Lease terminated, but failed to mark unit as vacant: ${unitRes.error}`)
            }
        }

        if (onSuccess) onSuccess()
        router.refresh()
        setLoading(false)
    }

    return (
        <Button
            variant="destructive"
            size="sm"
            disabled={loading || !canMutate(role)}
            onClick={handleTerminate}
            className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
        >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
            Terminate
        </Button>
    )
}

const leaseFieldSchema: FieldSchema[] = [
    { name: "tenantId", required: false, parser: parseText },
    { name: "startDate", required: true, parser: parseDate, errorMessage: "Start date is required." },
    { name: "endDate", required: false, parser: parseDate },
    { name: "rentAmount", required: true, parser: parseNumber, errorMessage: "Rent amount must be a number." },
    { name: "deposit", required: false, parser: parseNumber },
    { name: "status", required: true, parser: parseText },
    { name: "notes", required: false, parser: parseText },
    { name: "agreementFee", required: false, parser: parseNumber },
]

export function CreateLeaseButton({ unit, role, tenants, onSuccess }: { unit: UnitRecord, role: UserRole | null, tenants: TenantRecord[], onSuccess?: () => void }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>()
    const [createNewTenant, setCreateNewTenant] = useState(false)
    const [reminders, setReminders] = useState<{ text: string; remindAt: string }[]>([])

    function addReminder() {
        setReminders([...reminders, { text: "", remindAt: new Date().toISOString().split('T')[0] }])
    }

    function removeReminder(index: number) {
        setReminders(reminders.filter((_, i) => i !== index))
    }

    function updateReminder(index: number, field: 'text' | 'remindAt', value: string) {
        const updated = [...reminders]
        updated[index] = { ...updated[index], [field]: value }
        setReminders(updated)
    }


    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) return

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const { values, errors } = parseForm<any>(leaseFieldSchema, formData)
        
        if (!createNewTenant && !selectedTenantId) {
            setError("Please select a tenant or create a new one.")
            setLoading(false)
            return
        }

        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const payload: CreateLeasePayload = {
            ...values,
            unitId: unit.id,
            propertyId: unit.propertyId,
            tenantId: createNewTenant ? undefined : selectedTenantId,
            reminders: reminders.filter(r => r.text),
        } as CreateLeasePayload

        if (createNewTenant) {
            payload.newTenant = {
                firstName: formData.get("firstName") as string,
                lastName: formData.get("lastName") as string,
                email: formData.get("email") as string || undefined,
                phone: formData.get("phone") as string || undefined,
                idNumber: formData.get("idNumber") as string || undefined,
                tenantCode: formData.get("tenantCode") as string || undefined,
            }
            
            if (!payload.newTenant.firstName || !payload.newTenant.lastName) {
                setError("Tenant name is required.")
                setLoading(false)
                return
            }
        }

        const res = await createLeaseAction(role, payload)

        if (res.error) {
            setError(res.error)
        } else {
            // After lease is created, we should also update the unit status to OCCUPIED if the lease is ACTIVE
            if (values.status === 'ACTIVE') {
                await updateUnitAction(role, unit.id, { status: 'OCCUPIED' })
            }
            setOpen(false)
            if (onSuccess) onSuccess()
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md hover:bg-white/10"
                    disabled={!canMutate(role)}
                >
                    <Plus className="h-3 w-3 text-neutral-400" />
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent zIndex={300}>
                <SlidePanelHeader>
                    <SlidePanelTitle>Create Lease</SlidePanelTitle>
                    <SlidePanelDescription>Create a new lease for {unit.unitNumber}.</SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-6">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-neutral-300">Tenant</label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-neutral-400">New Tenant</span>
                                <Switch checked={createNewTenant} onCheckedChange={setCreateNewTenant} />
                            </div>
                        </div>

                        {!createNewTenant ? (
                            <Combobox
                                name="tenantId"
                                options={tenants.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                                value={selectedTenantId}
                                onValueChange={setSelectedTenantId}
                                placeholder="Select tenant..."
                                required={!createNewTenant}
                            />
                        ) : (
                            <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input name="firstName" placeholder="First Name" required />
                                    <Input name="lastName" placeholder="Last Name" required />
                                </div>
                                <Input name="email" type="email" placeholder="Email (Optional)" />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input name="phone" placeholder="Phone Number" />
                                    <Input name="idNumber" placeholder="ID Number" />
                                </div>
                                <Input name="tenantCode" placeholder="Tenant Internal Code (e.g. T001)" />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Start Date</label>
                            <Input name="startDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">End Date (Optional)</label>
                            <Input name="endDate" type="date" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Rent Amount (KES)</label>
                            <Input name="rentAmount" type="number" step="0.01" defaultValue={unit.rentAmount} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Deposit (KES)</label>
                            <Input name="deposit" type="number" step="0.01" defaultValue={unit.rentAmount} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Agreement Fee (KES)</label>
                        <Input name="agreementFee" type="number" step="0.01" placeholder="Optional agreement/processing fee" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Initial Status</label>
                        <select name="status" defaultValue="ACTIVE" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                            <option value="ACTIVE" className="text-black">ACTIVE</option>
                            <option value="PENDING" className="text-black">PENDING</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Notes</label>
                        <textarea
                            name="notes"
                            placeholder="Add notes for this lease..."
                            className="flex min-h-[80px] w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white shadow-sm ring-offset-background placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-neutral-300">Reminders</label>
                            <Button type="button" variant="outline" size="sm" onClick={addReminder} className="h-7 px-2 text-xs border-white/10 bg-white/5 hover:bg-white/10">
                                <Plus className="mr-1 h-3 w-3" /> Add Reminder
                            </Button>
                        </div>

                        {reminders.map((reminder, index) => (
                            <div key={index} className="flex gap-2 items-start bg-white/5 p-2 rounded-md border border-white/5">
                                <div className="flex-1 space-y-2">
                                    <Input
                                        value={reminder.text}
                                        onChange={(e) => updateReminder(index, 'text', e.target.value)}
                                        placeholder="Remind me to..."
                                        className="h-8 text-xs"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-neutral-400" />
                                        <Input
                                            type="date"
                                            value={reminder.remindAt}
                                            onChange={(e) => updateReminder(index, 'remindAt', e.target.value)}
                                            className="h-7 text-[10px] w-auto py-0"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeReminder(index)}
                                    className="h-8 w-8 text-neutral-500 hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button type="submit" disabled={loading} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Lease
                    </Button>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function ViewStatementButton({ leaseId }: { leaseId: string }) {
    const router = useRouter()
    return (
        <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[10px] font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10 uppercase tracking-wider"
            onClick={() => router.push(`/admin/properties/leases/${leaseId}/statement`)}
        >
            <ClipboardList className="h-3 w-3 mr-1" />
            Statement
        </Button>
    )
}
