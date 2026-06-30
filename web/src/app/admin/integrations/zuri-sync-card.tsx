"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    SlidePanel,
    SlidePanelContent,
    SlidePanelDescription,
    SlidePanelHeader,
    SlidePanelTitle,
} from "@/components/ui/slide-panel";
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
    Compass,
    ShieldCheck,
    Settings
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
        <>
            <div 
                onClick={() => setIsEditing(true)}
                className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-5 shadow-none transition-all hover:bg-[#f0eee6]/40 cursor-pointer flex flex-col justify-between h-full group hover:border-[#9c9a92] min-h-[160px]"
            >
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center shrink-0 text-[#141413]">
                            <Compass className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#1f1e1d]">Zuri PMS Connect</h3>
                            <p className="text-[10px] text-[#73726c] font-medium uppercase tracking-wider mt-0.5">PMS Bridge Node</p>
                        </div>
                    </div>
                    <div className={cn(
                        "px-2 py-0.5 rounded-[9.6px] border text-[9px] font-bold uppercase tracking-wider",
                        isConfigured ? "bg-[#ccdbe8] border-[#dedcd1] text-[#141413]" : "bg-[#f0eee6] border-[#dedcd1] text-[#73726c]"
                    )}>
                        {isConfigured ? "Active" : "Offline"}
                    </div>
                </div>
                <p className="text-xs text-[#73726c] leading-relaxed mt-4 flex-1">
                    Bi-directional data tunnel for property ingestion, unit synchronization, and tenant document mirroring from Zuri PMS.
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#73726c] group-hover:text-[#1f1e1d] flex items-center gap-1 transition-colors">
                        <Settings className="h-3 w-3" /> Configure Port
                    </span>
                </div>
            </div>

            <SlidePanel open={isEditing} onOpenChange={setIsEditing}>
                <SlidePanelContent className="sm:max-w-2xl border-l border-[#dedcd1] bg-[#faf9f5] shadow-none flex flex-col h-full justify-between p-0">
                    <div className="p-8 space-y-6 overflow-y-auto flex-1">
                        <SlidePanelHeader className="border-b border-[#dedcd1] pb-6">
                            <SlidePanelTitle className="text-2xl font-normal font-serif text-[#141413]">
                                Configure Zuri PMS Bridge
                            </SlidePanelTitle>
                            <SlidePanelDescription className="text-sm text-[#73726c]">
                                Set up real-time property, unit, and tenant synchronizations from your Zuri PMS account.
                            </SlidePanelDescription>
                        </SlidePanelHeader>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Portal Domain</label>
                                <Input 
                                    value={formData.zuriDomain}
                                    onChange={(e) => setFormData({...formData, zuriDomain: e.target.value})}
                                    className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Username</label>
                                    <Input 
                                        value={formData.zuriUsername}
                                        onChange={(e) => setFormData({...formData, zuriUsername: e.target.value})}
                                        className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Password</label>
                                    <Input 
                                        value={formData.zuriPassword}
                                        type="password"
                                        onChange={(e) => setFormData({...formData, zuriPassword: e.target.value})}
                                        className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {status !== "idle" && (
                            <div className={cn(
                                "p-4 rounded-[12px] flex items-start gap-3 text-xs font-medium border transition-all",
                                status === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                "bg-red-50 border-red-200 text-red-800"
                            )}>
                                <ShieldCheck className="h-4 w-4" />
                                <div className="flex-1">
                                    <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">{status.toUpperCase()}</p>
                                    <p className="opacity-90">{message || "Operation complete."}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-[#dedcd1] p-6 bg-[#ffffff] flex gap-3">
                        <Button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="flex-1 h-10 rounded-[9.6px] bg-primary text-primary-foreground font-medium text-xs uppercase tracking-wider transition-all"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Configuration"}
                        </Button>
                        {isConfigured && (
                            <Button 
                                onClick={handleSync} 
                                disabled={loading}
                                variant="outline"
                                className="h-10 px-4 rounded-[9.6px] border-[#dedcd1] text-[#141413] hover:bg-[#f0eee6]/50 flex items-center justify-center transition-all"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Sync Data
                            </Button>
                        )}
                        <Button 
                            onClick={() => setIsEditing(false)}
                            variant="ghost"
                            className="h-10 px-4 rounded-[9.6px] text-[#73726c] hover:bg-[#f0eee6]/50 transition-all"
                        >
                            Cancel
                        </Button>
                    </div>
                </SlidePanelContent>
            </SlidePanel>
        </>
    );
}
