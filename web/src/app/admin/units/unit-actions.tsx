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
import { createUnitAction, deleteUnitAction, updateUnitAction, listPropertiesAction } from "@/lib/actions"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { FieldSchema, parseForm, parseNumber, parseText } from "@/lib/form-helpers"
import type { PropertyRecord, UnitRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

type UnitFormValues = {
  unitNumber: string
  propertyId: string
  rentAmount?: number
}

const unitFieldSchema: FieldSchema[] = [
  {
    name: "unitNumber",
    required: true,
    parser: parseText,
    errorMessage: "Unit number is required.",
  },
  {
    name: "propertyId",
    required: true,
    parser: parseText,
    errorMessage: "Property selection is required.",
  },
  {
    name: "rentAmount",
    parser: parseNumber,
  },
]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

export function AddUnitButton({ role, properties }: { role: UserRole | null; properties: PropertyRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add units.")
      return
    }

    setLoading(true)
    setError(null)

    const { values, errors } = parseForm<UnitFormValues>(unitFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { unitNumber, propertyId, rentAmount } = values

    if (!unitNumber || !propertyId) {
      setError("Unit number and property are required.")
      setLoading(false)
      return
    }

    const res = await createUnitAction(role, {
      unitNumber,
      propertyId,
      rentAmount,
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
          Add Unit
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Unit</SlidePanelTitle>
          <SlidePanelDescription>Create a unit under a property.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Input name="unitNumber" placeholder="Unit number" required />
          <AsyncCombobox
            name="propertyId"
            value={propertyId}
            onValueChange={setPropertyId}
            placeholder="Search properties..."
            required
            onSearch={async (q) => {
              const res = await listPropertiesAction(role, { search: q })
              return (res.data?.data ?? []).map(p => ({ value: p.id, label: p.name }))
            }}
            initialOptions={properties.map(p => ({ value: p.id, label: p.name }))}
          />
          <Input name="rentAmount" type="number" min="0" step="0.01" placeholder="Rent amount" />
          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Unit
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function UnitRowActions({ role, unit, properties }: { role: UserRole | null; unit: UnitRecord; properties: PropertyRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState(unit.propertyId || "")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) return

    setLoading(true)
    setError(null)

    const { values, errors } = parseForm<UnitFormValues>(unitFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { unitNumber, propertyId, rentAmount } = values

    if (!unitNumber || !propertyId) {
      setError("Unit number and property are required.")
      setLoading(false)
      return
    }

    const res = await updateUnitAction(role, unit.id, {
      unitNumber,
      propertyId,
      rentAmount,
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
    if (!confirm(`Delete unit ${unit.unitNumber}?`)) return

    setLoading(true)
    const res = await deleteUnitAction(role, unit.id)
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
            <SlidePanelTitle>Edit Unit</SlidePanelTitle>
            <SlidePanelDescription>Update unit details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Input name="unitNumber" defaultValue={unit.unitNumber} required />
            <AsyncCombobox
              name="propertyId"
              value={propertyId}
              onValueChange={setPropertyId}
              placeholder="Search properties..."
              required
              onSearch={async (q) => {
                const res = await listPropertiesAction(role, { search: q })
                return (res.data?.data ?? []).map(p => ({ value: p.id, label: p.name }))
              }}
              initialOptions={properties.map(p => ({ value: p.id, label: p.name }))}
            />
            <Input name="rentAmount" type="number" min="0" step="0.01" defaultValue={unit.rentAmount ?? ""} />
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
