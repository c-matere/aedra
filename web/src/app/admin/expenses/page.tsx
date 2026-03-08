import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExpenses, listProperties } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddExpenseButton, ExpenseRowActions } from "./expense-actions";

import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function ExpensesPage({
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

  const [expensesResult, propertiesResult] = await Promise.all([
    listExpenses(sessionToken, { page, search }),
    listProperties(sessionToken, { limit: 100 }),
  ]);

  const expenses = expensesResult.data;
  const properties = propertiesResult.data?.data ?? [];

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/expenses?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/expenses");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/expenses?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-sm text-neutral-300">Expense tracking and approvals.</p>
        </div>
        <AddExpenseButton role={role} properties={properties} />
      </div>

      <div className="flex items-center gap-2">
        <form action={onSearchAction} className="flex-1">
          <Input
            name="search"
            placeholder="Search expenses by description, vendor or reference..."
            defaultValue={search}
            className="bg-neutral-900 border-neutral-800 text-white"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {expenses?.data?.length ? (
            expenses.data.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-sm font-medium text-white">{expense.description}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>KSH {expense.amount.toLocaleString()}</span>
                    {expense.vendor && <span className="px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{expense.vendor}</span>}
                  </div>
                </div>
                <ExpenseRowActions role={role} expense={expense} properties={properties} />
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">{expensesResult.error || "No expenses found."}</p>
          )}

          {expenses?.meta && (
            <Pagination
              currentPage={expenses.meta.page}
              totalPages={expenses.meta.totalPages}
              onPageChange={onPageChangeAction}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
