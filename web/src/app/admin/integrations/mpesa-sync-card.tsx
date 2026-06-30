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
    updateCompany, 
    testMpesaConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    AlertCircle, 
    Zap,
    CreditCard,
    ShieldCheck,
    Settings
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
        <>
            <div 
                onClick={() => setIsEditing(true)}
                className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-5 shadow-none transition-all hover:bg-[#f0eee6]/40 cursor-pointer flex flex-col justify-between h-full group hover:border-[#9c9a92] min-h-[160px]"
            >
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center shrink-0 text-[#141413]">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#1f1e1d]">Safaricom M-Pesa</h3>
                            <p className="text-[10px] text-[#73726c] font-medium uppercase tracking-wider mt-0.5">Payment Services</p>
                        </div>
                    </div>
                    <div className={cn(
                        "px-2 py-0.5 rounded-[9.6px] border text-[9px] font-bold uppercase tracking-wider",
                        isConnected ? "bg-[#ccdbe8] border-[#dedcd1] text-[#141413]" : "bg-[#f0eee6] border-[#dedcd1] text-[#73726c]"
                    )}>
                        {isConnected ? "Active" : "Offline"}
                    </div>
                </div>
                <p className="text-xs text-[#73726c] leading-relaxed mt-4 flex-1">
                    Direct C2B/B2C gateway for automated rent collection, disbursement tracking, and instant statement sync via Daraja.
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
                                Configure Safaricom M-Pesa
                            </SlidePanelTitle>
                            <SlidePanelDescription className="text-sm text-[#73726c]">
                                Set up direct tenant rent payment sync via the Daraja C2B gateway.
                            </SlidePanelDescription>
                        </SlidePanelHeader>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Shortcode</label>
                                    <Input 
                                        value={formData.mpesaShortcode}
                                        onChange={(e) => setFormData({...formData, mpesaShortcode: e.target.value})}
                                        className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                        placeholder="174379"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Environment</label>
                                    <div className="h-10 bg-[#ffffff] border-[#dedcd1] rounded-[9.6px] relative px-3 flex items-center">
                                        <select 
                                            value={formData.mpesaEnvironment}
                                            onChange={(e) => setFormData({...formData, mpesaEnvironment: e.target.value as any})}
                                            className="w-full bg-transparent text-sm text-[#141413] outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="sandbox">Sandbox</option>
                                            <option value="production">Production</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Consumer Key</label>
                                <Input 
                                    value={formData.mpesaConsumerKey}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, mpesaConsumerKey: e.target.value})}
                                    className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Consumer Secret</label>
                                <Input 
                                    value={formData.mpesaConsumerSecret}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, mpesaConsumerSecret: e.target.value})}
                                    className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Passkey (Lipa na M-Pesa Online)</label>
                                <Input 
                                    value={formData.mpesaPasskey}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, mpesaPasskey: e.target.value})}
                                    className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                />
                            </div>
                        </div>

                        {testStatus !== "idle" && (
                            <div className={cn(
                                "p-4 rounded-[12px] flex items-start gap-3 text-xs font-medium border transition-all",
                                testStatus === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                testStatus === "testing" ? "bg-white border-[#dedcd1] text-[#73726c]" :
                                "bg-red-50 border-red-200 text-red-800"
                            )}>
                                {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin text-[#141413]" /> : <ShieldCheck className="h-4 w-4" />}
                                <div className="flex-1">
                                    <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">{testStatus.toUpperCase()}</p>
                                    <p className="opacity-90">{message || "Processing request..."}</p>
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
                        <Button 
                            onClick={handleTest} 
                            disabled={loading || testStatus === "testing"}
                            variant="outline"
                            className="h-10 px-4 rounded-[9.6px] border-[#dedcd1] text-[#141413] hover:bg-[#f0eee6]/50 flex items-center justify-center transition-all"
                        >
                            <Zap className="h-4 w-4 mr-2" /> Test
                        </Button>
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
