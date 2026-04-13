"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    testMpesaConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Settings2, 
    Zap,
    CreditCard,
    ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";

interface MpesaSyncCardProps {
    company: CompanyRecord;
    token: string;
}

export function MpesaSyncCard({ company, token }: MpesaSyncCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState({
        mpesaShortcode: company.mpesaShortcode || "",
        mpesaEnvironment: company.mpesaEnvironment || "sandbox",
        mpesaConsumerKey: company.mpesaConsumerKey || "",
        mpesaConsumerSecret: company.mpesaConsumerSecret || "",
        mpesaPasskey: company.mpesaPasskey || "",
    });

    const isConnected = !!(company.mpesaShortcode && company.mpesaConsumerKey);

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
            const res = await testMpesaConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestStatus("success");
                setMessage(res.data.message);
            } else {
                setTestStatus("error");
                setMessage(res.data?.message || res.error || "Connection test failed");
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
                        <CreditCard className="h-4 w-4 text-emerald-400" />
                        Safaricom M-Pesa
                    </CardTitle>
                    <p className="text-[10px] text-neutral-500 font-medium tracking-wide">Financial Settlement Gateway</p>
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
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center p-2 group-hover:bg-emerald-500/10 transition-colors duration-500">
                            <img 
                                src="/mpesa-logo.png" 
                                className="h-full w-auto object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                                alt="M-Pesa" 
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                        const icon = document.createElement('div');
                                        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card text-emerald-400"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10"/></svg>';
                                        parent.appendChild(icon.firstChild!);
                                    }
                                }}
                            />
                        </div>
                            <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-bold text-white">Lipa Na M-Pesa Online</h4>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">
                                    Direct integration with Daraja API for automated rent collection and instant receipting.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Business Shortcode</span>
                                <span className="text-[10px] font-black text-neutral-200 tracking-wider">
                                    {company.mpesaShortcode ? `********${company.mpesaShortcode.slice(-2)}` : "Not Found"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Environment</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${company.mpesaEnvironment === 'production' ? 'text-blue-400' : 'text-amber-400'}`}>
                                    {company.mpesaEnvironment || "Sandbox"}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Shortcode</label>
                                <Input 
                                    value={formData.mpesaShortcode}
                                    onChange={(e) => setFormData({...formData, mpesaShortcode: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                    placeholder="174379"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Environment</label>
                                <Select
                                    value={formData.mpesaEnvironment}
                                    onValueChange={(val) => setFormData({...formData, mpesaEnvironment: val})}
                                >
                                    <SelectTrigger className="h-9 bg-white/5 border-white/10 text-xs text-neutral-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                        <SelectItem value="sandbox" className="text-xs">Sandbox</SelectItem>
                                        <SelectItem value="production" className="text-xs">Production</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Consumer Key</label>
                            <Input 
                                value={formData.mpesaConsumerKey}
                                type="password"
                                onChange={(e) => setFormData({...formData, mpesaConsumerKey: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Consumer Secret</label>
                            <Input 
                                value={formData.mpesaConsumerSecret}
                                type="password"
                                onChange={(e) => setFormData({...formData, mpesaConsumerSecret: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Passkey</label>
                            <Input 
                                value={formData.mpesaPasskey}
                                type="password"
                                onChange={(e) => setFormData({...formData, mpesaPasskey: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
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
                                {testStatus === "testing" ? "Securing Tunnel..." : testStatus === "success" ? "Verification Successful" : "Bridge Failed"}
                            </p>
                            <p className="opacity-80 leading-relaxed italic">{message || (testStatus === "testing" ? "Authenticating with Safaricom Daraja..." : "")}</p>
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
