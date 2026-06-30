"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getAiManifest } from "@/lib/backend-api";
import { 
    Loader2, 
    Brain, 
    ShieldCheck,
    Network,
    Activity,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BrainSyncCardProps {
    token: string;
}

export function BrainSyncCard({ token }: BrainSyncCardProps) {
    const [status, setStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
    const [manifest, setManifest] = useState<any>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const checkConnectivity = async () => {
        setStatus("loading");
        const start = performance.now();
        try {
            const res = await getAiManifest(token);
            const end = performance.now();
            
            if (res.data) {
                setManifest(res.data);
                setLatency(Math.round(end - start));
                setStatus("connected");
                setLastSync(new Date());
                setError(null);
            } else {
                setStatus("error");
                setError(res.error || "Failed to retrieve AI manifest");
            }
        } catch (err) {
            setStatus("error");
            setError("Brain service unreachable");
        }
    };

    useEffect(() => {
        checkConnectivity();
        const interval = setInterval(checkConnectivity, 60000); // Heartbeat every minute
        return () => clearInterval(interval);
    }, [token]);

    const toolCount = manifest?.tools ? Object.keys(manifest.tools).length : 0;

    return (
        <div 
            className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-5 shadow-none flex flex-col justify-between h-full group min-h-[160px]"
        >
            <div className="flex items-start justify-between">
                <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center shrink-0 text-[#141413]">
                        <Brain className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#1f1e1d]">Reasoning Engine</h3>
                        <p className="text-[10px] text-[#73726c] font-medium uppercase tracking-wider mt-0.5">Cognitive Autonomy Core</p>
                    </div>
                </div>
                <div className={cn(
                    "px-2 py-0.5 rounded-[9.6px] border text-[9px] font-bold uppercase tracking-wider",
                    status === "connected" ? "bg-[#ccdbe8] border-[#dedcd1] text-[#141413]" : 
                    status === "loading" ? "bg-amber-50 border-amber-200 text-amber-800" :
                    "bg-red-50 border-red-200 text-red-800"
                )}>
                    {status === "connected" ? "Online" : status === "loading" ? "Syncing" : "Offline"}
                </div>
            </div>

            <p className="text-xs text-[#73726c] leading-relaxed mt-4 flex-1">
                Autonomous decision-making layer. Handshakes with {manifest?.appName || 'Aedra Engine'} via Secure Semantic Protocol.
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#dedcd1]">
                <div className="bg-[#f0eee6]/30 border border-[#dedcd1] rounded-[12px] p-2">
                    <p className="text-[8px] font-bold text-[#73726c] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <Network className="h-2 w-2 text-[#9c9a92]" /> Toolset Size
                    </p>
                    <p className="text-sm font-normal font-serif text-[#141413]">
                        {status === 'connected' ? `${toolCount} Actions` : '--'}
                    </p>
                </div>
                <div className="bg-[#f0eee6]/30 border border-[#dedcd1] rounded-[12px] p-2">
                    <p className="text-[8px] font-bold text-[#73726c] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <Activity className="h-2 w-2 text-[#9c9a92]" /> Latency
                    </p>
                    <p className="text-sm font-normal font-serif text-[#141413]">
                        {status === 'connected' ? `${latency}ms` : '--'}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[9px] text-[#73726c]">
                <span>
                    {lastSync ? `Sync: ${lastSync.toLocaleTimeString()}` : "Syncing..."}
                </span>
                <button 
                    onClick={checkConnectivity}
                    disabled={status === "loading"}
                    className="hover:text-[#1f1e1d] p-1 rounded-full hover:bg-[#f0eee6] transition-colors"
                >
                    <RefreshCw className={cn("h-3 w-3", status === "loading" && "animate-spin")} />
                </button>
            </div>
        </div>
    );
}
