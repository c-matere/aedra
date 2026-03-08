import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listLeases,
  listTenants,
  listUnits,
  listProperties,
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddLeaseButton, LeaseRowActions } from "./lease-actions";
import { LeaseHistory } from "./lease-history";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const tenantId = typeof resolvedParams.tenantId === "string" ? resolvedParams.tenantId : undefined;
  const page = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) : 1;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : "";

  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";

  const [leasesResult, tenantsResult, unitsResult, propertiesResult] = await Promise.all([
    listLeases(sessionToken, { tenantId, page, search }),
    listTenants(sessionToken, { limit: 100 }),
    listUnits(sessionToken, { limit: 100 }),
    listProperties(sessionToken, { limit: 100 }),
  ]);

  const leasesData = leasesResult.data;
  const tenants = tenantsResult.data?.data ?? [];
  const units = unitsResult.data?.data ?? [];
  const properties = propertiesResult.data?.data ?? [];

  const activeTenant = tenantId ? tenants.find(t => t.id === tenantId) : null;

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (tenantId) params.set("tenantId", tenantId);
    redirect(`/admin/leases?${params.toString()}`);
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tenantId) params.set("tenantId", tenantId);
    params.set("page", newPage.toString());
    redirect(`/admin/leases?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {activeTenant ? `Leases for ${activeTenant.firstName} ${activeTenant.lastName}` : "Leases"}
          </h1>
          <p className="text-sm text-neutral-300">Lease lifecycle management.</p>
        </div>
        <AddLeaseButton role={role} tenants={tenants} units={units} properties={properties} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search leases by tenant name, unit or property name..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Lease Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leasesData?.data?.length ? (
            leasesData.data.map((lease) => (
              <div key={lease.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                <LeaseHistory
                  leaseId={lease.id}
                  leaseTitle={lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : lease.id}
                >
                  <div className="flex-1 cursor-pointer group">
                    <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                      {lease.tenant
                        ? `${lease.tenant.firstName} ${lease.tenant.lastName}`
                        : lease.tenantId}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {lease.unit?.unitNumber || lease.unitId} • KSH {lease.rentAmount.toLocaleString()} • {lease.status}
                    </p>
                  </div>
                </LeaseHistory>
                <div className="flex items-center gap-2">
                  <LeaseRowActions
                    role={role}
                    lease={lease}
                    tenants={tenants}
                    units={units}
                    properties={properties}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{leasesResult.error || "No leases found."}</p>
          )}

          {leasesData?.meta && (
            <Pagination
              currentPage={leasesData.meta.page}
              totalPages={leasesData.meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
