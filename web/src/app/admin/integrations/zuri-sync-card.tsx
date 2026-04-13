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
        <Card className="bg-white/[0.02] backdrop-blur-3xl border-white/5 overflow-hidden group transition-all duration-700 hover:border-purple-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative rounded-[2.5rem] flex flex-col h-full">
            {/* Header / Head Section */}
            <div className="p-8 pb-4 relative flex items-center justify-center min-h-[140px]">
                <div className={`absolute top-4 right-6 px-3 py-1 rounded-full border ${isConfigured ? 'border-purple-500/30 bg-purple-500/5 text-purple-400' : 'border-white/10 bg-white/5 text-neutral-500'} text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500`}>
                    {isConfigured ? 'Active' : 'Offline'}
                </div>
                
                <div className="relative group/logo">
                    <div className="h-20 w-20 rounded-[1.5rem] bg-purple-500/5 border border-purple-500/10 flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:bg-purple-500/10 shadow-inner overflow-hidden">
                        <Database className="h-10 w-10 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]" />
                    </div>
                </div>
            </div>

            {/* Body Section */}
            <CardContent className="px-10 pb-10 flex-1 flex flex-col text-center">
                {!isEditing ? (
                    <div className="space-y-4 flex-1">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-purple-400 transition-colors duration-500">
                                Zuri Property Connect
                            </h3>
                            <p className="text-[11px] font-black text-purple-500/60 uppercase tracking-[0.15em]">
                                PMS Bridge Node
                            </p>
                        </div>
                        
                        <p className="text-sm text-neutral-500 leading-relaxed font-medium px-4">
                            Bi-directional data tunnel for property ingestion, unit synchronization, and tenant document mirroring from Zuri PMS.
                        </p>

                        <div className="grid grid-cols-1 gap-3 pt-6">
                            <Button 
                                variant="outline" 
                                className="h-12 rounded-2xl border-white/5 bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/10 hover:border-purple-500/30 font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95 group/btn"
                                onClick={() => setIsEditing(true)}
                            >
                                <Settings2 className="h-4 w-4 mr-2 group-hover/btn:rotate-90 transition-transform duration-500" />
                                Configure Tunnel
                            </Button>
                            {isConfigured && (
                                <Button 
                                    onClick={handleSync} 
                                    disabled={loading}
                                    variant="ghost"
                                    className="h-12 rounded-2xl bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95 group/sync"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2 group-hover/sync:rotate-180 transition-transform duration-700" />}
                                    Initiate Handshake
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Portal Domain</label>
                                <Input 
                                    value={formData.zuriDomain}
                                    onChange={(e) => setFormData({...formData, zuriDomain: e.target.value})}
                                    className="h-11 bg-white/5 border-white/10 text-sm focus:ring-purple-500/30 rounded-xl"
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Username</label>
                                    <Input 
                                        value={formData.zuriUsername}
                                        onChange={(e) => setFormData({...formData, zuriUsername: e.target.value})}
                                        className="h-11 bg-white/5 border-white/10 text-sm focus:ring-purple-500/30 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Password</label>
                                    <Input 
                                        value={formData.zuriPassword}
                                        type="password"
                                        onChange={(e) => setFormData({...formData, zuriPassword: e.target.value})}
                                        className="h-11 bg-white/5 border-white/10 text-sm focus:ring-purple-500/30 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {status !== "idle" && (
                            <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-medium animate-in zoom-in-95 duration-500 ${status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                                {status === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <div className="flex-1">
                                    <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">{status.toUpperCase()}</p>
                                    <p className="opacity-80 italic">{message || "Operation complete."}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={handleSave} 
                                disabled={loading}
                                className="flex-1 h-12 rounded-2xl bg-purple-600 text-white hover:bg-purple-500 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-purple-500/20"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bind Keys"}
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
