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
  Loader2,
  Brain,
  Network
} from "lucide-react";
import { ZuriSyncCard } from "./zuri-sync-card";
import { MpesaSyncCard } from "./mpesa-sync-card";
import { JengaSyncCard } from "./jenga-sync-card";
import { SmsSyncCard } from "./sms-sync-card";
import { MapsSyncCard } from "./maps-sync-card";
import { WhatsAppSyncCard } from "./whatsapp-sync-card";
import { BrainSyncCard } from "./brain-sync-card";
import { CompanySelector } from "../settings/company-selector";
import { IntegrationsClientComponent, FadeIn } from "./integrations-client";
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
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal font-serif text-[#141413] tracking-tight">
            Integrations
          </h1>
          <p className="text-[#73726c] text-sm">
            Operational sync health and 3rd-party service configuration.
          </p>
        </div>
      </div>

      {role === "SUPER_ADMIN" && allCompanies.length > 0 && (
        <CompanySelector 
          companies={allCompanies} 
          currentCompanyId={effectiveCompanyId || ""} 
        />
      )}

      {/* Global & Company Health Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-[#9c9a92]" /> Payments Logged
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-normal font-serif text-[#141413]">
            {payments.length}
          </CardContent>
        </Card>
        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[#9c9a92]" /> Maintenance Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-normal font-serif text-[#141413]">
            {maintenance.length}
          </CardContent>
        </Card>
        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-[#9c9a92]" /> Gateway Integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold text-[#141413]">
            {paymentsResult.error || maintenanceResult.error || companyResult.error ? (
              <span className="text-red-800 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" />
                {companyResult.error || paymentsResult.error || maintenanceResult.error}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> Operational
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {!effectiveCompanyId && role === "SUPER_ADMIN" ? (
        <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-12 flex flex-col items-center text-center gap-4 shadow-none">
            <div className="h-16 w-16 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center">
                <Plug className="h-8 w-8 text-[#141413]" />
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-[#141413]">Central Config Required</h3>
                <p className="text-[#73726c] text-sm leading-relaxed">
                    As a platform administrator, you can manage integration syncs for any company. 
                    Please select a specific company from the dropdown to begin auditing or configuring ports.
                </p>
            </div>
        </Card>
      ) : !company && !companyResult.error ? (
        <div className="p-12 text-center text-[#73726c]">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#1f1e1d]" />
            <p className="text-sm font-medium">Resolving tenant configuration...</p>
        </div>
      ) : (
        <IntegrationsClientComponent
          company={company}
          token={sessionToken}
          paymentMethodCounts={paymentMethodCounts}
          maintenanceStatusCounts={maintenanceStatusCounts}
          paymentsCount={payments.length}
          maintenanceCount={maintenance.length}
          gatewayStatusError={paymentsResult.error || maintenanceResult.error || companyResult.error}
        />
      )}
    </div>
  );
}
