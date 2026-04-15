"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Share2, Copy, Check, Building } from "lucide-react"

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
import { createUserAction, deleteUserAction, updateUserAction, createInvitationAction } from "@/lib/actions"
import type { UserRecord, RoleRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"
import { getWhatsAppInviteLink } from "@/lib/whatsapp"
import { StaffPropertyScoping } from "./staff-scoping"

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

export function AddStaffButton({ role, customRoles }: { role: UserRole | null; customRoles: RoleRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canMutate(role)) {
      setError("You do not have permission to invite staff.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const firstName = String(formData.get("firstName") || "")
    const lastName = String(formData.get("lastName") || "")
    const email = String(formData.get("email") || "")
    const roleValue = String(formData.get("role") || "COMPANY_STAFF")
    
    let selectedRole = "COMPANY_STAFF" as UserRole
    let roleId = undefined

    if (USER_ROLES.includes(roleValue as any)) {
      selectedRole = roleValue as UserRole
    } else {
      roleId = roleValue
    }

    const res = await createInvitationAction({
      email,
      firstName,
      firstName,
      lastName,
      role: selectedRole,
      roleId,
    })

    if (res.error) {
      setError(res.error)
    } else if (res.data) {
      setInviteToken(res.data.token)
    }

    setLoading(false)
  }

  const copyToClipboard = () => {
    if (!inviteToken) return
    const baseUrl = window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/invite/${inviteToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SlidePanel open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) {
        setInviteToken(null)
        router.refresh()
      }
    }}>
      <SlidePanelTrigger asChild>
        <Button variant="glass" disabled={!canMutate(role)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite Staff
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Invite Staff Member</SlidePanelTitle>
          <SlidePanelDescription>Send an invitation link via WhatsApp or copy it manually.</SlidePanelDescription>
        </SlidePanelHeader>

        {!inviteToken ? (
          <form onSubmit={onSubmit} className="space-y-4 py-6">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-400 uppercase font-bold">First Name</label>
                <Input name="firstName" placeholder="John" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-neutral-400 uppercase font-bold">Last Name</label>
                <Input name="lastName" placeholder="Doe" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-400 uppercase font-bold">Email Address</label>
              <Input name="email" type="email" placeholder="staff@example.com" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-400 uppercase font-bold">Role</label>
              <select name="role" defaultValue="COMPANY_STAFF" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20">
                <optgroup label="System Roles" className="bg-neutral-900">
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="COMPANY_STAFF">Company Staff</option>
                </optgroup>
                {customRoles.length > 0 && (
                  <optgroup label="Custom Roles" className="bg-neutral-900">
                    {customRoles.map((cr) => (
                      <option key={cr.id} value={cr.id}>{cr.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <Button
              type="submit"
              variant="default"
              disabled={loading || !canMutate(role)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black mt-4 shadow-lg border-none transition-all duration-300"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Invitation
            </Button>
          </form>
        ) : (
          <div className="space-y-6 py-8 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Share2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">Invitation Generated!</h3>
              <p className="text-sm text-neutral-400">The invitation link is ready. You can now share it via WhatsApp.</p>
            </div>

            <div className="w-full space-y-3">
              <Button
                className="w-full bg-[#25D366] text-white hover:bg-[#22c35e]"
                onClick={() => {
                  const link = getWhatsAppInviteLink("", "Aedra", inviteToken)
                  window.open(link, "_blank")
                }}
              >
                Send via WhatsApp
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/5"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>

            <Button variant="ghost" className="text-neutral-500 text-xs" onClick={() => setInviteToken(null)}>
              Invite another person
            </Button>
          </div>
        )}
      </SlidePanelContent>
    </SlidePanel>
  )
}

export function StaffRowActions({ role, user, customRoles }: { role: UserRole | null; user: UserRecord; customRoles: RoleRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopingOpen, setScopingOpen] = useState(false)

  const isProtected = user.role === "COMPANY_ADMIN" && role !== "SUPER_ADMIN"
  const canModify = canMutate(role) && !isProtected

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
    const roleValue = String(formData.get("role") || user.role)
    const password = String(formData.get("password") || "")
    const isActive = formData.get("isActive") === "on"

    let selectedRole = (USER_ROLES.includes(roleValue as any) ? roleValue : "COMPANY_STAFF") as UserRole
    let roleId = USER_ROLES.includes(roleValue as any) ? undefined : roleValue

    const selectedPermissions = ALL_PERMISSIONS
      .filter(p => formData.get(`perm_${p.id}`) === "on")
      .map(p => p.id)

    const res = await updateUserAction(role, user.id, {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      role: selectedRole,
      roleId,
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
      <Button variant="ghost" size="icon" disabled={loading || !canModify} onClick={() => setMenuOpen((value) => !value)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4 font-bold" />}
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 z-50 mt-1 w-32 rounded border border-white/10 bg-neutral-900 shadow-xl overflow-hidden">
          <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center" onClick={() => { setMenuOpen(false); setOpen(true) }}>
            <Pencil className="mr-2 inline h-3.5 w-3.5" /> Edit Profile
          </button>
          
          <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center" onClick={() => { setMenuOpen(false); setScopingOpen(true) }}>
            <Building className="mr-2 h-3.5 w-3.5" /> Scope Properties
          </button>

          <button className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center" onClick={onDelete}>
            <Trash2 className="mr-2 inline h-3.5 w-3.5" /> Delete
          </button>
        </div>
      ) : null}

      <StaffPropertyScoping 
        user={user} 
        open={scopingOpen} 
        onOpenChange={setScopingOpen} 
      />

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
            <select name="role" defaultValue={user.roleId || user.role} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
              <optgroup label="System Roles" className="bg-neutral-900">
                {USER_ROLES.map((itemRole) => (
                  <option key={itemRole} value={itemRole}>{itemRole}</option>
                ))}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Custom Roles" className="bg-neutral-900">
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>{cr.name}</option>
                  ))}
                </optgroup>
              )}
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

            <Button type="submit" disabled={loading || !canModify} className="w-full">
              Save Changes
            </Button>
          </form>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  )
}
