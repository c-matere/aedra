"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

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
import { createInvoiceAction, createPaymentAction } from "@/lib/actions"
import { parseForm, parseNumber, parseText, FieldSchema } from "@/lib/form-helpers"
import type { UserRole } from "@/lib/rbac"

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
}

export function AddInvoiceButton({ leaseId, role }: AddActionProps) {
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
        })

        if (res.error) {
            setError(res.error)
        } else {
            setOpen(false)
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

export function AddPaymentButton({ leaseId, role }: AddActionProps) {
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
        })

        if (res.error) {
            setError(res.error)
        } else {
            setOpen(false)
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
