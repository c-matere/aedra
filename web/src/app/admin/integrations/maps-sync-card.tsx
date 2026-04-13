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
    testMapsConnection, 
    type CompanyRecord 
} from "@/lib/backend-api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Settings2, 
    Map as MapIcon,
    Locate,
    Globe,
    Layers
} from "lucide-react";
import { useRouter } from "next/navigation";

interface MapsSyncCardProps {
    company: CompanyRecord;
    token: string;
}

export function MapsSyncCard({ company, token }: MapsSyncCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState({
        mapProvider: company.mapProvider || "Mapbox GL",
        mapboxAccessToken: company.mapboxAccessToken || "",
    });

    const isConnected = !!(company.mapboxAccessToken);

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
            const res = await testMapsConnection(token, company.id, formData);
            if (res.data?.success) {
                setTestStatus("success");
                setMessage(res.data.message);
            } else {
                setTestStatus("error");
                setMessage(res.data?.message || res.error || "Maps validation failed");
            }
        } catch (e) {
            setTestStatus("error");
            setMessage("Failed to reach testing service.");
        }
    };

    return (
        <Card className="bg-white/[0.02] backdrop-blur-3xl border-white/5 overflow-hidden group transition-all duration-700 hover:border-blue-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative rounded-[2.5rem] flex flex-col h-full">
            {/* Header / Head Section */}
            <div className="p-8 pb-4 relative flex items-center justify-center min-h-[140px]">
                <div className={`absolute top-4 right-6 px-3 py-1 rounded-full border ${isConnected ? 'border-blue-500/30 bg-blue-500/5 text-blue-400' : 'border-white/10 bg-white/5 text-neutral-500'} text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500`}>
                    {isConnected ? 'Active' : 'Offline'}
                </div>
                
                <div className="relative group/logo">
                    <div className="h-20 w-20 rounded-[1.5rem] bg-blue-500/5 border border-blue-500/10 flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:bg-blue-500/10 shadow-inner overflow-hidden">
                        <MapIcon className="h-10 w-10 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    </div>
                </div>
            </div>

            {/* Body Section */}
            <CardContent className="px-10 pb-10 flex-1 flex flex-col text-center">
                {!isEditing ? (
                    <div className="space-y-4 flex-1">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors duration-500">
                                {company.mapProvider || "Geospatial Engine"}
                            </h3>
                            <p className="text-[11px] font-black text-blue-500/60 uppercase tracking-[0.15em]">
                                Geo-Information Node
                            </p>
                        </div>
                        
                        <p className="text-sm text-neutral-500 leading-relaxed font-medium px-4">
                            High-fidelity vector mapping for property portfolios, location-based tenant insights, and geospatial visualization.
                        </p>

                        <div className="pt-6">
                            <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-2xl border-white/5 bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/10 hover:border-blue-500/30 font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95 group/btn"
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
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Render Provider</label>
                                <div className="h-11 bg-white/5 border-white/10 rounded-xl relative">
                                    <select 
                                        value={formData.mapProvider}
                                        onChange={(e) => setFormData({...formData, mapProvider: e.target.value})}
                                        className="w-full h-full bg-transparent text-sm text-white px-3 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="Mapbox GL" className="bg-neutral-900">Mapbox GL</option>
                                        <option value="Google Maps" className="bg-neutral-900">Google Maps</option>
                                        <option value="Leaflet" className="bg-neutral-900">Leaflet</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Access Token / API Key</label>
                                <Input 
                                    value={formData.mapboxAccessToken}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, mapboxAccessToken: e.target.value})}
                                    className="h-11 bg-white/5 border-white/10 text-sm focus:ring-blue-500/30 rounded-xl"
                                    placeholder="pk.ey..."
                                />
                            </div>
                        </div>

                        {testStatus !== "idle" && (
                            <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-medium animate-in zoom-in-95 duration-500 ${testStatus === "success" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : testStatus === "testing" ? "bg-white/5 text-neutral-300 border border-white/10" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                                {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : testStatus === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
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
                                className="flex-1 h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bind Keys"}
                            </Button>
                            <Button 
                                onClick={handleTest} 
                                disabled={loading || testStatus === "testing"}
                                variant="outline"
                                className="h-12 w-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Globe className={`h-5 w-5 ${testStatus === 'testing' ? 'animate-pulse text-blue-400' : ''}`} />
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
