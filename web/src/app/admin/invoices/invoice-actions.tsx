"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, FileText } from "lucide-react"

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
import { createInvoiceAction, deleteInvoiceAction, updateInvoiceAction } from "@/lib/actions"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { listLeasesAction } from "@/lib/actions"
import type { LeaseRecord, InvoiceRecord, InvoiceType } from "@/lib/backend-api"
import { getInvoicePdf } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

function leaseLabel(lease: LeaseRecord) {
  if (lease.tenant) {
    return `${lease.tenant.firstName} ${lease.tenant.lastName} • ${lease.unit?.unitNumber ?? lease.unitId}`
  }

  return lease.id
}

export function AddInvoiceButton({ role, leases }: { role: UserRole | null; leases: LeaseRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaseId, setLeaseId] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to create invoices.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const amount = Number(formData.get("amount") || 0)
    const description = String(formData.get("description") || "")
    const type = String(formData.get("type") || "RENT") as InvoiceType
    const dueDate = String(formData.get("dueDate") || new Date().toISOString().split('T')[0])

    if (!leaseId) {
      setError("Lease is required.")
      setLoading(false)
      return
    }

    const res = await createInvoiceAction(role, {
      leaseId,
      amount,
      description,
      type,
      dueDate,
    })

    if (res.error) {
      setError(res.error)
    } else {
      setOpen(false)
      setLeaseId("")
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>
        <Button variant="glass" disabled={!canMutate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Create Invoice</SlidePanelTitle>
          <SlidePanelDescription>Record a lease billing entry.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Lease</label>
            <AsyncCombobox
              name="leaseId"
              onSearch={async (query) => {
                const res = await listLeasesAction(role, { search: query })
                return (res.data?.data ?? []).map(l => ({ value: l.id, label: leaseLabel(l) }))
              }}
              value={leaseId}
              onValueChange={setLeaseId}
              placeholder="Search leases..."
              required
              initialOptions={leases.map(l => ({ value: l.id, label: leaseLabel(l) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Type</label>
              <select name="type" required className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                <option value="RENT">Rent</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="PENALTY">Penalty</option>
                <option value="UTILITY">Utility</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Due Date</label>
              <Input
                name="dueDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
            <Input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Description</label>
            <Input name="description" placeholder="e.g. Rent for March" required />
          </div>
          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Invoice
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function InvoiceRowActions({ role, invoice, leases, token }: { role: UserRole | null; invoice: InvoiceRecord; leases: LeaseRecord[]; token: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaseId, setLeaseId] = useState(invoice.leaseId)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) return

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const amount = Number(formData.get("amount") || 0)
    const description = String(formData.get("description") || "")
    const type = String(formData.get("type") || "RENT") as InvoiceType
    const dueDate = String(formData.get("dueDate") || "")

    if (!leaseId) {
      setError("Lease is required.")
      setLoading(false)
      return
    }

    const res = await updateInvoiceAction(role, invoice.id, {
      leaseId,
      amount,
      description,
      type,
      dueDate,
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
    if (!confirm(`Delete invoice ${invoice.id}?`)) return

    setLoading(true)
    const res = await deleteInvoiceAction(role, invoice.id)
    if (res.error) {
      alert(`Delete failed: ${res.error}`)
    } else {
      router.refresh()
    }
    setMenuOpen(false)
    setLoading(false)
  }

  async function onDownload() {
    setLoading(true)
    try {
      // Use the token passed as prop
      const res = await getInvoicePdf(token, invoice.id)
      if (res.data?.url) {
        window.open(res.data.url, "_blank")
      } else {
        alert(res.error || "Failed to generate PDF")
      }
    } catch (err) {
      alert("Failed to download PDF")
    } finally {
      setLoading(false)
      setMenuOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" disabled={loading} onClick={onDownload} title="Download PDF">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      </Button>

      <div className="relative">
        <Button variant="ghost" size="icon" disabled={loading || !canMutate(role)} onClick={() => setMenuOpen((v) => !v)}>
          <MoreHorizontal className="h-4 w-4" />
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
      </div>

      <SlidePanel open={open} onOpenChange={setOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>Edit Invoice</SlidePanelTitle>
            <SlidePanelDescription>Update invoice details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Lease</label>
              <AsyncCombobox
                name="leaseId"
                onSearch={async (query) => {
                  const res = await listLeasesAction(role, { search: query })
                  return (res.data?.data ?? []).map(l => ({ value: l.id, label: leaseLabel(l) }))
                }}
                value={leaseId}
                onValueChange={setLeaseId}
                placeholder="Search leases..."
                required
                initialOptions={leases.map(l => ({ value: l.id, label: leaseLabel(l) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Type</label>
                <select name="type" required defaultValue={invoice.type} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                  <option value="RENT">Rent</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="PENALTY">Penalty</option>
                  <option value="UTILITY">Utility</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Due Date</label>
                <Input name="dueDate" type="date" required defaultValue={invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : ""} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Amount (KES)</label>
              <Input name="amount" type="number" min="0" step="0.01" defaultValue={invoice.amount} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Description</label>
              <Input name="description" defaultValue={invoice.description || ""} required />
            </div>
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
