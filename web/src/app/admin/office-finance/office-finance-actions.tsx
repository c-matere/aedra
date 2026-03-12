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
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { createOfficeIncomeAction, createOfficeExpenseAction, listPropertiesAction } from "@/lib/actions"
import { FieldSchema, parseForm, parseNumber, parseText } from "@/lib/form-helpers"
import type { UserRole } from "@/lib/rbac"

const INCOME_CATEGORIES = ["COMMISSION", "MANAGEMENT_FEE", "OTHER"]
const EXPENSE_CATEGORIES = [
    "MAINTENANCE", "REPAIR", "UTILITY", "INSURANCE", "TAX",
    "MANAGEMENT_FEE", "LEGAL", "CLEANING", "SECURITY", "OFFICE_RENT",
    "INTERNET", "SALARY", "MARKETING", "OFFICE_SUPPLIES", "COMMISSION_AGENT_FEE", "OTHER"
]

const incomeFieldSchema: FieldSchema[] = [
    { name: "description", required: false, parser: parseText },
    { name: "amount", required: true, parser: parseNumber, errorMessage: "Amount is required." },
    { name: "category", required: true, parser: parseText, errorMessage: "Category is required." },
    { name: "date", required: true, parser: parseText, errorMessage: "Date is required." },
    { name: "propertyId", required: false, parser: parseText },
]

const expenseFieldSchema: FieldSchema[] = [
    { name: "description", required: true, parser: parseText, errorMessage: "Description is required." },
    { name: "amount", required: true, parser: parseNumber, errorMessage: "Amount is required." },
    { name: "category", required: true, parser: parseText, errorMessage: "Category is required." },
    { name: "date", required: true, parser: parseText, errorMessage: "Date is required." },
    { name: "vendor", required: false, parser: parseText },
    { name: "reference", required: false, parser: parseText },
    { name: "notes", required: false, parser: parseText },
]

export function OfficeFinanceActions({ role }: { role: UserRole | null }) {
    const router = useRouter()
    const [incomeOpen, setIncomeOpen] = useState(false)
    const [expenseOpen, setExpenseOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [propertyId, setPropertyId] = useState("")

    async function onIncomeSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const { values, errors } = parseForm<any>(incomeFieldSchema, formData)

        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const res = await createOfficeIncomeAction({
            ...values,
            propertyId: propertyId || undefined,
        })

        if (res.error) {
            setError(res.error)
        } else {
            setIncomeOpen(false)
            setPropertyId("")
            router.refresh()
        }
        setLoading(false)
    }

    async function onExpenseSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const { values, errors } = parseForm<any>(expenseFieldSchema, formData)

        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const res = await createOfficeExpenseAction(values)

        if (res.error) {
            setError(res.error)
        } else {
            setExpenseOpen(false)
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div className="flex gap-2">
            {/* Record Income */}
            <SlidePanel open={incomeOpen} onOpenChange={setIncomeOpen}>
                <SlidePanelTrigger asChild>
                    <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        Record Income
                    </Button>
                </SlidePanelTrigger>
                <SlidePanelContent>
                    <SlidePanelHeader>
                        <SlidePanelTitle>Record Office Income</SlidePanelTitle>
                        <SlidePanelDescription>Manually record commissions, fees or other income.</SlidePanelDescription>
                    </SlidePanelHeader>
                    <form onSubmit={onIncomeSubmit} className="space-y-4 py-6">
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Description</label>
                            <Input name="description" placeholder="e.g. Management Fee for Feb" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
                            <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Category</label>
                            <select name="category" className="h-10 w-full rounded-md border border-white/10 bg-neutral-900 px-3 text-sm text-white" required>
                                {INCOME_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Date</label>
                            <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Property (Optional)</label>
                            <AsyncCombobox
                                name="propertyId"
                                onSearch={async (query) => {
                                    const res = await listPropertiesAction(role, { search: query })
                                    return (res.data?.data ?? []).map((p) => ({ value: p.id, label: p.name }))
                                }}
                                value={propertyId}
                                onValueChange={setPropertyId}
                                placeholder="Attach to property..."
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Income
                        </Button>
                    </form>
                </SlidePanelContent>
            </SlidePanel>

            {/* Record Expense */}
            <SlidePanel open={expenseOpen} onOpenChange={setExpenseOpen}>
                <SlidePanelTrigger asChild>
                    <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        Record Expense
                    </Button>
                </SlidePanelTrigger>
                <SlidePanelContent>
                    <SlidePanelHeader>
                        <SlidePanelTitle>Record Office Expense</SlidePanelTitle>
                        <SlidePanelDescription>Record operational costs not tied to a specific property.</SlidePanelDescription>
                    </SlidePanelHeader>
                    <form onSubmit={onExpenseSubmit} className="space-y-4 py-6">
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Description</label>
                            <Input name="description" placeholder="e.g. Office Rent" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
                            <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Category</label>
                            <select name="category" className="h-10 w-full rounded-md border border-white/10 bg-neutral-900 px-3 text-sm text-white" required>
                                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Date</label>
                            <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Vendor</label>
                            <Input name="vendor" placeholder="Supplier / Handyman" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Reference</label>
                            <Input name="reference" placeholder="Invoice / Receipt No." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Notes</label>
                            <Input name="notes" placeholder="Additional details..." />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Expense
                        </Button>
                    </form>
                </SlidePanelContent>
            </SlidePanel>
        </div>
    )
}
