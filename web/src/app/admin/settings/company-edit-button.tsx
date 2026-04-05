"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateCompany, type CompanyRecord, backendBaseUrl, getLogoUrl } from "@/lib/backend-api";
import { ChevronRight, Loader2, Upload, X, Building2 } from "lucide-react";
import Image from "next/image";

interface CompanyEditButtonProps {
    company: CompanyRecord;
    token: string;
}

export function CompanyEditButton({ company, token }: CompanyEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(company.logo || null);
    const [formData, setFormData] = useState({
        name: company.name || "",
        email: company.email || "",
        phone: company.phone || "",
        address: company.address || "",
    });
    const router = useRouter();

    const handleUpdate = async () => {
        setLoading(true);
        try {
            const result = await updateCompany(token, company.id, formData);
            if (result.error) {
                alert(result.error);
            } else {
                setOpen(false);
                router.refresh();
            }
        } catch (err) {
            alert("Failed to update company profile.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${backendBaseUrl()}/companies/${company.id}/logo`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                setLogoPreview(result.logo);
                router.refresh();
            } else {
                const err = await response.json();
                alert(err.message || "Failed to upload logo.");
            }
        } catch (err) {
            alert("Network error while uploading logo.");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveLogo = async () => {
        setUploading(true);
        try {
            const response = await fetch(`${backendBaseUrl()}/companies/${company.id}/logo`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setLogoPreview(null);
                router.refresh();
            } else {
                alert("Failed to remove logo.");
            }
        } catch (err) {
            alert("Network error while removing logo.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs text-neutral-400"
                >
                    Edit <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Company Profile</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Make changes to your company profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                            <Building2 className="h-4 w-4" /> Company Branding
                        </label>
                        <div className="flex items-center gap-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="relative group/logo">
                                <div className="h-20 w-20 rounded-xl bg-neutral-950 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover/logo:border-emerald-500/50">
                                    {logoPreview ? (
                                        <img
                                            src={getLogoUrl(logoPreview) || ""}
                                            alt="Logo"
                                            className="h-full w-full object-contain p-2"
                                        />
                                    ) : (
                                        <Building2 className="h-10 w-10 text-neutral-800" />
                                    )}
                                </div>
                                {logoPreview && !uploading && (
                                    <button
                                        onClick={handleRemoveLogo}
                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-10"
                                        title="Remove Logo"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center z-20">
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="block w-full">
                                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/10">
                                        <Upload className="h-4 w-4" />
                                        {logoPreview ? "Change Logo" : "Upload Logo"}
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        disabled={uploading}
                                    />
                                </label>
                                <p className="text-[10px] text-neutral-500 font-medium leading-tight">
                                    Professional documents look best with a high-res SVG or PNG (Transparent). Max 2MB.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Company Name</label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Support Email</label>
                        <Input
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Support Phone</label>
                        <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Address</label>
                        <Input
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="submit"
                        variant="default"
                        onClick={handleUpdate}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg border-none transition-all duration-300"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
