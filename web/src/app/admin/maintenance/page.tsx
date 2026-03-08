import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listMaintenanceRequests,
  listProperties,
  listUnits,
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddMaintenanceButton, MaintenanceRowActions } from "./maintenance-actions";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search || "";

  const [requestsResult, propertiesResult, unitsResult] = await Promise.all([
    listMaintenanceRequests(sessionToken, { page, search }),
    listProperties(sessionToken, { limit: 100 }),
    listUnits(sessionToken, { limit: 1000 }),
  ]);

  const requestsData = requestsResult.data;
  const requests = requestsData?.data ?? [];
  const meta = requestsData?.meta;

  const properties = propertiesResult.data?.data ?? [];
  const units = unitsResult.data?.data ?? [];

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/maintenance?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/maintenance");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/maintenance?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Maintenance</h1>
          <p className="text-sm text-neutral-300">Operational maintenance workspace.</p>
        </div>
        <AddMaintenanceButton role={role} properties={properties} units={units} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search maintenance requests by title or description..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length ? (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{request.title}</p>
                    <p className="text-xs text-neutral-400">
                      {request.priority || "MEDIUM"} • {request.category || "GENERAL"} • {request.status || "REPORTED"}
                    </p>
                  </div>
                  <MaintenanceRowActions
                    role={role}
                    request={request}
                    properties={properties}
                    units={units}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">{requestsResult.error || "No maintenance requests found."}</p>
          )}

          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
