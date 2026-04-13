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
        <Card className="bg-white/[0.02] backdrop-blur-3xl border-white/5 overflow-hidden group transition-all duration-700 hover:border-emerald-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative rounded-[2.5rem] flex flex-col h-full">
            {/* Header / Head Section */}
            <div className="p-8 pb-4 relative flex items-center justify-center min-h-[140px]">
                <div className={`absolute top-4 right-6 px-3 py-1 rounded-full border ${isConnected ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-white/10 bg-white/5 text-neutral-500'} text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500`}>
                    {isConnected ? 'Active' : 'Offline'}
                </div>
                
                <div className="relative group/logo">
                    <div className="h-20 w-20 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:bg-emerald-500/10 shadow-inner">
                        <MessageSquare className="h-10 w-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" />
                    </div>
                    {isConnected && (
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-[3px] border-[#0a0a0a] animate-pulse" />
                    )}
                </div>
            </div>

            {/* Body Section */}
            <CardContent className="px-10 pb-10 flex-1 flex flex-col text-center">
                {!isEditing ? (
                    <div className="space-y-4 flex-1">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors duration-500">
                                WhatsApp Business
                            </h3>
                            <p className="text-[11px] font-black text-emerald-500/60 uppercase tracking-[0.15em]">
                                Messaging Automation
                            </p>
                        </div>
                        
                        <p className="text-sm text-neutral-500 leading-relaxed font-medium px-4">
                            Official Meta gateway for automated rent alerts, OTP confirmations, and real-time maintenance sync.
                        </p>

                        <div className="pt-6">
                            <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-2xl border-white/5 bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/10 hover:border-emerald-500/30 font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95 group/btn"
                                onClick={() => setIsEditing(true)}
                            >
                                <Settings2 className="h-4 w-4 mr-2 group-hover/btn:rotate-90 transition-transform duration-500" />
                                Configure Protocol
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Access Token</label>
                                <Input 
                                    value={formData.waAccessToken}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, waAccessToken: e.target.value})}
                                    className="h-11 bg-white/5 border-white/10 text-sm focus:ring-emerald-500/30 rounded-xl"
                                    placeholder="EAAB..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Phone ID</label>
                                    <Input 
                                        value={formData.waPhoneNumberId}
                                        onChange={(e) => setFormData({...formData, waPhoneNumberId: e.target.value})}
                                        className="h-11 bg-white/5 border-white/10 text-sm focus:ring-emerald-500/30 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Account ID</label>
                                    <Input 
                                        value={formData.waBusinessAccountId}
                                        onChange={(e) => setFormData({...formData, waBusinessAccountId: e.target.value})}
                                        className="h-11 bg-white/5 border-white/10 text-sm focus:ring-emerald-500/30 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {testStatus !== "idle" && (
                            <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-medium animate-in zoom-in-95 duration-500 ${testStatus === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : testStatus === "testing" ? "bg-white/5 text-neutral-300 border border-white/10" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                                {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : testStatus === "success" ? <ShieldCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <div className="flex-1">
                                    <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">{testStatus.toUpperCase()}</p>
                                    <p className="opacity-80 italic">{message || "Processing..."}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={handleSave} 
                                disabled={loading}
                                className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bind Keys"}
                            </Button>
                            <Button 
                                onClick={handleTest} 
                                disabled={loading || testStatus === "testing"}
                                variant="outline"
                                className="h-12 w-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Zap className={`h-5 w-5 ${testStatus === 'testing' ? 'animate-pulse text-emerald-400' : ''}`} />
                            </Button>
                            <Button 
                                onClick={() => setIsEditing(false)}
                                variant="ghost"
                                className="h-12 w-12 rounded-2xl text-neutral-500 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                            >
                                <AlertCircle className="rotate-45 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
