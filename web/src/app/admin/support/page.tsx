import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMaintenanceRequests, listPayments } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";

function highlightStatus(status: string | undefined) {
  if (!status) return "Unknown";
  return status.replace("_", " ");
}

export default async function SupportPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const [maintenanceResult, paymentResult] = await Promise.all([
    listMaintenanceRequests(sessionToken),
    listPayments(sessionToken),
  ]);

  const maintenance = maintenanceResult.data?.data ?? [];
  const payments = paymentResult.data?.data ?? [];

  const openTickets = maintenance.filter(
    (request) => request.status && request.status !== "COMPLETED" && request.status !== "CANCELLED",
  );
  const urgentTickets = maintenance.filter((request) =>
    ["HIGH", "URGENT"].includes(request.priority ?? "MEDIUM"),
  );

  const paymentMethods = payments.reduce<Record<string, number>>((counts, payment) => {
    const method = payment.method ?? "UNKNOWN";
    counts[method] = (counts[method] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="text-sm text-neutral-300">Issue tracking and operational support desk.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{openTickets.length}</CardContent>
          <CardContent className="text-xs text-neutral-400">Needs technician follow-up</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Urgent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-400">{urgentTickets.length}</CardContent>
          <CardContent className="text-xs text-neutral-400">High-priority incidents</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Payments Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">{payments.length}</CardContent>
          <CardContent className="text-xs text-neutral-400">Recent cash intake samples</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Ticket Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {maintenance.length ? (
            maintenance.slice(0, 6).map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-white">{ticket.title || ticket.category || "General"}</p>
                  <p className="text-xs text-neutral-400">
                    {highlightStatus(ticket.status)} • {ticket.priority ?? "MEDIUM"}
                  </p>
                </div>
                <p className="text-xs text-neutral-400">{ticket.propertyId}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{maintenanceResult.error || "No tickets available yet."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Payments by Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(paymentMethods).length ? (
            Object.entries(paymentMethods).map(([method, count]) => (
              <div
                key={method}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-sm text-white">{method}</p>
                <p className="text-sm font-medium text-white">{count}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{paymentResult.error || "No payment data yet."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
