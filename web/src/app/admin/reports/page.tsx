import {
  fetchAuditLogs,
  fetchReportSummary,
  fetchReportOccupancy,
  fetchReportRevenue,
  listProperties,
  listTenants
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";

  const [auditResult, summaryResult, occupancyResult, revenueResult, propertiesResult, tenantsResult] = await Promise.all([
    role === "SUPER_ADMIN" ? fetchAuditLogs(sessionToken) : Promise.resolve({ data: null, error: null }),
    fetchReportSummary(sessionToken),
    fetchReportOccupancy(sessionToken),
    fetchReportRevenue(sessionToken),
    listProperties(sessionToken, { limit: 100 }),
    listTenants(sessionToken, { limit: 1000 }),
  ]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <ReportsClient
        summary={summaryResult.data}
        occupancy={occupancyResult.data}
        revenue={revenueResult.data}
        auditLogs={auditResult.data}
        role={role}
        token={sessionToken}
        properties={propertiesResult.data?.data ?? []}
        tenants={tenantsResult.data?.data ?? []}
      />
    </div>
  );
}
