"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

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
import { createExpenseAction, deleteExpenseAction, listPropertiesAction, updateExpenseAction } from "@/lib/actions"
import { FieldSchema, parseForm, parseNumber, parseText } from "@/lib/form-helpers"
import type { ExpenseRecord, PropertyRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const EXPENSE_CATEGORIES = [
  "MAINTENANCE", "REPAIR", "UTILITY", "INSURANCE", "TAX",
  "MANAGEMENT_FEE", "LEGAL", "CLEANING", "SECURITY", "OTHER",
  "OFFICE_RENT", "INTERNET", "SALARY", "MARKETING", "OFFICE_SUPPLIES", "COMMISSION_AGENT_FEE",
]

type ExpenseFormValues = {
  description: string
  amount: number
  category?: string
  vendor?: string
  reference?: string
  notes?: string
  propertyId?: string
}

const expenseFieldSchema: FieldSchema[] = [
  {
    name: "description",
    required: true,
    parser: parseText,
    errorMessage: "Description is required.",
  },
  {
    name: "amount",
    required: true,
    parser: parseNumber,
    errorMessage: "Amount must be a valid number.",
  },
  { name: "category", required: false, parser: parseText },
  { name: "vendor", required: false, parser: parseText },
  { name: "reference", required: false, parser: parseText },
  { name: "notes", required: false, parser: parseText },
  { name: "propertyId", required: false, parser: parseText },
]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

export function AddExpenseButton({
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add expenses.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const { values, errors } = parseForm<ExpenseFormValues>(expenseFieldSchema, formData)
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { description, amount, category, vendor, reference, notes } = values
    if (!description || amount === undefined) {
      setError("Description and amount are required.")
      setLoading(false)
      return
    }

    const res = await createExpenseAction(role, {
      description,
      amount,
      category: category || undefined,
      vendor: vendor || undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      propertyId: propertyId || undefined,
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
        <Button variant="glass" disabled={!canMutate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Expense</SlidePanelTitle>
          <SlidePanelDescription>Record an operational expense.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Description</label>
            <Input name="description" placeholder="Description" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
            <Input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Category</label>
            <select name="category" defaultValue="" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              <option value="">Select category (optional)</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
              ))}
            </select>
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
              placeholder="Search properties..."
              initialOptions={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <Input name="vendor" placeholder="Vendor / supplier (optional)" />
          <Input name="reference" placeholder="Reference / invoice no. (optional)" />
          <Input name="notes" placeholder="Notes (optional)" />
          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Expense
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function ExpenseRowActions({
  role,
  expense,
  properties,
}: {
  role: UserRole | null
  expense: ExpenseRecord
  properties: PropertyRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState(expense.propertyId || "")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) return

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const { values, errors } = parseForm<ExpenseFormValues>(expenseFieldSchema, formData)
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { description, amount, category, vendor, reference, notes } = values
    if (!description || amount === undefined) {
      setError("Description and amount are required.")
      setLoading(false)
      return
    }

    const res = await updateExpenseAction(role, expense.id, {
      description,
      amount,
      category: category || undefined,
      vendor: vendor || undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      propertyId: propertyId || undefined,
    })

    if (res.error) {
      setError(res.error)
    } else {
      setOpen(false)
      router.refresh()
    }

    setLoading(false)
  }

  async function onDelete() {
    if (!canMutate(role)) return
    if (!confirm(`Delete expense "${expense.description}"?`)) return

    setLoading(true)
    const res = await deleteExpenseAction(role, expense.id)
    if (res.error) {
      alert(`Delete failed: ${res.error}`)
    } else {
      router.refresh()
    }
    setMenuOpen(false)
    setLoading(false)
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" disabled={loading || !canMutate(role)} onClick={() => setMenuOpen((v) => !v)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 z-50 mt-1 w-32 rounded border border-white/10 bg-neutral-900">
          <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => { setMenuOpen(false); setOpen(true) }}>
            <Pencil className="mr-2 inline h-3 w-3" /> Edit
          </button>
          <button className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10" onClick={onDelete}>
            <Trash2 className="mr-2 inline h-3 w-3" /> Delete
          </button>
        </div>
      ) : null}

      <SlidePanel open={open} onOpenChange={setOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>Edit Expense</SlidePanelTitle>
            <SlidePanelDescription>Update expense details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Description</label>
              <Input name="description" defaultValue={expense.description} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
              <Input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Category</label>
              <select name="category" defaultValue={expense.category ?? ""} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                <option value="">Select category (optional)</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                ))}
              </select>
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
                placeholder="Search properties..."
                initialOptions={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <Input name="vendor" defaultValue={expense.vendor ?? ""} placeholder="Vendor / supplier (optional)" />
            <Input name="reference" defaultValue={expense.reference ?? ""} placeholder="Reference / invoice no. (optional)" />
            <Input name="notes" defaultValue={expense.notes ?? ""} placeholder="Notes (optional)" />
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
