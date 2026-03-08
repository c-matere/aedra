import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listLeases, listPayments } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddPaymentButton, PaymentRowActions } from "./payment-actions";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function PaymentsPage({
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

  const paymentsResult = await listPayments(sessionToken, { page, search });
  const leases = await listLeases(sessionToken);

  const paymentsData = paymentsResult.data;

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/payments?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/payments");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/payments?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-sm text-neutral-300">Payment operations dashboard.</p>
        </div>
        <AddPaymentButton role={role} leases={leases.data?.data ?? []} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search payments by reference or tenant name..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Payments Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paymentsData?.data?.length ? (
            paymentsData.data.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white">
                      {payment.lease?.tenant
                        ? `${payment.lease.tenant.firstName} ${payment.lease.tenant.lastName}`
                        : payment.leaseId}
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {payment.type}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    KSH {payment.amount.toLocaleString()} • {payment.method} {payment.reference ? `• Ref: ${payment.reference}` : ""}
                  </p>
                </div>
                <PaymentRowActions role={role} payment={payment} leases={leases.data?.data ?? []} />
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{paymentsResult.error || "No payments found."}</p>
          )}

          {paymentsData?.meta && (
            <Pagination
              currentPage={paymentsData.meta.page}
              totalPages={paymentsData.meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
