"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAiManifest } from "@/lib/backend-api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Cpu,
    Zap,
    Brain,
    ShieldCheck,
    Network,
    Activity,
    Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
        <Card className="bg-white/[0.02] backdrop-blur-3xl border-white/5 overflow-hidden group transition-all duration-700 hover:border-indigo-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative rounded-[2.5rem] flex flex-col h-full min-h-[380px]">
            {/* Background Neural Pulse Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] transition-opacity duration-1000 ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] transition-opacity duration-1000 ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`} />
            </div>

            {/* Header / Connection Status */}
            <div className="p-8 pb-4 relative flex items-center justify-center min-h-[140px]">
                <div className={`absolute top-4 right-6 px-3 py-1 rounded-full border ${status === 'connected' ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400' : status === 'loading' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : 'border-red-500/30 bg-red-500/5 text-red-500'} text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500`}>
                    {status === 'connected' ? 'Protocol Online' : status === 'loading' ? 'Syncing...' : 'Link Severed'}
                </div>
                
                <div className="relative group/logo">
                    <motion.div 
                        initial={false}
                        animate={status === 'connected' ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="h-20 w-20 rounded-[1.5rem] bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:bg-indigo-500/10 shadow-inner"
                    >
                        <Brain className="h-10 w-10 text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.4)]" />
                    </motion.div>
                    {status === 'connected' && (
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-indigo-500 rounded-full border-[3px] border-[#0a0a0a] animate-pulse" />
                    )}
                </div>
            </div>

            {/* Body Section */}
            <CardContent className="px-10 pb-10 flex-1 flex flex-col text-center relative z-10">
                <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors duration-500">
                            Reasoning Engine
                        </h3>
                        <p className="text-[11px] font-black text-indigo-500/60 uppercase tracking-[0.15em]">
                            Cognitive Autonomy Core
                        </p>
                    </div>
                    
                    <p className="text-xs text-neutral-500 leading-relaxed font-medium px-4">
                        Autonomous decision-making layer. Handshakes with {manifest?.appName || 'Brain'} via Secure Semantic Protocol.
                    </p>

                    {/* Live Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 text-left">
                            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Network className="h-2 w-2" /> Toolset Size
                            </p>
                            <p className="text-lg font-black text-white">
                                {status === 'connected' ? toolCount : '--'}
                                <span className="text-[10px] text-neutral-600 ml-1 font-bold">Capabilities</span>
                            </p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 text-left">
                            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Activity className="h-2 w-2" /> Latency
                            </p>
                            <p className="text-lg font-black text-white">
                                {status === 'connected' ? `${latency}ms` : '--'}
                                <span className="text-[10px] text-neutral-600 ml-1 font-bold">Handoff</span>
                            </p>
                        </div>
                    </div>

                    <div className="pt-6">
                        <Button 
                            variant="outline" 
                            disabled={status === "loading"}
                            className="w-full h-12 rounded-2xl border-white/5 bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/10 hover:border-indigo-500/30 font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95 group/btn"
                            onClick={checkConnectivity}
                        >
                            {status === "loading" ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-500 text-indigo-400" />
                            )}
                            Re-bind Protocol
                        </Button>
                    </div>
                    
                    {status === "error" && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-[10px] text-red-500 font-bold italic animate-in fade-in duration-500">
                            Error: {error}
                        </div>
                    )}
                </div>
                
                {lastSync && (
                    <div className="pt-4 text-[9px] text-neutral-600 uppercase tracking-widest font-black">
                        Last Handshake: {lastSync.toLocaleTimeString()}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
