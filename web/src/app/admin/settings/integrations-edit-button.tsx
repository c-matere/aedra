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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    updateCompany, 
    type CompanyRecord, 
    testMpesaConnection, 
    testSmsConnection, 
    testMapsConnection 
} from "@/lib/backend-api";
import { ChevronRight, Globe, Loader2, CheckCircle2, XCircle, Activity } from "lucide-react";

interface IntegrationsEditButtonProps {
    company: CompanyRecord;
    token: string;
}

export function IntegrationsEditButton({ company, token }: IntegrationsEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testingMpesa, setTestingMpesa] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testingSms, setTestingSms] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testingMaps, setTestingMaps] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState("");

    const [formData, setFormData] = useState({
        mpesaShortcode: company.mpesaShortcode || "",
        mpesaEnvironment: company.mpesaEnvironment || "sandbox",
        mpesaConsumerKey: company.mpesaConsumerKey || "",
        mpesaConsumerSecret: company.mpesaConsumerSecret || "",
        mpesaPasskey: company.mpesaPasskey || "",
        smsProvider: company.smsProvider ?? "Africa's Talking",
        africaTalkingUsername: company.africaTalkingUsername || "",
        africaTalkingApiKey: company.africaTalkingApiKey || "",
        mapProvider: company.mapProvider ?? "Mapbox GL",
        mapboxAccessToken: company.mapboxAccessToken || "",
        zuriDomain: company.zuriDomain || "https://zuriproperties.co.ke",
        zuriUsername: company.zuriUsername || "",
        zuriPassword: company.zuriPassword || "",
        waAccessToken: company.waAccessToken || "",
        waPhoneNumberId: company.waPhoneNumberId || "",
        waBusinessAccountId: company.waBusinessAccountId || "",
        waVerifyToken: company.waVerifyToken || "",
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
            alert("Failed to update integration settings.");
        } finally {
            setLoading(false);
        }
    };

    const handleTestMpesa = async () => {
        setTestingMpesa("testing");
        setTestMessage("");
        try {
            const res = await testMpesaConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestingMpesa("success");
                setTestMessage(res.data.message);
            } else {
                setTestingMpesa("error");
                setTestMessage(res.data?.message || res.error || "M-Pesa test failed");
            }
        } catch (e) {
            setTestingMpesa("error");
            setTestMessage("Failed to connect to backend");
        }
    };

    const handleTestSms = async () => {
        setTestingSms("testing");
        setTestMessage("");
        try {
            const res = await testSmsConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestingSms("success");
                setTestMessage(res.data.message);
            } else {
                setTestingSms("error");
                setTestMessage(res.data?.message || res.error || "SMS test failed");
            }
        } catch (e) {
            setTestingSms("error");
            setTestMessage("Failed to connect to backend");
        }
    };

    const handleTestMaps = async () => {
        setTestingMaps("testing");
        setTestMessage("");
        try {
            const res = await testMapsConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestingMaps("success");
                setTestMessage(res.data.message);
            } else {
                setTestingMaps("error");
                setTestMessage(res.data?.message || res.error || "Map test failed");
            }
        } catch (e) {
            setTestingMaps("error");
            setTestMessage("Failed to connect to backend");
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
            <DialogContent className="sm:max-w-[550px] bg-neutral-900 border-white/10 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-400" />
                        API & Integrations
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Manage third-party service connections and API settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {/* M-Pesa Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">M-Pesa (Daraja API)</h4>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleTestMpesa}
                                disabled={testingMpesa === "testing"}
                                className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                            >
                                {testingMpesa === "testing" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                                Test M-Pesa
                            </Button>
                        </div>
                        {testingMpesa !== "idle" && (
                            <div className={`text-xs p-2 rounded flex items-center gap-2 ${testingMpesa === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                {testingMpesa === "success" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {testMessage}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Shortcode</label>
                                <Input
                                    value={formData.mpesaShortcode}
                                    onChange={(e) => setFormData({ ...formData, mpesaShortcode: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                    placeholder="174379"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Environment</label>
                                <Select
                                    value={formData.mpesaEnvironment}
                                    onValueChange={(val) => setFormData({ ...formData, mpesaEnvironment: val })}
                                >
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select env" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-white/10 text-white">
                                        <SelectItem value="sandbox">Sandbox</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Consumer Key</label>
                            <Input
                                type="password"
                                value={formData.mpesaConsumerKey}
                                onChange={(e) => setFormData({ ...formData, mpesaConsumerKey: e.target.value })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Consumer Secret</label>
                            <Input
                                type="password"
                                value={formData.mpesaConsumerSecret}
                                onChange={(e) => setFormData({ ...formData, mpesaConsumerSecret: e.target.value })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Passkey (Lipa na M-Pesa Online)</label>
                            <Input
                                type="password"
                                value={formData.mpesaPasskey}
                                onChange={(e) => setFormData({ ...formData, mpesaPasskey: e.target.value })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* SMS Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">SMS Service</h4>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleTestSms}
                                disabled={testingSms === "testing"}
                                className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                            >
                                {testingSms === "testing" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                                Test SMS
                            </Button>
                        </div>
                        {testingSms !== "idle" && (
                            <div className={`text-xs p-2 rounded flex items-center gap-2 ${testingSms === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                {testingSms === "success" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {testMessage}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Provider</label>
                            <Select
                                value={formData.smsProvider}
                                onValueChange={(val) => setFormData({ ...formData, smsProvider: val })}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-800 border-white/10 text-white">
                                    <SelectItem value="Africa's Talking">Africa's Talking</SelectItem>
                                    <SelectItem value="Twilio">Twilio</SelectItem>
                                    <SelectItem value="Infobip">Infobip</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.smsProvider === "Africa's Talking" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-300">AT Username</label>
                                    <Input
                                        value={formData.africaTalkingUsername}
                                        onChange={(e) => setFormData({ ...formData, africaTalkingUsername: e.target.value })}
                                        className="bg-white/5 border-white/10"
                                        placeholder="sandbox"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-300">AT API Key</label>
                                    <Input
                                        type="password"
                                        value={formData.africaTalkingApiKey}
                                        onChange={(e) => setFormData({ ...formData, africaTalkingApiKey: e.target.value })}
                                        className="bg-white/5 border-white/10"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Maps Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Map Service</h4>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleTestMaps}
                                disabled={testingMaps === "testing"}
                                className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                            >
                                {testingMaps === "testing" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                                Test Maps
                            </Button>
                        </div>
                        {testingMaps !== "idle" && (
                            <div className={`text-xs p-2 rounded flex items-center gap-2 ${testingMaps === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                {testingMaps === "success" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {testMessage}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Provider</label>
                            <Select
                                value={formData.mapProvider}
                                onValueChange={(val) => setFormData({ ...formData, mapProvider: val })}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-800 border-white/10 text-white">
                                    <SelectItem value="Mapbox GL">Mapbox GL</SelectItem>
                                    <SelectItem value="Google Maps">Google Maps</SelectItem>
                                    <SelectItem value="Leaflet (OSM)">Leaflet (OSM)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.mapProvider === "Mapbox GL" && (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Mapbox Access Token</label>
                                <Input
                                    type="password"
                                    value={formData.mapboxAccessToken}
                                    onChange={(e) => setFormData({ ...formData, mapboxAccessToken: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Zuri Lease Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Historical Data (Zuri Lease)</h4>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Zuri Domain</label>
                            <Input
                                value={formData.zuriDomain}
                                onChange={(e) => setFormData({ ...formData, zuriDomain: e.target.value })}
                                className="bg-white/5 border-white/10"
                                placeholder="https://zuriproperties.co.ke"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Zuri Username</label>
                                <Input
                                    value={formData.zuriUsername}
                                    onChange={(e) => setFormData({ ...formData, zuriUsername: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Zuri Password</label>
                                <Input
                                    type="password"
                                    value={formData.zuriPassword}
                                    onChange={(e) => setFormData({ ...formData, zuriPassword: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* WhatsApp Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-black underline underline-offset-4 decoration-emerald-500/30">WhatsApp (Meta Cloud API)</h4>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Access Token (Permanent)</label>
                            <Input
                                type="password"
                                value={formData.waAccessToken}
                                onChange={(e) => setFormData({ ...formData, waAccessToken: e.target.value })}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Phone Number ID</label>
                                <Input
                                    value={formData.waPhoneNumberId}
                                    onChange={(e) => setFormData({ ...formData, waPhoneNumberId: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-300">Business Account ID</label>
                                <Input
                                    value={formData.waBusinessAccountId}
                                    onChange={(e) => setFormData({ ...formData, waBusinessAccountId: e.target.value })}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-300">Webhook Verify Token</label>
                            <Input
                                value={formData.waVerifyToken}
                                onChange={(e) => setFormData({ ...formData, waVerifyToken: e.target.value })}
                                className="bg-white/5 border-white/10"
                                placeholder="Any string for meta verification"
                            />
                        </div>
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
                        Save Integrations
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
