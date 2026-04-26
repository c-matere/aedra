import {
  listMaintenanceRequests,
  listPayments,
  fetchMe,
  getCompany,
  listCompanies
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import Link from "next/link";
import { 
  Plug, 
  Activity, 
  Database, 
  ShieldCheck, 
  Smartphone,
  Map as MapIcon,
  CreditCard,
  History,
  AlertCircle,
  Loader2
} from "lucide-react";
import { ZuriSyncCard } from "./zuri-sync-card";
import { MpesaSyncCard } from "./mpesa-sync-card";
import { JengaSyncCard } from "./jenga-sync-card";
import { SmsSyncCard } from "./sms-sync-card";
import { MapsSyncCard } from "./maps-sync-card";
import { WhatsAppSyncCard } from "./whatsapp-sync-card";
import { BrainSyncCard } from "./brain-sync-card";
import { CompanySelector } from "../settings/company-selector";
import { IntegrationsContainer, FadeIn } from "./integrations-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const resolvedSearchParams = await searchParams;
  const queryCompanyId = resolvedSearchParams.companyId as string | undefined;
  
  const meResult = await fetchMe(sessionToken);
  const userCompanyId = meResult.data?.user?.companyId;
  const effectiveCompanyId = (role === "SUPER_ADMIN" && queryCompanyId) ? queryCompanyId : userCompanyId;

  const [paymentsResult, maintenanceResult, companyResult, allCompaniesResult] = await Promise.all([
    listPayments(sessionToken),
    listMaintenanceRequests(sessionToken),
    effectiveCompanyId ? getCompany(sessionToken, effectiveCompanyId) : Promise.resolve({ data: null, error: "No company selected", status: 200 }),
    role === "SUPER_ADMIN" ? listCompanies(sessionToken) : Promise.resolve({ data: null, error: null, status: 200 })
  ]);

  if (!meResult.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-white">Authentication Sync Failure</h2>
        <p className="text-neutral-400">We couldn't verify your platform identity. Please sign in again.</p>
        <Button variant="outline" className="border-white/10 text-white" asChild>
            <Link href="/login">Return to Login</Link>
        </Button>
      </div>
    );
  }

  const company = companyResult.data;
  const allCompanies = allCompaniesResult.data || [];

  const payments = paymentsResult.data?.data ?? [];
  const maintenance = maintenanceResult.data?.data ?? [];

  const paymentMethodCounts = payments.reduce<Record<string, number>>((counts, payment) => {
    const method = payment.method || "UNKNOWN";
    counts[method] = (counts[method] ?? 0) + 1;
    return counts;
  }, {});

  const maintenanceStatusCounts = maintenance.reduce<Record<string, number>>(
    (counts, request) => {
      const status = request.status || "REPORTED";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-8 pb-10 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none -z-10 blur-3xl opacity-50" />
      
      <FadeIn className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between relative z-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-2xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10">
                <Plug className="h-7 w-7 text-blue-400" />
            </div>
            Integrations <span className="text-neutral-500">Hub</span>
          </h1>
          <p className="text-neutral-400 text-sm font-medium ml-1">
            Operational sync health and 3rd-party service configuration.
          </p>
        </div>
      </FadeIn>

      {role === "SUPER_ADMIN" && allCompanies.length > 0 && (
        <CompanySelector 
          companies={allCompanies} 
          currentCompanyId={effectiveCompanyId || ""} 
        />
      )}

      {/* Global & Company Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="h-3 w-3 text-emerald-400" /> Payments Logged
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">
            {payments.length}
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3 text-blue-400" /> Maintenance Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">
            {maintenance.length}
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Database className="h-3 w-3 text-purple-400" /> Gateway Integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold text-neutral-200">
            {paymentsResult.error || maintenanceResult.error || companyResult.error ? (
              <span className="text-red-400 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {companyResult.error || paymentsResult.error || maintenanceResult.error}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> Operational
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {!effectiveCompanyId && role === "SUPER_ADMIN" ? (
        <Card className="bg-blue-500/5 border-blue-500/20 p-12 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Plug className="h-8 w-8 text-blue-400" />
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-white">Central Config Required</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                    As a platform administrator, you can manage integration syncs for any company. 
                    Please select a specific company from the dropdown to begin auditing or configuring ports.
                </p>
            </div>
        </Card>
      ) : !company && !companyResult.error ? (
        <div className="p-12 text-center text-neutral-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium">Resolving tenant configuration...</p>
        </div>
      ) : (
        <>
            <FadeIn delay={0.05} className="space-y-6">
                <h2 className="text-sm font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-6">
                    <Brain className="h-4 w-4 text-indigo-500" />
                    Cognitive Oversight & Autonomy
                </h2>
                <IntegrationsContainer>
                    <BrainSyncCard token={sessionToken} />
                    <Card className="bg-indigo-500/5 border border-dashed border-indigo-500/20 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center gap-4 hover:bg-indigo-500/10 transition-colors group rounded-[2.5rem]">
                        <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Network className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-base font-bold text-indigo-400/80">Neural Node Scalability</p>
                            <p className="text-xs text-indigo-900/60 font-medium">Provision additional reasoning clusters.</p>
                        </div>
                        <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-indigo-500/40 hover:text-indigo-400 mt-4 disabled:opacity-50" disabled>
                            Coming Soon
                        </Button>
                    </Card>
                </IntegrationsContainer>
            </FadeIn>

            <FadeIn delay={0.1} className="space-y-6 pt-8">
                <h2 className="text-sm font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-6">
                    <Smartphone className="h-4 w-4 text-emerald-500" />
                    Financial & Communications
                </h2>
                <IntegrationsContainer>
                    {company && <MpesaSyncCard company={company} token={sessionToken} />}
                    {company && <JengaSyncCard company={company} token={sessionToken} />}
                    {company && <SmsSyncCard company={company} token={sessionToken} />}
                    {company && <WhatsAppSyncCard company={company} token={sessionToken} />}
                </IntegrationsContainer>
            </FadeIn>

            <FadeIn delay={0.2} className="space-y-6 pt-8">
                <h2 className="text-sm font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-6">
                    <MapIcon className="h-4 w-4 text-blue-500" />
                    Property & Geo-Services
                </h2>
                <IntegrationsContainer>
                    {company && <MapsSyncCard company={company} token={sessionToken} />}
                    {company && <ZuriSyncCard company={company} token={sessionToken} />}
                    <Card className="bg-white/[0.02] border border-dashed border-white/5 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center gap-4 hover:bg-white/5 transition-colors group rounded-[2.5rem]">
                        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plug className="h-8 w-8 text-neutral-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-base font-bold text-neutral-400">Add Another Connector</p>
                            <p className="text-xs text-neutral-600">ERP, SCADA, or legacy sources.</p>
                        </div>
                        <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white mt-4">
                            Browse Marketplace
                        </Button>
                    </Card>
                </IntegrationsContainer>
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
                <Card className="bg-neutral-900 border-white/10 overflow-hidden">
                    <CardHeader className="border-b border-white/5">
                        <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <History className="h-4 w-4 text-neutral-400" /> Payment Methods Mix
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {Object.entries(paymentMethodCounts).length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(paymentMethodCounts).map(([method, count]) => (
                                    <div key={method} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">{capitalize(method)}</span>
                                        <span className="text-2xl font-black text-white">{count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-neutral-600 font-medium italic text-xs">
                                No processed payments found for this channel.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-white/10 overflow-hidden">
                    <CardHeader className="border-b border-white/5">
                        <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-4 w-4 text-neutral-400" /> Maintenance Status Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {Object.entries(maintenanceStatusCounts).length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(maintenanceStatusCounts).map(([status, count]) => (
                                    <div key={status} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">{capitalize(status)}</span>
                                        <span className="text-2xl font-black text-white">{count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-neutral-600 font-medium italic text-xs">
                                No maintenance history available for this node.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
      )}
    </div>
  );
}
