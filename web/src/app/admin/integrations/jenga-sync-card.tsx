"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
    updateCompany, 
    testJengaConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Settings2, 
    Zap,
    CreditCard,
    ShieldCheck,
    Lock
} from "lucide-react";
import { useRouter } from "next/navigation";

interface JengaSyncCardProps {
    company: CompanyRecord;
    token: string;
}

export function JengaSyncCard({ company, token }: JengaSyncCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState({
        jengaMerchantCode: company.jengaMerchantCode || "",
        jengaApiKey: company.jengaApiKey || "",
        jengaConsumerSecret: company.jengaConsumerSecret || "",
        jengaPrivateKey: company.jengaPrivateKey || "",
        jengaEnabled: company.jengaEnabled ?? false,
    });

    const isConnected = !!(company.jengaMerchantCode && company.jengaApiKey && company.jengaEnabled);

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
            const res = await testJengaConnection(token, company.id, formData);
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
                        Equity Bank (Jenga API)
                    </CardTitle>
                    <p className="text-[10px] text-neutral-500 font-medium tracking-wide">Multi-Tenant Financial Hub</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase transition-colors duration-300 ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                        {isConnected ? 'Active' : 'Inactive'}
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
                                <img src="/jenga-logo.png" className="h-8 w-auto object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="Jenga" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                {!formData.jengaMerchantCode && <Zap className="h-6 w-6 text-neutral-700" />}
                            </div>
                            <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-bold text-white">Direct Settlement Protocol</h4>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">
                                    Official Equity Bank gateway for STK Pushes and real-time reconciliation. Funds land directly in your account.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Merchant Code</span>
                                <span className="text-[10px] font-black text-neutral-200 tracking-wider">
                                    {company.jengaMerchantCode || "Not Configured"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isConnected ? 'text-emerald-400' : 'text-red-500'}`}>
                                    {isConnected ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white tracking-tight">Enable Jenga Payments</p>
                                <p className="text-[10px] text-neutral-500">Enable real-time settlement for this company.</p>
                            </div>
                            <Switch 
                                checked={formData.jengaEnabled}
                                onCheckedChange={(val) => setFormData({...formData, jengaEnabled: val})}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Merchant Code</label>
                                <Input 
                                    value={formData.jengaMerchantCode}
                                    onChange={(e) => setFormData({...formData, jengaMerchantCode: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                    placeholder="MER123..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">API Key</label>
                                <Input 
                                    value={formData.jengaApiKey}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, jengaApiKey: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Consumer Secret</label>
                            <Input 
                                value={formData.jengaConsumerSecret}
                                type="password"
                                onChange={(e) => setFormData({...formData, jengaConsumerSecret: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Lock className="h-3 w-3" /> RSA Private Key
                            </label>
                            <Textarea 
                                value={formData.jengaPrivateKey}
                                onChange={(e) => setFormData({...formData, jengaPrivateKey: e.target.value})}
                                className="min-h-[100px] bg-white/5 border-white/10 text-[10px] font-mono focus:ring-emerald-500/50 text-neutral-400"
                                placeholder="-----BEGIN PRIVATE KEY-----..."
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
                                {testStatus === "testing" ? "Authenticating Tunnel..." : testStatus === "success" ? "Protocol Verified" : "Verification Failed"}
                            </p>
                            <p className="opacity-80 leading-relaxed italic">{message || (testStatus === "testing" ? "Requesting Jenga OAuth token..." : "")}</p>
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
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Save"}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={loading || testStatus === "testing"}
                                variant="outline"
                                className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10 font-black text-[10px] uppercase tracking-widest h-10"
                            >
                                <Zap className={`h-3.5 w-3.5 mr-2 ${testStatus === 'testing' ? 'animate-pulse text-emerald-400' : ''}`} />
                                Link Test
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white font-black text-[10px] uppercase tracking-widest h-10 transition-all group"
                            onClick={() => setIsEditing(true)}
                        >
                            Open Protocol Settings
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
