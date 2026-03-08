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
import {
  createMaintenanceRequestAction,
  deleteMaintenanceRequestAction,
  listUnitsAction,
  updateMaintenanceRequestAction,
} from "@/lib/actions"
import {
  FieldSchema,
  parseForm,
  parseText,
} from "@/lib/form-helpers"
import type {
  MaintenanceRequestRecord,
  PropertyRecord,
  UnitRecord,
} from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const MAINTENANCE_STATUSES = [
  "REPORTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]

const MAINTENANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const MAINTENANCE_CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "PAINTING",
  "APPLIANCE",
  "PEST_CONTROL",
  "HVAC",
  "ROOFING",
  "FLOORING",
  "GENERAL",
  "OTHER",
]

function canCreateOrUpdate(role: UserRole | null) {
  return !!role
}

function canDelete(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

type MaintenanceFormValues = {
  title: string
  propertyId: string
  unitId?: string
  priority: string
  category: string
  status: string
}

const maintenanceFieldSchema: FieldSchema[] = [
  {
    name: "title",
    required: true,
    parser: parseText,
    errorMessage: "Title is required.",
  },
  {
    name: "propertyId",
    required: true,
    parser: parseText,
    errorMessage: "Property is required.",
  },
  {
    name: "unitId",
    required: false,
    parser: parseText,
  },
  {
    name: "priority",
    required: true,
    parser: parseText,
    errorMessage: "Priority is required.",
  },
  {
    name: "category",
    required: true,
    parser: parseText,
    errorMessage: "Category is required.",
  },
  {
    name: "status",
    required: true,
    parser: parseText,
    errorMessage: "Status is required.",
  },
]

function propertyLabel(property: PropertyRecord) {
  return property.name
}

function unitLabel(unit: UnitRecord) {
  return `${unit.unitNumber}${unit.property?.name ? ` • ${unit.property.name}` : ""}`
}

export function AddMaintenanceButton({
  role,
  properties,
  units,
}: {
  role: UserRole | null
  properties: PropertyRecord[]
  units: UnitRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unitId, setUnitId] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canCreateOrUpdate(role)) {
      setError("You do not have permission to create maintenance requests.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const { values, errors } = parseForm<MaintenanceFormValues>(maintenanceFieldSchema, formData)
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { title, propertyId, priority, category, status } = values

    const res = await createMaintenanceRequestAction(role, {
      title: title!,
      propertyId: propertyId!,
      unitId: unitId || undefined,
      priority: priority!,
      category: category!,
      status: status!,
    })

    if (res.error) {
      setError(res.error)
    } else {
      setOpen(false)
      setUnitId("")
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>
        <Button variant="glass" disabled={!canCreateOrUpdate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Request
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Maintenance Request</SlidePanelTitle>
          <SlidePanelDescription>Create a new maintenance task.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Title</label>
            <Input name="title" placeholder="Summary of the issue" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Property</label>
            <select name="propertyId" required className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{propertyLabel(property)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Unit (Optional)</label>
            <AsyncCombobox
              name="unitId"
              onSearch={async (query) => {
                const res = await listUnitsAction(role, { search: query })
                return (res.data?.data ?? []).map((u) => ({ value: u.id, label: unitLabel(u) }))
              }}
              value={unitId}
              onValueChange={setUnitId}
              placeholder="Search units..."
              initialOptions={units.slice(0, 50).map((u) => ({ value: u.id, label: unitLabel(u) }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Priority</label>
              <select name="priority" defaultValue="MEDIUM" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {MAINTENANCE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Category</label>
              <select name="category" defaultValue="GENERAL" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {MAINTENANCE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Status</label>
              <select name="status" defaultValue="REPORTED" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {MAINTENANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading || !canCreateOrUpdate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Request
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

function SolveRequestButton({
  role,
  requestId,
  onSolved,
}: {
  role: UserRole | null
  requestId: string
  onSolved: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleSolve() {
    if (!confirm("Mark this request as solved?")) return
    setLoading(true)
    const res = await updateMaintenanceRequestAction(role, requestId, {
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    })
    if (res.error) {
      alert(`Failed to solve: ${res.error}`)
    } else {
      onSolved()
    }
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
      disabled={loading}
      onClick={handleSolve}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solve"}
    </Button>
  )
}

export function MaintenanceRowActions({
  role,
  request,
  properties,
  units,
}: {
  role: UserRole | null
  request: MaintenanceRequestRecord
  properties: PropertyRecord[]
  units: UnitRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unitId, setUnitId] = useState(request.unitId || "")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canCreateOrUpdate(role)) return

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const { values, errors } = parseForm<MaintenanceFormValues>(maintenanceFieldSchema, formData)
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { title, propertyId, priority, category, status } = values

    const res = await updateMaintenanceRequestAction(role, request.id, {
      title: title!,
      propertyId: propertyId!,
      unitId: unitId || undefined,
      priority: priority!,
      category: category!,
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
    if (!canDelete(role)) return
    if (!confirm(`Delete request ${request.id}?`)) return

    setLoading(true)
    const res = await deleteMaintenanceRequestAction(role, request.id)
    if (res.error) {
      alert(`Delete failed: ${res.error}`)
    } else {
      router.refresh()
    }
    setMenuOpen(false)
    setLoading(false)
  }

  return (
    <div className="relative flex items-center gap-1">
      {request.status !== "COMPLETED" && request.status !== "CANCELLED" && (
        <SolveRequestButton
          role={role}
          requestId={request.id}
          onSolved={() => router.refresh()}
        />
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white transition-opacity" disabled={loading || !canCreateOrUpdate(role)} onClick={() => setMenuOpen((v) => !v)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 z-50 mt-1 w-32 rounded border border-white/10 bg-neutral-900">
          <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => { setMenuOpen(false); setOpen(true) }}>
            <Pencil className="mr-2 inline h-3 w-3" /> Edit
          </button>
          {canDelete(role) ? (
            <button className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10" onClick={onDelete}>
              <Trash2 className="mr-2 inline h-3 w-3" /> Delete
            </button>
          ) : null}
        </div>
      ) : null}

      <SlidePanel open={open} onOpenChange={setOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>Edit Maintenance Request</SlidePanelTitle>
            <SlidePanelDescription>Update request details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Title</label>
              <Input name="title" defaultValue={request.title} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Property</label>
              <select name="propertyId" required defaultValue={request.propertyId} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{propertyLabel(property)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Unit (Optional)</label>
              <AsyncCombobox
                name="unitId"
                onSearch={async (query) => {
                  const res = await listUnitsAction(role, { search: query })
                  return (res.data?.data ?? []).map((u) => ({ value: u.id, label: unitLabel(u) }))
                }}
                value={unitId}
                onValueChange={setUnitId}
                placeholder="Search units..."
                initialOptions={units.slice(0, 50).map((u) => ({ value: u.id, label: unitLabel(u) }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Priority</label>
                <select name="priority" defaultValue={request.priority || "MEDIUM"} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                  {MAINTENANCE_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Category</label>
                <select name="category" defaultValue={request.category || "GENERAL"} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                  {MAINTENANCE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Status</label>
                <select name="status" defaultValue={request.status || "REPORTED"} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                  {MAINTENANCE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !canCreateOrUpdate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
