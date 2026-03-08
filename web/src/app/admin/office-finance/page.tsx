import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listExpenses,
  listLeases,
  listPayments,
} from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";

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
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const [paymentsResult, expensesResult, leasesResult] = await Promise.all([
    listPayments(sessionToken),
    listExpenses(sessionToken),
    listLeases(sessionToken),
  ]);

  const payments = paymentsResult.data?.data ?? [];
  const expenses = expensesResult.data?.data ?? [];
  const leases = leasesResult.data?.data ?? [];

  const totalCollections = payments.reduce(
    (sum, payment) => sum + numeric(payment.amount),
    0,
  );
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + numeric(expense.amount),
    0,
  );
  const netCashflow = totalCollections - totalExpenses;

  const rentCollections = payments
    .filter((payment) => payment.type === "RENT")
    .reduce((sum, payment) => sum + numeric(payment.amount), 0);

  const activeLeases = leases.filter((lease) => lease.status === "ACTIVE").length;
  const pendingLeases = leases.filter((lease) => lease.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Office Finance</h1>
        <p className="text-sm text-neutral-300">Live cashflow, collections, and lease exposure.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Total Collections</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">
            {formatCurrency(totalCollections)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-400">
            {formatCurrency(totalExpenses)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Net Cashflow</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-semibold ${netCashflow >= 0 ? "text-white" : "text-red-300"}`}
          >
            {formatCurrency(netCashflow)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Rent Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(rentCollections)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.length > 0 ? (
              payments.slice(0, 8).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2"
                >
                  <div>
                    <p className="text-sm text-white">{payment.reference || payment.id}</p>
                    <p className="text-xs text-neutral-400">
                      {payment.type} • {payment.method}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {formatCurrency(numeric(payment.amount))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">
                {paymentsResult.error || "No payments found."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expenses.length > 0 ? (
              expenses.slice(0, 8).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2"
                >
                  <div>
                    <p className="text-sm text-white">{expense.description}</p>
                    <p className="text-xs text-neutral-400">{expense.category || "GENERAL"}</p>
                  </div>
                  <p className="text-sm font-medium text-red-300">
                    {formatCurrency(numeric(expense.amount))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">
                {expensesResult.error || "No expenses found."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Lease Exposure</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-neutral-200 sm:grid-cols-2">
          <div className="rounded border border-white/10 bg-white/5 p-3">
            Active leases: <span className="font-semibold text-white">{activeLeases}</span>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-3">
            Pending leases: <span className="font-semibold text-white">{pendingLeases}</span>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-3 sm:col-span-2">
            API status:{" "}
            {paymentsResult.error || expensesResult.error || leasesResult.error ? (
              <span className="font-semibold text-red-300">
                {paymentsResult.error || expensesResult.error || leasesResult.error}
              </span>
            ) : (
              <span className="font-semibold text-emerald-400">Connected</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
