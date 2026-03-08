import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMaintenanceRequests, listTenants } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";

function formatCount(value: number) {
  return value.toLocaleString("en-KE");
}

export default async function NotificationsPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const [tenantResult, maintenanceResult] = await Promise.all([
    listTenants(sessionToken),
    listMaintenanceRequests(sessionToken),
  ]);

  const tenants = tenantResult.data?.data ?? [];
  const maintenance = maintenanceResult.data?.data ?? [];

  const tenantStatusCounts = tenants.reduce<Record<string, number>>((counts, tenant) => {
    const status = (tenant.status ?? "UNKNOWN").toUpperCase();
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  const expiringStatuses = ["EXPIRING", "EXPIRING SOON", "TERMINATING"];
  const expiringCount = expiringStatuses.reduce(
    (sum, status) => sum + (tenantStatusCounts[status] ?? 0),
    0,
  );

  const overdueCount = tenantStatusCounts["OVERDUE"] ?? 0;
  const activeCount = tenantStatusCounts["ACTIVE"] ?? 0;

  const pendingTickets = maintenance.filter(
    (request) => request.status && request.status !== "COMPLETED" && request.status !== "CANCELLED",
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="text-sm text-neutral-300">Communication center for tenant and staff alerts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Audience</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCount(tenants.length)}
          </CardContent>
          <CardContent className="text-xs text-neutral-400">Tenants subscribed to alerts</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">
            {formatCount(activeCount)}
          </CardContent>
          <CardContent className="text-xs text-neutral-400">Accounts with current leases</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-400">
            {formatCount(expiringCount)}
          </CardContent>
          <CardContent className="text-xs text-neutral-400">Need reminder campaigns</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-400">
            {formatCount(overdueCount)}
          </CardContent>
          <CardContent className="text-xs text-neutral-400">Payment escalation alerts</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Maintenance Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingTickets.length ? (
            pendingTickets.slice(0, 6).map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-white">{ticket.title || "Untitled request"}</p>
                  <p className="text-xs text-neutral-400">
                    {ticket.priority || "MEDIUM"} • {ticket.status || "REPORTED"}
                  </p>
                </div>
                <p className="text-xs text-neutral-400">{ticket.propertyId}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">
              {maintenanceResult.error ?? "No pending maintenance alerts."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Tenant Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-neutral-200">
          {Object.entries(tenantStatusCounts).slice(0, 6).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2">
              <span>{status}</span>
              <span className="font-semibold">{formatCount(count)}</span>
            </div>
          ))}
          {Object.keys(tenantStatusCounts).length === 0 && (
            <p className="text-sm text-neutral-400">No tenant status data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
