"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { UnitRowActions } from "./unit-actions"
import type { PropertyRecord, UnitRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

export function UnitsList({
    units,
    properties,
    role,
}: {
    units: UnitRecord[]
    properties: PropertyRecord[]
    role: UserRole | null
}) {
    const grouped = useMemo(() => {
        const groups: Record<string, UnitRecord[]> = {}
        for (const u of units) {
            const pName = u.property?.name || "Unassigned"
            if (!groups[pName]) groups[pName] = []
            groups[pName].push(u)
        }
        return groups
    }, [units])

    return (
        <div className="space-y-6">
            {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([propertyName, groupUnits]) => (
                    <div key={propertyName} className="space-y-2">
                        <h3 className="text-sm font-semibold text-neutral-200 px-1 border-b border-white/10 pb-2 mb-3">
                            {propertyName}
                        </h3>
                        <div className="space-y-2">
                            {groupUnits.map((unit) => (
                                <div key={unit.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3 group hover:bg-white/10 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            Unit {unit.unitNumber}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {unit.rentAmount ? `KSH ${unit.rentAmount.toLocaleString()}` : "No rent set"}
                                        </p>
                                    </div>
                                    <UnitRowActions role={role} unit={unit} properties={properties} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

            {units.length === 0 && (
                <div className="py-8 text-center text-neutral-400 border border-dashed border-white/10 rounded-lg">
                    <p>No units found.</p>
                </div>
            )}
        </div>
    )
}
