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
  createLandlordAction,
  deleteLandlordAction,
  updateLandlordAction,
  createPropertyAction,
  listPropertiesAction,
} from "@/lib/actions"
import { FieldSchema, parseForm, parseText } from "@/lib/form-helpers"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import type { LandlordRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

type LandlordFormValues = {
  firstName: string
  lastName: string
  email?: string
  propertyIds?: string[]
}

const landlordFieldSchema: FieldSchema[] = [
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
    name: "propertyIds",
    required: false,
    parser: (val) => (typeof val === "string" ? val.split(",").filter(Boolean) : []),
  },
]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

export function AddLandlordButton({ role }: { role: UserRole | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add landlords.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    // Ensure selectedPropertyId is in the formData if not already handled by AsyncCombobox hidden input
    if (selectedPropertyId && !formData.has("propertyIds")) {
      formData.set("propertyIds", selectedPropertyId)
    }

    const { values, errors } = parseForm<LandlordFormValues>(landlordFieldSchema, formData)
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { firstName, lastName, email, propertyIds } = values

    if (!firstName || !lastName) {
      setError("First and last names are required.")
      setLoading(false)
      return
    }

    const res = await createLandlordAction(role, {
      firstName,
      lastName,
      email,
      propertyIds: propertyIds,
    })

    if (res.error) {
      setError(res.error)
    } else {
      setOpen(false)
      setSelectedPropertyId("")
      router.refresh()
    }

    setLoading(false)
  }

  const handleSearchProperties = async (query: string) => {
    const res = await listPropertiesAction(role, { search: query, limit: 20 })
    if (res.data) {
      return res.data.data.map(p => ({
        value: p.id,
        label: `${p.name} ${p.landlord ? `(current: ${p.landlord.firstName} ${p.landlord.lastName})` : "(Unassigned)"}`
      }))
    }
    return []
  }

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>
        <Button variant="glass" disabled={!canMutate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Landlord
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Landlord</SlidePanelTitle>
          <SlidePanelDescription>Create a landlord profile.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-6 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">First Name</label>
              <Input
                name="firstName"
                placeholder="Jane"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Last Name</label>
              <Input
                name="lastName"
                placeholder="Doe"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Email Address (Optional)</label>
            <Input
              name="email"
              placeholder="jane.doe@example.com"
              type="email"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <div className="h-px bg-white/10 w-full my-4" />
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Assign Property</h4>
            <p className="text-xs text-neutral-400">Select an existing property to assign to this landlord.</p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Property</label>
              <AsyncCombobox
                onSearch={handleSearchProperties}
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
                placeholder="Search properties..."
                name="propertyIds"
              />
            </div>
          </div>
          <div className="pt-6">
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Landlord
            </Button>
          </div>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function LandlordRowActions({
  role,
  landlord,
}: {
  role: UserRole | null
  landlord: LandlordRecord
}) {
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

    const { values, errors } = parseForm<LandlordFormValues>(landlordFieldSchema, new FormData(e.currentTarget))
    if (errors.length) {
      setError(errors.join(" · "))
      setLoading(false)
      return
    }

    const { firstName, lastName, email } = values

    if (!firstName || !lastName) {
      setError("First and last name are required.")
      setLoading(false)
      return
    }

    const res = await updateLandlordAction(role, landlord.id, {
      firstName,
      lastName,
      email,
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
    if (!confirm(`Delete ${landlord.firstName} ${landlord.lastName}?`)) return

    setLoading(true)
    const res = await deleteLandlordAction(role, landlord.id)
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-neutral-400 hover:text-white transition-opacity"
        disabled={loading || !canMutate(role)}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>

      {menuOpen ? (
        <>
          <div className="absolute right-0 z-50 mt-1 w-32 rounded-lg border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden">
            <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10 transition-colors" onClick={() => { setMenuOpen(false); setOpen(true) }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
        </>
      ) : null}

      <SlidePanel open={open} onOpenChange={setOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>Edit Landlord</SlidePanelTitle>
            <SlidePanelDescription>Update profile details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-6 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">First Name</label>
                <Input
                  name="firstName"
                  defaultValue={landlord.firstName}
                  placeholder="First name"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                <Input
                  name="lastName"
                  defaultValue={landlord.lastName}
                  placeholder="Last name"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Email Address (Optional)</label>
              <Input
                name="email"
                type="email"
                defaultValue={landlord.email || ""}
                placeholder="Email address"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="pt-6">
              <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
                Save Changes
              </Button>
            </div>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
