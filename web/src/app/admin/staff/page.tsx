import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listUsers, listInvitations } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddStaffButton, StaffRowActions } from "./staff-actions";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function StaffPage({
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

  const usersResult = await listUsers(sessionToken, { page, search });
  const usersData = usersResult.data;
  const users = usersData?.data ?? [];
  const meta = usersData?.meta;

  const invitationsRes = await listInvitations(sessionToken);
  const invitations = invitationsRes.data ?? [];

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/staff?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/staff");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/staff?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff</h1>
          <p className="text-sm text-neutral-300">Team access and role administration.</p>
        </div>
        <AddStaffButton role={role} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search users by name or email..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      {invitations.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-amber-400">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {invite.firstName} {invite.lastName}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {invite.email}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/20 text-amber-400">
                      {invite.role}
                    </span>
                    <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 italic">
                      Pending acceptance
                    </span>
                    {(invite as any).company && (
                      <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        {(invite as any).company.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">User Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.length ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {user.email}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${user.role === 'SUPER_ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                        user.role === 'COMPANY_ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-neutral-500/20 text-neutral-400'
                        }`}>
                        {user.role}
                      </span>
                      {user.isActive
                        ? <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Active</span>
                        : <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Inactive</span>
                      }
                      {user.permissions && user.permissions.length > 0 && (
                        <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          {user.permissions.length} permission{user.permissions.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <StaffRowActions role={role} user={user} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">{usersResult.error || "No users found."}</p>
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
