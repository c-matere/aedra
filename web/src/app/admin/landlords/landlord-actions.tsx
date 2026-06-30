"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
        <Button variant="default" disabled={!canMutate(role)} className="bg-primary text-primary-foreground hover:opacity-90 font-medium h-9 rounded-[9.6px] border-none shadow-none">
          <Plus className="mr-2 h-4 w-4" />
          Add Landlord
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent className="sm:max-w-2xl border-l border-[#dedcd1] bg-[#ffffff] shadow-none">
        <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
          <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">Add Landlord</SlidePanelTitle>
          <SlidePanelDescription className="text-sm text-[#73726c]">Create a landlord profile.</SlidePanelDescription>
        </SlidePanelHeader>
        <form onSubmit={onSubmit} className="space-y-6 py-6">
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">First Name</label>
              <Input
                name="firstName"
                placeholder="Jane"
                required
                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Last Name</label>
              <Input
                name="lastName"
                placeholder="Doe"
                required
                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Email Address (Optional)</label>
            <Input
              name="email"
              placeholder="jane.doe@example.com"
              type="email"
              className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
            />
          </div>
          <div className="h-px bg-[#dedcd1] w-full my-4" />
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-[#141413]">Assign Property</h4>
            <p className="text-xs text-[#73726c]">Select an existing property to assign to this landlord.</p>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Property</label>
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
            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full bg-primary text-primary-foreground hover:opacity-90 font-medium h-11 rounded-[9.6px] border-none shadow-none">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
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
        className="h-8 w-8 text-[#73726c] hover:text-[#1f1e1d] hover:bg-[#f0eee6] rounded-[9.6px] transition-colors"
        disabled={loading || !canMutate(role)}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#1f1e1d]" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>

      {menuOpen ? (
        <>
          <div className="absolute right-0 z-50 mt-1 w-32 rounded-[9.6px] border border-[#dedcd1] bg-[#ffffff] shadow-none overflow-hidden">
            <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#1f1e1d] hover:bg-[#f0eee6] transition-colors" onClick={() => { setMenuOpen(false); setOpen(true) }}>
              <Pencil className="h-3.5 w-3.5 text-[#73726c]" /> Edit
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50/10 transition-colors" onClick={onDelete}>
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
        <SlidePanelContent className="sm:max-w-2xl border-l border-[#dedcd1] bg-[#ffffff] shadow-none">
          <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
            <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">Edit Landlord</SlidePanelTitle>
            <SlidePanelDescription className="text-sm text-[#73726c]">Update profile details.</SlidePanelDescription>
          </SlidePanelHeader>
          <form onSubmit={onSubmit} className="space-y-6 py-6">
            {error ? <p className="text-sm text-red-800">{error}</p> : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">First Name</label>
                <Input
                  name="firstName"
                  defaultValue={landlord.firstName}
                  placeholder="First name"
                  required
                  className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Last Name</label>
                <Input
                  name="lastName"
                  defaultValue={landlord.lastName}
                  placeholder="Last name"
                  required
                  className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Email Address (Optional)</label>
              <Input
                name="email"
                type="email"
                defaultValue={landlord.email || ""}
                placeholder="Email address"
                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none h-11 shadow-none"
              />
            </div>
            <div className="pt-6">
              <Button type="submit" disabled={loading || !canMutate(role)} className="w-full bg-primary text-primary-foreground hover:opacity-90 font-medium h-11 rounded-[9.6px] border-none shadow-none">
                Save Changes
              </Button>
            </div>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
