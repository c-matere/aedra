import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listLeases, listInvoices } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddInvoiceButton, InvoiceRowActions } from "./invoice-actions";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function InvoicesPage({
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

  const invoices = await listInvoices(sessionToken, { page, search });
  const leases = await listLeases(sessionToken, { limit: 100 }); // Increase limit for creation dropdown

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/invoices?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/invoices");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/invoices?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-sm text-neutral-300">Billing and invoice lifecycle.</p>
        </div>
        <AddInvoiceButton role={role} leases={leases.data?.data ?? []} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search invoices by description or tenant name..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Invoice Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.data?.data?.length ? (
            invoices.data.data.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white">
                      {invoice.lease?.tenant
                        ? `${invoice.lease.tenant.firstName} ${invoice.lease.tenant.lastName}`
                        : invoice.leaseId}
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {invoice.type}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    KSH {invoice.amount.toLocaleString()} • Due {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1 italic truncate max-w-2xl" title={invoice.description}>
                    {invoice.description}
                  </p>
                </div>
                <InvoiceRowActions role={role} invoice={invoice} leases={leases.data?.data ?? []} token={sessionToken} />
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{invoices.error || "No invoices found."}</p>
          )}

          {invoices.data?.meta && (
            <Pagination
              currentPage={invoices.data.meta.page}
              totalPages={invoices.data.meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
