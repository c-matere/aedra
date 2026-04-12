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
        <Card className="bg-neutral-900 border-white/10 overflow-hidden group transition-all duration-500 hover:border-purple-500/30">
            <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.01] flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-black text-white flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-purple-400" />
                        Geospatial Engine
                    </CardTitle>
                    <p className="text-[10px] text-neutral-500 font-medium tracking-wide">Property Mapping & Visuals</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase transition-colors duration-300 ${isConnected ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-500'}`}>
                        {isConnected ? 'Provisioned' : 'Limited'}
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
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {!isEditing ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center p-2 group-hover:bg-purple-500/10 transition-colors duration-500">
                                <Globe className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-bold text-white">{company.mapProvider || "Mapbox Vector Engine"}</h4>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">
                                    Powers high-fidelity vector maps for property portfolios and location-based insights.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active Provider</span>
                                <span className="text-[10px] font-black text-purple-400 tracking-wider uppercase">
                                    {company.mapProvider || "Mapbox GL"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Render Protocol</span>
                                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">WebGL v2</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Map Provider</label>
                            <Select
                                value={formData.mapProvider}
                                onValueChange={(val) => setFormData({...formData, mapProvider: val})}
                            >
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-xs text-neutral-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                    <SelectItem value="Mapbox GL" className="text-xs">Mapbox GL</SelectItem>
                                    <SelectItem value="Google Maps" className="text-xs">Google Maps</SelectItem>
                                    <SelectItem value="Leaflet (OSM)" className="text-xs">Leaflet (OSM)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {formData.mapProvider === "Mapbox GL" && (
                            <div className="space-y-1.5 animate-in fade-in duration-300">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Mapbox Access Token</label>
                                <Input 
                                    value={formData.mapboxAccessToken}
                                    type="password"
                                    onChange={(e) => setFormData({...formData, mapboxAccessToken: e.target.value})}
                                    className="h-9 bg-white/5 border-white/10 text-xs focus:ring-purple-500/50"
                                    placeholder="pk.ey..."
                                />
                            </div>
                        )}
                        
                        {formData.mapProvider !== "Mapbox GL" && (
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-medium">
                                Connector logic for {formData.mapProvider} is pending implementation.
                            </div>
                        )}
                    </div>
                )}

                {testStatus !== "idle" && (
                    <div className={`p-4 rounded-2xl flex items-start gap-3 text-[11px] font-medium animate-in zoom-in-95 duration-300 ${testStatus === "success" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : testStatus === "testing" ? "bg-white/5 text-neutral-300 border border-white/10" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                        {testStatus === "testing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                        ) : testStatus === "success" ? (
                            <Locate className="h-4 w-4 text-purple-400" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div className="flex-1">
                            <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">
                                {testStatus === "testing" ? "Validating Styles..." : testStatus === "success" ? "Access Granted" : "Invalid Token"}
                            </p>
                            <p className="opacity-80 leading-relaxed italic">{message || (testStatus === "testing" ? "Checking Mapbox API response..." : "")}</p>
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
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Protocol"}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={loading || testStatus === "testing"}
                                variant="outline"
                                className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10 font-black text-[10px] uppercase tracking-widest h-10"
                            >
                                <Layers className={`h-3.5 w-3.5 mr-2 ${testStatus === 'testing' ? 'animate-pulse text-purple-400' : ''}`} />
                                Probe API
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white font-black text-[10px] uppercase tracking-widest h-10 transition-all group"
                            onClick={() => setIsEditing(true)}
                        >
                            Sync Engine
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
