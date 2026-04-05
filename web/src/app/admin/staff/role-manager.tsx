"use client"

import { useState, useEffect } from "react"
import { Loader2, Shield, Plus, Pencil, Trash2, Check, X } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import { listRolesAction, createRoleAction, updateRoleAction, deleteRoleAction } from "@/lib/actions"
import type { RoleRecord } from "@/lib/backend-api"

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

export function RoleManager() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [editingRole, setEditingRole] = useState<Partial<RoleRecord> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadRoles()
    }
  }, [open])

  async function loadRoles() {
    setLoading(true)
    try {
      const res = await listRolesAction()
      if (res.data) {
        setRoles(res.data)
      }
    } catch (e) {
      console.error("Failed to load roles", e)
    } finally {
      setLoading(false)
    }
  }

  async function onSave() {
    if (!editingRole?.name) return
    setSaving(true)
    try {
      if (editingRole.id) {
        await updateRoleAction(editingRole.id, {
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions
        })
      } else {
        await createRoleAction({
          name: editingRole.name,
          description: editingRole.description || "",
          permissions: editingRole.permissions || []
        })
      }
      setEditingRole(null)
      loadRoles()
    } catch (e) {
      alert("Failed to save role")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this role? Users assigned to it will lose their custom permissions.")) return
    try {
      await deleteRoleAction(id)
      loadRoles()
    } catch (e) {
      alert("Failed to delete role")
    }
  }

  const togglePermission = (permId: string) => {
    setEditingRole(prev => {
      if (!prev) return null
      const perms = prev.permissions || []
      const nextPerms = perms.includes(permId) 
        ? perms.filter(p => p !== permId) 
        : [...perms, permId]
      return { ...prev, permissions: nextPerms }
    })
  }

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>
        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
          <Shield className="mr-2 h-4 w-4" /> Manage Roles
        </Button>
      </SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Role Management</SlidePanelTitle>
          <SlidePanelDescription>
            Define custom roles and capability sets for your company.
          </SlidePanelDescription>
        </SlidePanelHeader>

        <div className="space-y-6 py-6 h-full flex flex-col">
          {!editingRole ? (
            <>
              <Button 
                onClick={() => setEditingRole({ name: "", permissions: [] })}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                <Plus className="mr-2 h-4 w-4" /> Create New Role
              </Button>

              <div className="flex-1 overflow-y-auto space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                  </div>
                ) : roles.length > 0 ? (
                  roles.map((role) => (
                    <Card key={role.id} className="border-white/5 bg-white/5">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{role.name}</p>
                          <p className="text-xs text-neutral-400">{role.permissions.length} permissions</p>
                        </div>
                        {!role.isSystem && (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditingRole(role)}>
                              <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => onDelete(role.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        )}
                        {role.isSystem && (
                          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-neutral-400 uppercase font-black">System</span>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center py-10 text-sm text-neutral-500">No custom roles defined.</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingRole.id ? "Edit Role" : "New Role"}
                </h3>
                <Button size="icon" variant="ghost" onClick={() => setEditingRole(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <Input 
                  placeholder="Role Name (e.g. Accountant)" 
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
                <Input 
                  placeholder="Description (optional)" 
                  value={editingRole.description || ""}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                <p className="text-xs font-bold text-neutral-500 uppercase">Permissions</p>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isSelected = editingRole.permissions?.includes(perm.id)
                    return (
                      <div 
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                          isSelected 
                            ? "border-emerald-500/50 bg-emerald-500/10" 
                            : "border-white/5 bg-white/5 hover:border-white/10"
                        }`}
                      >
                        <span className="text-sm text-white">{perm.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button 
                onClick={onSave} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold"
                disabled={saving || !editingRole.name}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Role
              </Button>
            </div>
          )}
        </div>
      </SlidePanelContent>
    </SlidePanel>
  )
}
