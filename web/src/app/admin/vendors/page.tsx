import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExpenses } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function VendorsPage() {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";
  const expensesResult = await listExpenses(sessionToken);
  const expenses = expensesResult.data?.data ?? [];

  const vendorTotals = expenses.reduce<Map<string, number>>((map, expense) => {
    const vendor = expense.vendor?.trim();
    if (!vendor) {
      return map;
    }

    map.set(vendor, (map.get(vendor) ?? 0) + (expense.amount ?? 0));
    return map;
  }, new Map());

  const vendors = Array.from(vendorTotals)
    .map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total);

  const overallSpend = vendors.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
        <p className="text-sm text-neutral-300">Service providers and contractor spend.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Total Spend</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(overallSpend)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Vendors Tracked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">
            {vendors.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-300">Top Vendor</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-200">
            {vendors[0]
              ? `${vendors[0].vendor} • ${formatCurrency(vendors[0].total)}`
              : "No vendors in expenses yet."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-neutral-300">Vendor Spend Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vendors.length ? (
            vendors.map((entry) => (
              <div
                key={entry.vendor}
                className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-sm text-white">{entry.vendor}</p>
                <p className="text-sm font-medium text-white">{formatCurrency(entry.total)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-400">
              {expensesResult.error || "Expenses API returned no vendor data."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
