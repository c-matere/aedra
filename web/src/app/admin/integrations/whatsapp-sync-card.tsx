"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    updateCompany, 
    testWhatsAppConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Settings2, 
    Zap,
    MessageSquare,
    ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";

interface WhatsAppSyncCardProps {
    company: CompanyRecord;
    token: string;
}

export function WhatsAppSyncCard({ company, token }: WhatsAppSyncCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState({
        waAccessToken: company.waAccessToken || "",
        waPhoneNumberId: company.waPhoneNumberId || "",
        waBusinessAccountId: company.waBusinessAccountId || "",
        waVerifyToken: company.waVerifyToken || "",
    });

    const isConnected = !!(company.waAccessToken && company.waPhoneNumberId);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await updateCompany(token, company.id, formData);
            if (res.error) {
                setTestStatus("error");
                setMessage(res.error);
            } else {
                setIsEditing(false);
                setTestStatus("idle");
                router.refresh();
            }
        } catch (err) {
            setTestStatus("error");
            setMessage("Failed to update configuration.");
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setTestStatus("testing");
        setMessage("");
        try {
            const res = await testWhatsAppConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestStatus("success");
                setMessage(res.data.message);
            } else {
                setTestStatus("error");
                setMessage(res.data?.message || res.error || "Meta connection test failed");
            }
        } catch (e) {
            setTestStatus("error");
            setMessage("Failed to reach testing service.");
        }
    };

    return (
        <Card className="bg-neutral-900 border-white/10 overflow-hidden group transition-all duration-500 hover:border-emerald-500/30">
            <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.01] flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-black text-white flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-emerald-400" />
                        WhatsApp (Meta Cloud API)
                    </CardTitle>
                    <p className="text-[10px] text-neutral-500 font-medium tracking-wide">Messaging & Alert Protocol</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase transition-colors duration-300 ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        <Settings2 className={`h-3.5 w-3.5 transition-transform duration-500 ${isEditing ? 'rotate-90 text-emerald-400' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {!isEditing ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center p-2 group-hover:bg-emerald-500/10 transition-colors duration-500 text-emerald-400">
                                <MessageSquare className="h-8 w-8" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-bold text-white">Meta Cloud API</h4>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">
                                    Send automated rent alerts, OTPs, and payment confirmations directly to tenants via WhatsApp.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Phone Number ID</span>
                                <span className="text-[10px] font-black text-neutral-200 tracking-wider">
                                    {company.waPhoneNumberId ? company.waPhoneNumberId : "Not Set"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Access Token</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isConnected ? 'text-emerald-400' : 'text-neutral-600'}`}>
                                    {isConnected ? "Configured" : "Missing"}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Permanent Access Token</label>
                            <Input 
                                value={formData.waAccessToken}
                                type="password"
                                onChange={(e) => setFormData({...formData, waAccessToken: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                placeholder="EAAB..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Phone Number ID</label>
                                <Input 
                                    value={formData.waPhoneNumberId}
                                    onChange={(e) => setFormData({...formData, waPhoneNumberId: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Business Account ID</label>
                                <Input 
                                    value={formData.waBusinessAccountId}
                                    onChange={(e) => setFormData({...formData, waBusinessAccountId: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Webhook Verify Token</label>
                            <Input 
                                value={formData.waVerifyToken}
                                onChange={(e) => setFormData({...formData, waVerifyToken: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                placeholder="For Meta Webhook verification"
                            />
                        </div>
                    </div>
                )}

                {testStatus !== "idle" && (
                    <div className={`p-4 rounded-2xl flex items-start gap-3 text-[11px] font-medium animate-in zoom-in-95 duration-300 ${testStatus === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : testStatus === "testing" ? "bg-white/5 text-neutral-300 border border-white/10" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                        {testStatus === "testing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                        ) : testStatus === "success" ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div className="flex-1">
                            <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">
                                {testStatus === "testing" ? "Verifying Token..." : testStatus === "success" ? "Meta Verified" : "Verification Failed"}
                            </p>
                            <p className="opacity-80 leading-relaxed italic">{message || (testStatus === "testing" ? "Connecting to Meta Graph API..." : "")}</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 bg-white text-black hover:bg-neutral-200 font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-white/5"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit Changes"}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={loading || testStatus === "testing"}
                                variant="outline"
                                className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10 font-black text-[10px] uppercase tracking-widest h-10"
                            >
                                <Zap className={`h-3.5 w-3.5 mr-2 ${testStatus === 'testing' ? 'animate-pulse text-emerald-400' : ''}`} />
                                Live Test
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white font-black text-[10px] uppercase tracking-widest h-10 transition-all group"
                            onClick={() => setIsEditing(true)}
                        >
                            Configure Protocol
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
