"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    triggerZuriSync, 
    updateCompany,
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    ExternalLink,
    Settings2,
    Database,
    Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

interface ZuriSyncCardProps {
    company: CompanyRecord;
    token: string;
}

export function ZuriSyncCard({ company, token }: ZuriSyncCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState({
        zuriDomain: company.zuriDomain || "https://zuriproperties.co.ke",
        zuriUsername: company.zuriUsername || "",
        zuriPassword: company.zuriPassword || "",
    });

    const isConfigured = !!(company.zuriUsername && company.zuriPassword);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await updateCompany(token, company.id, formData);
            if (res.error) {
                setStatus("error");
                setMessage(res.error);
            } else {
                setIsEditing(false);
                setStatus("idle");
                router.refresh();
            }
        } catch (err) {
            setStatus("error");
            setMessage("Failed to update credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setLoading(true);
        setStatus("idle");
        setMessage("");
        try {
            const res = await triggerZuriSync(token, company.id);
            if (res.error) {
                setStatus("error");
                setMessage(res.error);
            } else {
                setStatus("success");
                setMessage(res.data?.message || "Sync completed successfully.");
            }
        } catch (err) {
            setStatus("error");
            setMessage("Failed to reach synchronization service.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-neutral-900 border-white/10 overflow-hidden group transition-all duration-500 hover:border-purple-500/30">
            <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                        <Database className="h-4 w-4 text-purple-400" />
                        Property Data Migration
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase ${isConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {isConfigured ? 'Connected' : 'Action Required'}
                        </span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <Settings2 className={`h-3.5 w-3.5 transition-transform duration-500 ${isEditing ? 'rotate-90 text-purple-400' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {!isEditing ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2 group-hover:bg-white/10 transition-colors">
                                <img src="/zuri-logo.png" className="h-full w-auto object-contain" alt="Zuri Lease" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-black text-white">Zuri Lease Connector</h4>
                                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                                    Sync historical property financials, tenant profiles, and active leases safely from your legacy Zuri dashboard.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source Domain</span>
                                <span className="text-[10px] font-medium text-neutral-300">{company.zuriDomain || "zuriproperties.co.ke"}</span>
                            </div>
                            {isConfigured ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Auth Profile</span>
                                    <span className="text-[10px] font-medium text-emerald-400">Validated: {company.zuriUsername}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-tighter italic">
                                    <AlertCircle className="h-3 w-3" /> Credentials missing
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Zuri Domain</label>
                            <Input 
                                value={formData.zuriDomain}
                                onChange={(e) => setFormData({...formData, zuriDomain: e.target.value})}
                                className="h-9 bg-white/5 border-white/10 text-xs focus:ring-purple-500/50"
                                placeholder="https://zuriproperties.co.ke"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Username</label>
                                <Input 
                                    value={formData.zuriUsername}
                                    onChange={(e) => setFormData({...formData, zuriUsername: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-purple-500/50"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Password</label>
                                <Input 
                                    value={formData.zuriPassword}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, zuriPassword: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-purple-500/50"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {status !== "idle" && (
                    <div className={`p-4 rounded-2xl flex items-start gap-3 text-[11px] font-medium animate-in zoom-in-95 duration-300 ${status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                        {status === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                        <div className="flex-1">
                            <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">{status === "success" ? "Pipeline Stable" : "Pipeline Interrupted"}</p>
                            <p className="opacity-80 leading-relaxed italic">{message}</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    {isEditing ? (
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full bg-white text-black hover:bg-neutral-200 font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-white/5"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Credentials"}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={handleSync}
                                disabled={loading || !isConfigured}
                                className="flex-1 bg-white text-black hover:bg-neutral-200 disabled:opacity-100 disabled:bg-neutral-100 disabled:text-neutral-900 font-black text-xs uppercase tracking-widest h-11 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4 fill-current" />
                                        Start Historical Pull
                                    </>
                                )}
                            </Button>
                            <Button variant="outline" size="icon" className="h-11 w-11 border-white/10 hover:bg-white/5" asChild>
                                <a href={company.zuriDomain || "https://zuriproperties.co.ke"} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4 text-neutral-400" />
                                </a>
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
