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
import { ChevronRight, CreditCard, Loader2 } from "lucide-react";

interface BillingEditButtonProps {
    company: CompanyRecord;
    token: string;
}

export function BillingEditButton({ company, token }: BillingEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        autoInvoicingEnabled: company.autoInvoicingEnabled ?? false,
        invoicingDay: company.invoicingDay ?? 1,
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
            alert("Failed to update billing settings.");
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
                        <CreditCard className="h-5 w-5 text-indigo-400" />
                        Billing & Invoicing
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Manage automatic invoicing and billing cycles.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-neutral-300">Automatic Invoicing</label>
                            <p className="text-xs text-neutral-500">Automatically generate rent invoices.</p>
                        </div>
                        <Switch
                            checked={formData.autoInvoicingEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, autoInvoicingEnabled: checked })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Invoicing Day of Month</label>
                        <Input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.invoicingDay}
                            onChange={(e) => setFormData({ ...formData, invoicingDay: parseInt(e.target.value) })}
                            className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-neutral-500">The day of the month on which invoices are generated (1-28 for best compatibility).</p>
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
                        Save Billing Settings
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
