import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listLandlords } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddLandlordButton, LandlordRowActions } from "./landlord-actions";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function LandlordsPage({
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

  const landlordsResult = await listLandlords(sessionToken, { page, search });
  const landlordsData = landlordsResult.data;
  const landlords = landlordsData?.data ?? [];
  const meta = landlordsData?.meta;

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/landlords?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/landlords");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/landlords?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Landlords</h1>
          <p className="text-sm text-neutral-300">Manage landlord profiles.</p>
        </div>
        <AddLandlordButton role={role} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search landlords by name or email..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {landlords.length ? (
            <div className="space-y-2">
              {landlords.map((landlord) => (
                <div key={landlord.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {landlord.firstName} {landlord.lastName}
                    </p>
                    <p className="text-xs text-neutral-400">{landlord.email || "No email"}</p>
                  </div>
                  <LandlordRowActions role={role} landlord={landlord} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">{landlordsResult.error || "No landlords found."}</p>
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
