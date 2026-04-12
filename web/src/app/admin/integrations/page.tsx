import {
  listMaintenanceRequests,
  listPayments,
  fetchMe,
  getCompany
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { 
  Plug, 
  Activity, 
  Database, 
  ShieldCheck, 
  Smartphone,
  Map as MapIcon,
  CreditCard,
  History,
  AlertCircle
} from "lucide-react";
import { ZuriSyncCard } from "./zuri-sync-card";
import { MpesaSyncCard } from "./mpesa-sync-card";
import { SmsSyncCard } from "./sms-sync-card";
import { MapsSyncCard } from "./maps-sync-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default async function IntegrationsPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  
  let paymentsResult, maintenanceResult, meResult;
  try {
    [paymentsResult, maintenanceResult, meResult] = await Promise.all([
      listPayments(sessionToken),
      listMaintenanceRequests(sessionToken),
      fetchMe(sessionToken)
    ]);
  } catch (error) {
    console.error("[IntegrationsPage] Data fetch error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-white">Interface Sync Failure</h2>
        <p className="text-neutral-400">We couldn't connect to the integration heartbeat. Please check your network or try again.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 text-white">Retry Connection</Button>
      </div>
    );
  }

  const companyId = meResult.data?.user?.companyId;
  const companyResult = companyId ? await getCompany(sessionToken, companyId) : { data: null, error: null };
  const company = companyResult.data;

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
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md flex items-center gap-3">
            <Plug className="h-8 w-8 text-blue-400" />
            Integrations
          </h1>
          <p className="text-neutral-400 text-sm font-medium">
            Operational sync health and 3rd-party service configuration.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="h-3 w-3 text-emerald-400" /> Payments Processed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">
            {payments.length}
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3 text-blue-400" /> Maintenance Tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black text-white group-hover:translate-x-1 transition-transform">
            {maintenance.length}
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Database className="h-3 w-3 text-purple-400" /> API Gateway Status
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold text-neutral-200">
            {paymentsResult.error || maintenanceResult.error ? (
              <span className="text-red-400">
                {paymentsResult.error || maintenanceResult.error}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> Operational
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-500" />
            Financial & Communications
          </h2>
          
          {company && <MpesaSyncCard company={company} token={sessionToken} />}
          {company && <SmsSyncCard company={company} token={sessionToken} />}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-blue-500" />
            Geo-Services
          </h2>
          
          {company && <MapsSyncCard company={company} token={sessionToken} />}
        </div>
      </div>

      <div className="space-y-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            Property Management & Historical Sync
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {company && <ZuriSyncCard company={company} token={sessionToken} />}
            
            <Card className="bg-white/[0.02] border-dashed border-white/10 flex flex-col items-center justify-center p-8 text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                <Plug className="h-6 w-6 text-neutral-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-400">Add Another Connector</p>
                <p className="text-xs text-neutral-600">ERP, SCADA, or legacy data source.</p>
              </div>
              <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Browse Marketplace
              </Button>
            </Card>
          </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Payments Processed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">
            {payments.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Maintenance Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {maintenance.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Last API Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-200">
            {paymentsResult.error || maintenanceResult.error ? (
              <span className="text-red-400">
                {paymentsResult.error || maintenanceResult.error}
              </span>
            ) : (
              "Connected to Payments & Maintenance APIs"
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(paymentMethodCounts).length ? (
            Object.entries(paymentMethodCounts).map(([method, count]) => (
              <div
                key={method}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-sm text-white">{capitalize(method)}</p>
                <p className="text-sm font-medium text-white">{count}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">No payment captures yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Maintenance Status Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(maintenanceStatusCounts).length ? (
            Object.entries(maintenanceStatusCounts).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-sm text-white">{capitalize(status)}</p>
                <p className="text-sm font-medium text-white">{count}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">
              {maintenanceResult.error || "No maintenance tickets logged yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
