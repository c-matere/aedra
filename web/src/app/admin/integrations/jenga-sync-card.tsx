"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
    SlidePanel,
    SlidePanelContent,
    SlidePanelDescription,
    SlidePanelHeader,
    SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { 
    updateCompany, 
    testJengaConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    AlertCircle, 
    Zap,
    Wallet,
    ShieldCheck,
    Settings
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
        <>
            <div 
                onClick={() => setIsEditing(true)}
                className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-5 shadow-none transition-all hover:bg-[#f0eee6]/40 cursor-pointer flex flex-col justify-between h-full group hover:border-[#9c9a92] min-h-[160px]"
            >
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center shrink-0 text-[#141413]">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#1f1e1d]">Equity Bank Jenga</h3>
                            <p className="text-[10px] text-[#73726c] font-medium uppercase tracking-wider mt-0.5">Banking & Settlement</p>
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
                    Direct interbank gateway for B2B settlements, real-time reconciliation, and institutional banking sync.
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
                                Configure Equity Bank Jenga
                            </SlidePanelTitle>
                            <SlidePanelDescription className="text-sm text-[#73726c]">
                                Set up real-time institutional banking and interbank settlement sync.
                            </SlidePanelDescription>
                        </SlidePanelHeader>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-[#ffffff] p-4 rounded-[12px] border border-[#dedcd1]">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-[#141413]">Protocol Status</p>
                                    <p className="text-[10px] text-[#73726c]">Enable real-time transaction query and settlements.</p>
                                </div>
                                <Switch 
                                    checked={formData.jengaEnabled}
                                    onCheckedChange={(val) => setFormData({...formData, jengaEnabled: val})}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Merchant Code</label>
                                    <Input 
                                        value={formData.jengaMerchantCode}
                                        onChange={(e) => setFormData({...formData, jengaMerchantCode: e.target.value})}
                                        className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                        placeholder="MER123..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">API Key</label>
                                    <Input 
                                        value={formData.jengaApiKey}
                                        type="password"
                                        onChange={(e) => setFormData({...formData, jengaApiKey: e.target.value})}
                                        className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest">Consumer Secret</label>
                                <Input 
                                    value={formData.jengaConsumerSecret}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, jengaConsumerSecret: e.target.value})}
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
