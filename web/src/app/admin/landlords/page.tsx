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
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal font-serif text-[#141413] tracking-tight">Landlords</h1>
          <p className="text-sm text-[#73726c]">Manage landlord profiles.</p>
        </div>
        <AddLandlordButton role={role} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search landlords by name or email..."
            defaultValue={search}
            className="h-10 bg-[#ffffff] border-[#dedcd1] text-sm text-[#141413] placeholder-[#9c9a92] focus:border-[#1f1e1d] focus:outline-none rounded-[9.6px] shadow-none"
          />
        </form>
      </div>

      <Card className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] shadow-none">
        <CardHeader>
          <CardTitle className="text-xs font-bold text-[#73726c] uppercase tracking-widest">Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {landlords.length ? (
            <div className="space-y-2">
              {landlords.map((landlord) => (
                <div key={landlord.id} className="flex items-center justify-between rounded-[16px] border border-[#dedcd1] bg-[#ffffff] hover:bg-[#f0eee6] p-4 transition-all shadow-none">
                  <div>
                    <p className="text-sm font-bold text-[#1f1e1d]">
                      {landlord.firstName} {landlord.lastName}
                    </p>
                    <p className="text-xs text-[#73726c]">{landlord.email || "No email"}</p>
                  </div>
                  <LandlordRowActions role={role} landlord={landlord} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#73726c] italic">{landlordsResult.error || "No landlords found."}</p>
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
