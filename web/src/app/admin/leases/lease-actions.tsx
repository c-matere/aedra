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
import { Combobox } from "@/components/ui/combobox"
import {
  createLeaseAction,
  deleteLeaseAction,
  updateLeaseAction,
} from "@/lib/actions"
import { FieldSchema, parseForm, parseDate, parseNumber, parseText } from "@/lib/form-helpers"
import type { LeaseRecord, PropertyRecord, TenantRecord, UnitRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const LEASE_STATUSES = ["PENDING", "ACTIVE", "EXPIRED", "TERMINATED"]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

function tenantLabel(tenant: TenantRecord) {
  return `${tenant.firstName} ${tenant.lastName}`
}

function unitLabel(unit: UnitRecord) {
  return `${unit.unitNumber}${unit.property?.name ? ` • ${unit.property.name}` : ""}`
}

export function AddLeaseButton({
  role,
  tenants,
  units,
  properties,
}: {
  role: UserRole | null
  tenants: TenantRecord[]
  units: UnitRecord[]
  properties: PropertyRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Partial<LeaseFormValues>>({
    status: "PENDING"
  })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add leases.")
      return
    }

    setLoading(true)
    setError(null)

    const { values, errors } = parseForm<LeaseFormValues>(leaseFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { tenantId, unitId, propertyId, startDate, endDate, rentAmount, status } = values

    const res = await createLeaseAction(role, {
      tenantId: tenantId!,
      unitId: unitId!,
      propertyId: propertyId!,
      startDate: startDate!,
      endDate: endDate!,
      rentAmount: rentAmount!,
      status: status!,
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
          Add Lease
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Lease</SlidePanelTitle>
          <SlidePanelDescription>Create a new lease contract.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Tenant</label>
            <Combobox
              name="tenantId"
              options={tenants.map((t) => ({ value: t.id, label: tenantLabel(t) }))}
              value={values.tenantId}
              onValueChange={(val) => setValues(prev => ({ ...prev, tenantId: val }))}
              placeholder="Select tenant..."
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Property</label>
            <Combobox
              name="propertyId"
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
              value={values.propertyId}
              onValueChange={(val) => setValues(prev => ({ ...prev, propertyId: val }))}
              placeholder="Select property..."
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Unit</label>
            <Combobox
              name="unitId"
              options={units.map((u) => ({ value: u.id, label: unitLabel(u) }))}
              value={values.unitId}
              onValueChange={(val) => setValues(prev => ({ ...prev, unitId: val }))}
              placeholder="Select unit..."
              required
            />
          </div>
          <Input name="startDate" type="date" required />
          <Input name="endDate" type="date" required />
          <Input name="rentAmount" type="number" min="0" step="0.01" placeholder="Rent amount" required />
          <select name="status" defaultValue="PENDING" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
            {LEASE_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Lease
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

type LeaseFormValues = {
  tenantId: string
  unitId: string
  propertyId: string
  startDate: string
  endDate: string
  rentAmount: number
  status: string
}

const leaseFieldSchema: FieldSchema[] = [
  {
    name: "tenantId",
    required: true,
    parser: parseText,
    errorMessage: "Tenant is required.",
  },
  {
    name: "unitId",
    required: true,
    parser: parseText,
    errorMessage: "Unit selection is required.",
  },
  {
    name: "propertyId",
    required: true,
    parser: parseText,
    errorMessage: "Property is required.",
  },
  {
    name: "startDate",
    required: true,
    parser: parseDate,
    errorMessage: "Start date is required and must be valid.",
  },
  {
    name: "endDate",
    required: true,
    parser: parseDate,
    errorMessage: "End date is required and must be valid.",
  },
  {
    name: "rentAmount",
    required: true,
    parser: parseNumber,
    errorMessage: "Rent amount must be a number.",
  },
  {
    name: "status",
    required: true,
    parser: parseText,
    errorMessage: "Lease status is required.",
  },
]

export function LeaseRowActions({
  role,
  lease,
  tenants,
  units,
  properties,
}: {
  role: UserRole | null
  lease: LeaseRecord
  tenants: TenantRecord[]
  units: UnitRecord[]
  properties: PropertyRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<LeaseFormValues>>({
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    status: lease.status
  })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) return

    setLoading(true)
    setError(null)
    const { values, errors } = parseForm<LeaseFormValues>(leaseFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { tenantId, unitId, propertyId, startDate, endDate, rentAmount, status } = values

    const res = await updateLeaseAction(role, lease.id, {
      tenantId: tenantId!,
      unitId: unitId!,
      propertyId: propertyId!,
      startDate: startDate!,
      endDate: endDate!,
      rentAmount: rentAmount!,
      status: status!,
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
    if (!confirm(`Delete lease ${lease.id}?`)) return

    setLoading(true)
    const res = await deleteLeaseAction(role, lease.id)
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
            <SlidePanelTitle>Edit Lease</SlidePanelTitle>
            <SlidePanelDescription>Update lease details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Tenant</label>
              <Combobox
                name="tenantId"
                options={tenants.map((t) => ({ value: t.id, label: tenantLabel(t) }))}
                value={editValues.tenantId}
                onValueChange={(val) => setEditValues(prev => ({ ...prev, tenantId: val }))}
                placeholder="Select tenant..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Property</label>
              <Combobox
                name="propertyId"
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
                value={editValues.propertyId}
                onValueChange={(val) => setEditValues(prev => ({ ...prev, propertyId: val }))}
                placeholder="Select property..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Unit</label>
              <Combobox
                name="unitId"
                options={units.map((u) => ({ value: u.id, label: unitLabel(u) }))}
                value={editValues.unitId}
                onValueChange={(val) => setEditValues(prev => ({ ...prev, unitId: val }))}
                placeholder="Select unit..."
                required
              />
            </div>
            <Input name="startDate" type="date" defaultValue={lease.startDate ? lease.startDate.slice(0, 10) : ""} required />
            <Input name="endDate" type="date" defaultValue={lease.endDate ? lease.endDate.slice(0, 10) : ""} required />
            <Input name="rentAmount" type="number" min="0" step="0.01" defaultValue={lease.rentAmount} required />
            <select name="status" defaultValue={lease.status} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              {LEASE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
