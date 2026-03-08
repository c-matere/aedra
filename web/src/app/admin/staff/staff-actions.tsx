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
import { createUserAction, deleteUserAction, updateUserAction } from "@/lib/actions"
import type { UserRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const USER_ROLES: UserRole[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_STAFF"]

const ALL_PERMISSIONS = [
  { id: "manage_properties", label: "Properties" },
  { id: "manage_units", label: "Units" },
  { id: "manage_tenants", label: "Tenants" },
  { id: "manage_landlords", label: "Landlords" },
  { id: "manage_leases", label: "Leases" },
  { id: "manage_maintenance", label: "Maintenance" },
  { id: "manage_payments", label: "Payments" },
  { id: "manage_invoices", label: "Invoices" },
  { id: "manage_expenses", label: "Expenses" },
  { id: "manage_staff", label: "Staff" },
  { id: "manage_documents", label: "Documents" },
  { id: "view_reports", label: "Reports" },
]

function canMutate(role: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN"
}

function fullName(user: UserRecord) {
  return `${user.firstName} ${user.lastName}`.trim()
}

export function AddStaffButton({ role }: { role: UserRole | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to add staff users.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = String(formData.get("email") || "")
    const password = String(formData.get("password") || "")
    const firstName = String(formData.get("firstName") || "")
    const lastName = String(formData.get("lastName") || "")
    const phone = String(formData.get("phone") || "")
    const selectedRole = String(formData.get("role") || "COMPANY_STAFF") as UserRole

    const selectedPermissions = ALL_PERMISSIONS
      .filter(p => formData.get(`perm_${p.id}`) === "on")
      .map(p => p.id)

    const payload = {
      email,
      password,
      firstName,
      lastName,
      phone: phone || undefined,
      role: selectedRole,
      permissions: selectedPermissions,
      isActive: true,
    }

    const res = await createUserAction(role, payload)
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
          Add Staff
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Add Staff User</SlidePanelTitle>
          <SlidePanelDescription>Create a new authenticated staff account.</SlidePanelDescription>
        </SlidePanelHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-6">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Input name="firstName" placeholder="First name" required />
          <Input name="lastName" placeholder="Last name" required />
          <Input name="email" type="email" placeholder="Email" required />
          <Input name="phone" placeholder="Phone (optional)" />
          <Input name="password" type="password" placeholder="Temporary password" required />
          <select name="role" defaultValue="COMPANY_STAFF" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
            {USER_ROLES.map((itemRole) => (
              <option key={itemRole} value={itemRole}>{itemRole}</option>
            ))}
          </select>

          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-neutral-300">Access Permissions</h3>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-white/5 p-3">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="flex items-center gap-2 text-xs text-neutral-400">
                  <input name={`perm_${perm.id}`} type="checkbox" className="h-3.5 w-3.5" />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create User
          </Button>
        </form>
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function StaffRowActions({ role, user }: { role: UserRole | null; user: UserRecord }) {
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

    const formData = new FormData(e.currentTarget)
    const firstName = String(formData.get("firstName") || "")
    const lastName = String(formData.get("lastName") || "")
    const email = String(formData.get("email") || "")
    const phone = String(formData.get("phone") || "")
    const selectedRole = String(formData.get("role") || user.role) as UserRole
    const password = String(formData.get("password") || "")
    const isActive = formData.get("isActive") === "on"

    const selectedPermissions = ALL_PERMISSIONS
      .filter(p => formData.get(`perm_${p.id}`) === "on")
      .map(p => p.id)

    const res = await updateUserAction(role, user.id, {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      role: selectedRole,
      permissions: selectedPermissions,
      password: password || undefined,
      isActive,
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
    if (!confirm(`Delete user ${fullName(user)}?`)) return

    setLoading(true)
    const res = await deleteUserAction(role, user.id)
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
      <Button variant="ghost" size="icon" disabled={loading || !canMutate(role)} onClick={() => setMenuOpen((value) => !value)}>
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
            <SlidePanelTitle>Edit Staff User</SlidePanelTitle>
            <SlidePanelDescription>Update role, profile, and account status.</SlidePanelDescription>
          </SlidePanelHeader>

          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Input name="firstName" defaultValue={user.firstName} required />
            <Input name="lastName" defaultValue={user.lastName} required />
            <Input name="email" type="email" defaultValue={user.email} required />
            <Input name="phone" defaultValue={user.phone || ""} />
            <Input name="password" type="password" placeholder="Leave blank to keep current password" />
            <select name="role" defaultValue={user.role} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              {USER_ROLES.map((itemRole) => (
                <option key={itemRole} value={itemRole}>{itemRole}</option>
              ))}
            </select>

            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-medium text-neutral-300">Access Permissions</h3>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-white/5 p-3">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 text-xs text-neutral-400">
                    <input
                      name={`perm_${perm.id}`}
                      type="checkbox"
                      defaultChecked={user.permissions?.includes(perm.id)}
                      className="h-3.5 w-3.5"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input name="isActive" type="checkbox" defaultChecked={user.isActive} className="h-4 w-4" />
              Account active
            </label>

            <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
