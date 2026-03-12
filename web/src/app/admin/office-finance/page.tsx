import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getOfficeSummary,
  listOfficeIncome,
  listOfficeExpenses,
} from "@/lib/backend-api";
import { getSessionTokenFromCookie, getRoleFromCookie } from "@/lib/cookie-utils";
import { OfficeFinanceActions } from "./office-finance-actions";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function numeric(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export default async function OfficeFinancePage() {
  const token = await getSessionTokenFromCookie();
  const role = await getRoleFromCookie();
  const sessionToken = token || "";

  const [summaryResult, incomeResult, expensesResult] = await Promise.all([
    getOfficeSummary(sessionToken),
    listOfficeIncome(sessionToken),
    listOfficeExpenses(sessionToken),
  ]);

  const summary = summaryResult.data ?? { income: 0, expenses: 0, net: 0 };
  const incomeList = incomeResult.data ?? [];
  const expensesList = expensesResult.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Office Finance</h1>
          <p className="text-sm text-neutral-300">Company income (commissions) and operational expenses.</p>
        </div>
        <OfficeFinanceActions role={role} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-neutral-900 border-white/10 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{formatCurrency(summary.income)}</div>
            <p className="text-xs text-neutral-500 mt-1">Commissions & management fees</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-white/10 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-400">Total Office Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{formatCurrency(summary.expenses)}</div>
            <p className="text-xs text-neutral-500 mt-1">Salaries, rent, utilities, etc.</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-white/10 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-400">Net Office Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${summary.net >= 0 ? "text-white" : "text-rose-300"}`}>
              {formatCurrency(summary.net)}
            </div>
            <p className="text-xs text-neutral-500 mt-1">Operational residue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-neutral-900 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Income Stream (Recent)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomeList.length > 0 ? (
              incomeList.slice(0, 10).map((income) => (
                <div
                  key={income.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white line-clamp-1">{income.description || income.category}</p>
                    <p className="text-xs text-neutral-400">
                      {income.property?.name ? `${income.property.name} • ` : ""}{new Date(income.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-400">
                    +{formatCurrency(numeric(income.amount))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400 py-4 text-center">
                {incomeResult.error || "No office income recorded yet."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Office Expenses (Recent)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expensesList.length > 0 ? (
              expensesList.slice(0, 10).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white">{expense.description}</p>
                    <p className="text-xs text-neutral-400">
                      {expense.category} • {new Date(expense.date || expense.id).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-rose-300">
                    -{formatCurrency(numeric(expense.amount))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400 py-4 text-center">
                {expensesResult.error || "No office expenses found."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-neutral-900 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Financial Summary Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-neutral-200 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-neutral-500 mb-1">Total Income Records</div>
            <div className="text-xl font-semibold text-white">{incomeList.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-neutral-500 mb-1">Total Expense Records</div>
            <div className="text-xl font-semibold text-white">{expensesList.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 sm:col-span-2">
            <div className="text-neutral-500 mb-1">Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-medium">Real-time tracking enabled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
