"use client";

import { useState } from "react";
import { 
    Plug, 
    Brain, 
    CreditCard, 
    Wallet, 
    Smartphone, 
    MessageSquare, 
    Map as MapIcon, 
    Compass, 
    Search,
    Grid,
    Check,
    Loader2,
    ShieldCheck,
    AlertCircle,
    Activity,
    Database,
    History,
    Network
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CompanyRecord } from "@/lib/backend-api";

import { MpesaSyncCard } from "./mpesa-sync-card";
import { JengaSyncCard } from "./jenga-sync-card";
import { SmsSyncCard } from "./sms-sync-card";
import { WhatsAppSyncCard } from "./whatsapp-sync-card";
import { MapsSyncCard } from "./maps-sync-card";
import { ZuriSyncCard } from "./zuri-sync-card";
import { BrainSyncCard } from "./brain-sync-card";

interface IntegrationsClientComponentProps {
    company: CompanyRecord | null;
    token: string;
    paymentMethodCounts: Record<string, number>;
    maintenanceStatusCounts: Record<string, number>;
    paymentsCount: number;
    maintenanceCount: number;
    gatewayStatusError: string | null;
}

const CATEGORIES = [
    { id: "all", name: "All Connectors", icon: Grid },
    { id: "cognitive", name: "Autonomy & Brain", icon: Brain },
    { id: "finance", name: "Finance & Comms", icon: CreditCard },
    { id: "geo", name: "Geo-Services & Mapping", icon: MapIcon },
];

const CONNECTORS_LIST = [
    { id: "brain", name: "Reasoning Engine", category: "cognitive", icon: Brain, description: "Secure Semantic Protocol for cognitive oversight, reasoning capability sync, and AI execution tracking." },
    { id: "mpesa", name: "Safaricom M-Pesa", category: "finance", icon: CreditCard, description: "Direct C2B/B2C gateway for automated rent collection, disbursement tracking, and instant statement sync via Daraja API." },
    { id: "jenga", name: "Equity Bank Jenga", category: "finance", icon: Wallet, description: "Direct interbank gateway for B2B settlements, real-time reconciliation, and institutional banking sync." },
    { id: "sms", name: "Africa's Talking SMS", category: "finance", icon: Smartphone, description: "Global SMS gateway for automated rent reminders, maintenance updates, and bulk tenant broadcasts." },
    { id: "whatsapp", name: "WhatsApp Business", category: "finance", icon: MessageSquare, description: "Official Meta gateway for automated rent alerts, OTP confirmations, and real-time maintenance sync." },
    { id: "maps", name: "Mapbox Geo-Services", category: "geo", icon: MapIcon, description: "Interactive map integration for property location pinpoints, boundary mapping, and regional statistics." },
    { id: "zuri", name: "Zuri Property Connect", category: "geo", icon: Compass, description: "Bi-directional data tunnel for property ingestion, unit synchronization, and tenant document mirroring from Zuri PMS." },
];

function capitalize(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function IntegrationsClientComponent({
    company,
    token,
    paymentMethodCounts,
    maintenanceStatusCounts,
    paymentsCount,
    maintenanceCount,
    gatewayStatusError
}: IntegrationsClientComponentProps) {
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTab, setSelectedTab] = useState("all");

    const isConnected = (id: string) => {
        if (!company) return false;
        switch (id) {
            case "brain": return true; // Online on load
            case "mpesa": return !!(company.mpesaShortcode && company.mpesaConsumerKey);
            case "jenga": return !!(company.jengaMerchantCode && company.jengaApiKey && company.jengaEnabled);
            case "sms": return !!(company.africaTalkingUsername && company.africaTalkingApiKey);
            case "whatsapp": return !!(company.waAccessToken && company.waPhoneNumberId);
            case "maps": return !!(company.mapboxAccessToken);
            case "zuri": return !!(company.zuriUsername && company.zuriPassword);
            default: return false;
        }
    };

    const filteredConnectors = CONNECTORS_LIST.filter(c => {
        if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
        
        const query = searchQuery.toLowerCase();
        if (query && !c.name.toLowerCase().includes(query) && !c.description.toLowerCase().includes(query)) return false;
        
        const active = isConnected(c.id);
        if (selectedTab === "active" && !active) return false;
        if (selectedTab === "available" && active) return false;
        
        return true;
    });

    return (
        <div className="grid grid-cols-12 gap-8 items-start">
            {/* Sidebar directory */}
            <aside className="col-span-12 md:col-span-3 space-y-4">
                <div className="text-[10px] font-bold text-[#73726c] uppercase tracking-widest px-3 mb-2">
                    Directory
                </div>
                <nav className="space-y-1.5">
                    {CATEGORIES.map(cat => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2 text-left text-sm font-medium transition-all rounded-[9.6px] ${
                                    isSelected 
                                    ? "bg-[#f0eee6] text-[#141413] font-bold" 
                                    : "text-[#73726c] hover:bg-[#f0eee6]/50 hover:text-[#1f1e1d]"
                                }`}
                            >
                                <cat.icon className={`h-4 w-4 ${isSelected ? "text-[#141413]" : "text-[#9c9a92]"}`} />
                                {cat.name}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main connector board */}
            <main className="col-span-12 md:col-span-9 space-y-6">
                {/* Search / Filter row */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-1 bg-[#f0eee6]/40 p-1 border border-[#dedcd1] rounded-[9.6px] w-full sm:w-auto">
                        {[
                            { id: "all", label: "All" },
                            { id: "active", label: "Active" },
                            { id: "available", label: "Available" }
                        ].map(t => {
                            const isSelected = selectedTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTab(t.id)}
                                    className={`px-3 py-1 text-xs font-bold transition-all rounded-full flex-1 sm:flex-none ${
                                        isSelected
                                        ? "bg-[#ccdbe8] border border-[#dedcd1] text-[#141413]"
                                        : "bg-transparent border-transparent text-[#73726c] hover:text-[#1f1e1d]"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#73726c] pointer-events-none" />
                        <Input
                            placeholder="Search plugins..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-9 bg-[#ffffff] border-[#dedcd1] text-xs text-[#141413] placeholder-[#9c9a92] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none shadow-none"
                        />
                    </div>
                </div>

                {/* Grid layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredConnectors.map(c => (
                        <div key={c.id}>
                            {c.id === "brain" && <BrainSyncCard token={token} />}
                            {c.id === "mpesa" && company && <MpesaSyncCard company={company} token={token} />}
                            {c.id === "jenga" && company && <JengaSyncCard company={company} token={token} />}
                            {c.id === "sms" && company && <SmsSyncCard company={company} token={token} />}
                            {c.id === "whatsapp" && company && <WhatsAppSyncCard company={company} token={token} />}
                            {c.id === "maps" && company && <MapsSyncCard company={company} token={token} />}
                            {c.id === "zuri" && company && <ZuriSyncCard company={company} token={token} />}
                        </div>
                    ))}

                    {/* Placeholder Cards */}
                    {selectedCategory === "cognitive" && filteredConnectors.length > 0 && (
                        <Card className="bg-[#ffffff] border border-dashed border-[#dedcd1] rounded-[16px] p-5 shadow-none flex flex-col justify-between min-h-[160px] group transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-3">
                                    <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#9c9a92]">
                                        <Network className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[#73726c]">Neural Scalability</h3>
                                        <p className="text-[10px] text-[#9c9a92] font-medium uppercase tracking-wider mt-0.5">Autonomy Core</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-[#9c9a92] leading-relaxed mt-4 flex-1">
                                Provision additional reasoning clusters or private model configurations. (Expansion pending)
                            </p>
                            <div className="mt-4 text-[9px] uppercase font-bold tracking-widest text-[#9c9a92]">
                                Coming Soon
                            </div>
                        </Card>
                    )}

                    {(selectedCategory === "all" || selectedCategory === "geo") && filteredConnectors.length > 0 && (
                        <Card className="bg-[#ffffff] border border-dashed border-[#dedcd1] rounded-[16px] p-5 shadow-none flex flex-col justify-between min-h-[160px] group transition-all hover:bg-[#f0eee6]/40 cursor-pointer hover:border-[#9c9a92]">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-3">
                                    <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#141413]">
                                        <Plug className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[#1f1e1d]">Add Custom Port</h3>
                                        <p className="text-[10px] text-[#73726c] font-medium uppercase tracking-wider mt-0.5">Marketplace</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-[#73726c] leading-relaxed mt-4 flex-1">
                                ERP, SCADA, or legacy data source connectors. Expand your digital property pipeline.
                            </p>
                            <div className="mt-4 text-[9px] uppercase font-bold tracking-widest text-[#73726c]">
                                Browse Marketplace
                            </div>
                        </Card>
                    )}

                    {filteredConnectors.length === 0 && (
                        <div className="col-span-full py-16 text-center rounded-[16px] border border-dashed border-[#dedcd1] bg-[#f0eee6]/10">
                            <Plug className="h-8 w-8 text-[#9c9a92] mx-auto mb-3" />
                            <p className="text-sm text-[#73726c]">No matching connectors found.</p>
                            <p className="text-[10px] text-[#9c9a92] mt-1 uppercase tracking-tight">Try adjusting filters or directory search criteria</p>
                        </div>
                    )}
                </div>

                {/* Ledger metrics & breakdowns */}
                {filteredConnectors.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
                        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] overflow-hidden shadow-none">
                            <CardHeader className="border-b border-[#dedcd1]">
                                <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                    <History className="h-4 w-4 text-[#9c9a92]" /> Payment Methods Mix
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {Object.entries(paymentMethodCounts).length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {Object.entries(paymentMethodCounts).map(([method, count]) => (
                                            <div key={method} className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col hover:bg-[#f0eee6]/50 transition-colors">
                                                <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-tight">{capitalize(method)}</span>
                                                <span className="text-2xl font-normal font-serif text-[#141413]">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-[#73726c] font-medium italic text-xs">
                                        No processed payments found for this channel.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] overflow-hidden shadow-none">
                            <CardHeader className="border-b border-[#dedcd1]">
                                <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-[#9c9a92]" /> Maintenance Status Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {Object.entries(maintenanceStatusCounts).length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {Object.entries(maintenanceStatusCounts).map(([status, count]) => (
                                            <div key={status} className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-4 flex flex-col hover:bg-[#f0eee6]/50 transition-colors">
                                                <span className="text-[10px] font-bold text-[#73726c] uppercase tracking-tight">{capitalize(status)}</span>
                                                <span className="text-2xl font-normal font-serif text-[#141413]">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-[#73726c] font-medium italic text-xs">
                                        No maintenance history available for this node.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}

export function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
    return (
        <div className={className}>
            {children}
        </div>
    );
}
