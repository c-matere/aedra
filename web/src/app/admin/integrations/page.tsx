import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listMaintenanceRequests,
  listPayments,
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default async function IntegrationsPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const [paymentsResult, maintenanceResult] = await Promise.all([
    listPayments(sessionToken),
    listMaintenanceRequests(sessionToken),
  ]);

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-neutral-300">
          Operational sync health for payments, maintenance, and accounting connectors.
        </p>
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
