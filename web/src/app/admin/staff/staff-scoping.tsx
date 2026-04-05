"use client"

import { useState, useEffect } from "react"
import { Loader2, Building, Check, Search } from "lucide-react"
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
import { listPropertiesAction, listStaffAssignmentsAction, setBulkStaffAssignmentsAction } from "@/lib/actions"
import type { UserRecord, PropertyRecord } from "@/lib/backend-api"

export function StaffPropertyScoping({ 
  user, 
  variant = "button",
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: { 
  user: UserRecord; 
  variant?: "button" | "menu-item";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [properties, setProperties] = useState<PropertyRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [propsRes, assignsRes] = await Promise.all([
        listPropertiesAction(user.role as any, { limit: 100 }),
        listStaffAssignmentsAction(user.id)
      ])

      if (propsRes.error) {
        setError(`Failed to load properties: ${propsRes.error}`)
      } else if (propsRes.data) {
        setProperties(propsRes.data.data)
      }

      if (assignsRes.error) {
        setError(`Failed to load assignments: ${assignsRes.error}`)
      } else if (assignsRes.data) {
        setSelectedIds(assignsRes.data.map(a => a.propertyId))
      }
    } catch (e) {
      setError("An unexpected error occurred while loading data.")
      console.error("Failed to load scoping data", e)
    } finally {
      setLoading(false)
    }
  }

  async function onSave() {
    setSaving(true)
    try {
      const res = await setBulkStaffAssignmentsAction(user.id, selectedIds)
      if (res.error) {
        alert(res.error)
      } else {
        setOpen(false)
      }
    } catch (e) {
      alert("Failed to save assignments")
    } finally {
      setSaving(false)
    }
  }

  const toggleProperty = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const filteredProperties = properties.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      {variant === "button" ? (
        <SlidePanelTrigger asChild>
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
            <Building className="mr-2 h-4 w-4" /> Scope Properties
          </Button>
        </SlidePanelTrigger>
      ) : null}
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>Property Scoping</SlidePanelTitle>
          <SlidePanelDescription>
            Restrict {user.firstName}'s access to specific properties. 
            If no properties are selected, they will have global access (default for admins).
          </SlidePanelDescription>
        </SlidePanelHeader>

        <div className="space-y-4 py-6 flex flex-col h-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input 
              placeholder="Search properties..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-neutral-900 border-neutral-800"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <p className="text-sm text-red-400">{error}</p>
                <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
              </div>
            ) : filteredProperties.length > 0 ? (
              filteredProperties.map((prop) => {
                const isSelected = selectedIds.includes(prop.id)
                return (
                  <div 
                    key={prop.id}
                    onClick={() => toggleProperty(prop.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                        : "border-white/5 bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{prop.name}</p>
                      <p className="text-xs text-neutral-400">{prop.address || "No address"}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                  </div>
                )
              })
            ) : (
              <p className="text-center py-10 text-sm text-neutral-500">No properties found.</p>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-neutral-400">
              {selectedIds.length} propert{selectedIds.length === 1 ? 'y' : 'ies'} selected
            </p>
            <Button 
              onClick={onSave} 
              disabled={saving || loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Assignments
            </Button>
          </div>
        </div>
      </SlidePanelContent>
    </SlidePanel>
  )
}
