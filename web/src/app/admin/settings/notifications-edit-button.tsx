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
import { Bell, ChevronRight, Loader2 } from "lucide-react";

interface NotificationsEditButtonProps {
    company: CompanyRecord;
    token: string;
}

export function NotificationsEditButton({ company, token }: NotificationsEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        rentReminderDaysBefore: company.rentReminderDaysBefore ?? 3,
        leaseExpiryAlertDaysBefore: company.leaseExpiryAlertDaysBefore ?? 90,
        paymentReceiptsEnabled: company.paymentReceiptsEnabled ?? false,
        maintenanceUpdatesEnabled: company.maintenanceUpdatesEnabled ?? false,
        waAlertsEnabled: company.waAlertsEnabled ?? true,
        waPaymentConfirmationsEnabled: company.waPaymentConfirmationsEnabled ?? true,
        waInvoiceNotificationsEnabled: company.waInvoiceNotificationsEnabled ?? true,
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
            alert("Failed to update notification settings.");
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
                        <Bell className="h-5 w-5 text-amber-400" />
                        Notifications
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Configure email and SMS alert preferences.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Rent Reminders (Days before due)</label>
                        <Input
                            type="number"
                            value={formData.rentReminderDaysBefore}
                            onChange={(e) => setFormData({ ...formData, rentReminderDaysBefore: parseInt(e.target.value) })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Lease Expiry Alert (Days before expiry)</label>
                        <Input
                            type="number"
                            value={formData.leaseExpiryAlertDaysBefore}
                            onChange={(e) => setFormData({ ...formData, leaseExpiryAlertDaysBefore: parseInt(e.target.value) })}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-neutral-300">Payment Receipts</label>
                            <p className="text-xs text-neutral-500">Automatically send receipts to tenants.</p>
                        </div>
                        <Switch
                            checked={formData.paymentReceiptsEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, paymentReceiptsEnabled: checked })}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-neutral-300">Maintenance Updates</label>
                            <p className="text-xs text-neutral-500">Notify tenants on work order progress.</p>
                        </div>
                        <Switch
                            checked={formData.maintenanceUpdatesEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, maintenanceUpdatesEnabled: checked })}
                        />
                    </div>
                    <div className="h-px bg-white/5 my-2" />
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-emerald-400">WhatsApp Alerts</label>
                            <p className="text-xs text-neutral-500">Send property & rent alerts via WhatsApp.</p>
                        </div>
                        <Switch
                            checked={formData.waAlertsEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, waAlertsEnabled: checked })}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-emerald-400">WhatsApp Receipts</label>
                            <p className="text-xs text-neutral-500">Send payment confirmations via WhatsApp.</p>
                        </div>
                        <Switch
                            checked={formData.waPaymentConfirmationsEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, waPaymentConfirmationsEnabled: checked })}
                        />
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-emerald-400">WhatsApp Invoices</label>
                            <p className="text-xs text-neutral-500">Notify tenants when invoices are created.</p>
                        </div>
                        <Switch
                            checked={formData.waInvoiceNotificationsEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, waInvoiceNotificationsEnabled: checked })}
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
                        Save Preferences
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
