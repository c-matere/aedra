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
import { createDocumentAction, deleteDocumentAction, updateDocumentAction, uploadDocumentFileAction } from "@/lib/actions"
import { FieldSchema, parseForm, parseText } from "@/lib/form-helpers"
import type { DocumentRecord, PropertyRecord } from "@/lib/backend-api"
import type { UserRole } from "@/lib/rbac"

const DOCUMENT_TYPES = [
    "AGREEMENT", "COMPLIANCE", "ID_PROOF", "INVOICE_COPY", "OTHER",
]

type DocumentFormValues = {
    name: string
    type?: string
    description?: string
    propertyId?: string
}

const documentFieldSchema: FieldSchema[] = [
    {
        name: "name",
        required: true,
        parser: parseText,
        errorMessage: "Name is required.",
    },
    { name: "type", required: false, parser: parseText },
    { name: "description", required: false, parser: parseText },
    { name: "propertyId", required: false, parser: parseText },
]

function canMutate(role: UserRole | null) {
    return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "COMPANY_STAFF"
}

export function AddDocumentButton({
    role,
    properties,
}: {
    role: UserRole | null
    properties: PropertyRecord[]
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [values, setValues] = useState<Partial<DocumentFormValues>>({})

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) {
            setError("You do not have permission to add documents.")
            return
        }

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const file = formData.get("file") as File

        const { values, errors } = parseForm<DocumentFormValues>(documentFieldSchema, formData)
        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const { name, type, description, propertyId } = values
        if (!name || !file || file.size === 0) {
            setError("Name and File are required.")
            setLoading(false)
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("File size cannot exceed 10MB.")
            setLoading(false)
            return
        }

        const validTypes = /(pdf|jpeg|png|webp|msword|wordprocessingml|excel|spreadsheetml|csv|plain)/i
        if (!file.type.match(validTypes)) {
            setError("File type is not supported.")
            setLoading(false)
            return
        }

        // 1. Upload the file
        const fileData = new FormData()
        fileData.append("file", file)

        const uploadRes = await uploadDocumentFileAction(role, fileData)
        if (uploadRes.error || !uploadRes.data) {
            setError(`Upload failed: ${uploadRes.error}`)
            setLoading(false)
            return
        }

        // 2. Create the document record
        const res = await createDocumentAction(role, {
            name,
            fileUrl: uploadRes.data.fileUrl,
            type: type || undefined,
            description: description || undefined,
            propertyId: propertyId || undefined,
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
                    Add Document
                </Button>
            </SlidePanelTrigger>
            <SlidePanelContent>
                <SlidePanelHeader>
                    <SlidePanelTitle>Add Document</SlidePanelTitle>
                    <SlidePanelDescription>Upload a file link or document record.</SlidePanelDescription>
                </SlidePanelHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-6">
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <Input name="name" placeholder="Document Name (e.g., Lease Agreement 2024)" required />
                    <Input name="file" type="file" accept=".pdf,.jpeg,.jpg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" required className="file:bg-white/10 file:text-white file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 text-white/70" />
                    <select name="type" defaultValue="" className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                        <option value="">Document Type (optional)</option>
                        {DOCUMENT_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                        ))}
                    </select>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Property</label>
                        <Combobox
                            name="propertyId"
                            options={properties.map((p) => ({ value: p.id, label: p.name }))}
                            value={values.propertyId}
                            onValueChange={(val) => setValues(prev => ({ ...prev, propertyId: val }))}
                            placeholder="Link to property (optional)..."
                        />
                    </div>
                    <Input name="description" placeholder="Description/Notes (optional)" />
                    <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Document
                    </Button>
                </form>
            </SlidePanelContent>
        </SlidePanel>
    )
}

export function DocumentRowActions({
    role,
    document,
    properties,
}: {
    role: UserRole | null
    document: DocumentRecord
    properties: PropertyRecord[]
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<Partial<DocumentFormValues>>({
        propertyId: document.propertyId || ""
    })

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!canMutate(role)) return

        setLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const file = formData.get("file") as File

        const { values, errors } = parseForm<DocumentFormValues>(documentFieldSchema, formData)
        if (errors.length) {
            setError(errors.join(" · "))
            setLoading(false)
            return
        }

        const { name, type, description, propertyId } = values
        if (!name) {
            setError("Name is required.")
            setLoading(false)
            return
        }

        let fileUrl = document.fileUrl

        if (file && file.size > 0) {
            if (file.size > 10 * 1024 * 1024) {
                setError("File size cannot exceed 10MB.")
                setLoading(false)
                return
            }

            const validTypes = /(pdf|jpeg|png|webp|msword|wordprocessingml|excel|spreadsheetml|csv|plain)/i
            if (!file.type.match(validTypes)) {
                setError("File type is not supported.")
                setLoading(false)
                return
            }

            const fileData = new FormData()
            fileData.append("file", file)
            const uploadRes = await uploadDocumentFileAction(role, fileData)

            if (uploadRes.error || !uploadRes.data) {
                setError(`Upload failed: ${uploadRes.error}`)
                setLoading(false)
                return
            }
            fileUrl = uploadRes.data.fileUrl
        }

        const res = await updateDocumentAction(role, document.id, {
            name,
            fileUrl,
            type: type || undefined,
            description: description || undefined,
            propertyId: propertyId || undefined,
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
        if (!confirm(`Delete document "${document.name}"?`)) return

        setLoading(true)
        const res = await deleteDocumentAction(role, document.id)
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
                <div className="absolute right-0 z-50 mt-1 w-32 rounded border border-white/10 bg-neutral-900 shadow-xl overflow-hidden">
                    <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-white" onClick={() => { setMenuOpen(false); setOpen(true) }}>
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
                        <SlidePanelTitle>Edit Document</SlidePanelTitle>
                        <SlidePanelDescription>Update document details.</SlidePanelDescription>
                    </SlidePanelHeader>
                    <form onSubmit={onSubmit} className="space-y-4 py-6">
                        {error ? <p className="text-sm text-red-400">{error}</p> : null}
                        <Input name="name" defaultValue={document.name} required />

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Update File (optional)</label>
                            <Input name="file" type="file" accept=".pdf,.jpeg,.jpg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" className="file:bg-white/10 file:text-white file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 text-white/70" />
                            <p className="text-[10px] text-neutral-500 truncate mt-1">
                                Current: <a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Link</a>
                            </p>
                        </div>
                        <select name="type" defaultValue={document.type ?? ""} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                            <option value="">Document Type (optional)</option>
                            {DOCUMENT_TYPES.map((t) => (
                                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Property</label>
                            <Combobox
                                name="propertyId"
                                options={properties.map((p) => ({ value: p.id, label: p.name }))}
                                value={editValues.propertyId}
                                onValueChange={(val) => setEditValues(prev => ({ ...prev, propertyId: val }))}
                                placeholder="Link to property (optional)..."
                            />
                        </div>
                        <Input name="description" defaultValue={document.description ?? ""} placeholder="Description/Notes (optional)" />
                        <Button type="submit" disabled={loading || !canMutate(role)} className="w-full">
                            Save Changes
                        </Button>
                    </form>
                </SlidePanelContent>
            </SlidePanel>
        </div>
    )
}
