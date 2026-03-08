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
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from "@/lib/actions"
import {
  FieldSchema,
  parseForm,
  parseNumber,
  parseText,
} from "@/lib/form-helpers"
import type { LeaseRecord, PaymentRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const PAYMENT_METHODS = ["MPESA", "BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"]
const PAYMENT_TYPES = ["RENT", "DEPOSIT", "PENALTY", "UTILITY", "OTHER"]

type PaymentFormValues = {
  leaseId: string
  amount: number
  method: string
  type: string
  reference?: string
}

const paymentFieldSchema: FieldSchema[] = [
  {
    name: "leaseId",
    required: true,
    parser: parseText,
    errorMessage: "Lease selection is required.",
  },
  {
    name: "amount",
    required: true,
    parser: parseNumber,
    errorMessage: "Amount must be a number.",
  },
  {
    name: "method",
    required: true,
    parser: parseText,
  },
  {
    name: "type",
    required: true,
    parser: parseText,
  },
  {
    name: "reference",
    required: false,
    parser: parseText,
  },
]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

function leaseLabel(lease: LeaseRecord) {
  if (lease.tenant) {
    return `${lease.tenant.firstName} ${lease.tenant.lastName} • ${lease.unit?.unitNumber ?? lease.unitId}`
  }

  return lease.id
}

export function AddPaymentButton({ role, leases }: { role: UserRole | null; leases: LeaseRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add payments.")
      return
    }

    setLoading(true)
    setError(null)

    const { values, errors } = parseForm<PaymentFormValues>(paymentFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { leaseId, amount, method, type, reference } = values

    const res = await createPaymentAction(role, {
      leaseId: leaseId!,
      amount: amount!,
      method: method!,
      type: type!,
      reference,
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
        <Button variant="glass" disabled={!canMutate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Payment</SlidePanelTitle>
          <SlidePanelDescription>Record a new payment entry.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <select name="leaseId" required className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
            <option value="">Select lease</option>
            {leases.map((lease) => (
              <option key={lease.id} value={lease.id}>{leaseLabel(lease)}</option>
            ))}
          </select>
          <Input name="amount" type="number" min="0" step="0.01" placeholder="Amount" required />
          <select name="method" defaultValue="MPESA" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <select name="type" defaultValue="RENT" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Input name="reference" placeholder="Reference (optional)" />
          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Payment
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function PaymentRowActions({ role, payment, leases }: { role: UserRole | null; payment: PaymentRecord; leases: LeaseRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) return

    setLoading(true)
    setError(null)

    const { values, errors } = parseForm<PaymentFormValues>(paymentFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { leaseId, amount, method, type, reference } = values

    const res = await updatePaymentAction(role, payment.id, {
      leaseId: leaseId!,
      amount: amount!,
      method: method!,
      type: type!,
      reference,
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
    if (!confirm(`Delete payment ${payment.id}?`)) return

    setLoading(true)
    const res = await deletePaymentAction(role, payment.id)
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
            <SlidePanelTitle>Edit Payment</SlidePanelTitle>
            <SlidePanelDescription>Update payment details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <select name="leaseId" required defaultValue={payment.leaseId} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              {leases.map((lease) => (
                <option key={lease.id} value={lease.id}>{leaseLabel(lease)}</option>
              ))}
            </select>
            <Input name="amount" type="number" min="0" step="0.01" defaultValue={payment.amount} required />
            <select name="method" defaultValue={payment.method} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            <select name="type" defaultValue={payment.type} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <Input name="reference" defaultValue={payment.reference || ""} />
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
