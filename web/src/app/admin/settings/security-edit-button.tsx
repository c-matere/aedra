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
import { Switch } from "@/components/ui/switch";
import { updateCompany, type CompanyRecord } from "@/lib/backend-api";
import { ChevronRight, Loader2, ShieldCheck } from "lucide-react";

interface SecurityEditButtonProps {
    company: CompanyRecord;
    token: string;
}

export function SecurityEditButton({ company, token }: SecurityEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        sessionDurationHours: company.sessionDurationHours ?? 8,
        passwordPolicy: company.passwordPolicy ?? "Min 8 chars + special character",
        twoFactorAuthEnabled: company.twoFactorAuthEnabled ?? false,
        ipAllowlist: company.ipAllowlist || "",
        waOtpEnabled: company.waOtpEnabled ?? true,
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
            alert("Failed to update security settings.");
        } finally {
            setLoading(false);
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
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        Security & Access
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Configure authentication policies and access controls.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Session Duration (Hours)</label>
                        <Input
                            type="number"
                            value={formData.sessionDurationHours}
                            onChange={(e) => setFormData({ ...formData, sessionDurationHours: parseInt(e.target.value) })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Password Policy</label>
                        <Input
                            value={formData.passwordPolicy}
                            onChange={(e) => setFormData({ ...formData, passwordPolicy: e.target.value })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-neutral-300">Two-Factor Authentication</label>
                            <p className="text-xs text-neutral-500">Require 2FA for all staff members.</p>
                        </div>
                        <Switch
                            checked={formData.twoFactorAuthEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, twoFactorAuthEnabled: checked })}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-emerald-400">WhatsApp OTP Login</label>
                            <p className="text-xs text-neutral-500">Allow staff to sign in using WhatsApp codes.</p>
                        </div>
                        <Switch
                            checked={formData.waOtpEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, waOtpEnabled: checked })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">IP Allowlist (Comma separated)</label>
                        <Input
                            value={formData.ipAllowlist}
                            onChange={(e) => setFormData({ ...formData, ipAllowlist: e.target.value })}
                            placeholder="e.g. 192.168.1.1, 10.0.0.1"
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
                        Save Security Settings
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
