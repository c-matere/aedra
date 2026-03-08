import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listProperties, listUnits } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddUnitButton } from "./unit-actions";
import { UnitsList } from "./units-list";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function UnitsPage({
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

  const [unitsResult, propertiesResult] = await Promise.all([
    listUnits(sessionToken, { page, search }),
    listProperties(sessionToken, { limit: 100 }),
  ]);

  const unitsData = unitsResult.data;
  const properties = propertiesResult.data?.data ?? [];

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/units?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/units");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/units?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Units</h1>
          <p className="text-sm text-neutral-300">Unit inventory and occupancy management.</p>
        </div>
        <AddUnitButton role={role} properties={properties} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search units by unit number or property name..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UnitsList units={unitsData?.data ?? []} properties={properties} role={role} />

          {unitsData?.meta && (
            <Pagination
              currentPage={unitsData.meta.page}
              totalPages={unitsData.meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
