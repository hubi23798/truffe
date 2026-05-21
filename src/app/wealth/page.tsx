import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getNetWorthNow, getNetWorthHistory } from "@/lib/net-worth/engine";
import { buildForecast } from "@/lib/net-worth/forecast";
import { ForecastChart } from "./forecast-chart";
import { env } from "@/env";

function fmt(minor: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
}

export default async function WealthPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [nw, history] = await Promise.all([
    getNetWorthNow(db),
    getNetWorthHistory(db, 180),
  ]);
  const forecast = buildForecast(history, today);

  const kindLabel: Record<string, string> = {
    cash: "Cash",
    investment: "Investments",
    crypto: "Crypto",
    pension: "Pension",
    property: "Property",
    other_asset: "Other assets",
    liability: "Liabilities",
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Wealth</h1>
        <p className="text-fg-muted mt-1 text-xs">As of {nw.asOf}</p>
      </div>

      {/* Net worth hero */}
      <div className="border-border-subtle rounded-xl border p-6">
        <p className="text-fg-muted text-sm">Net worth</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{fmt(nw.netWorth)}</p>
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <p className="text-fg-muted text-xs">Assets</p>
            <p className="font-medium text-green-600 dark:text-green-400">{fmt(nw.assets)}</p>
          </div>
          <div>
            <p className="text-fg-muted text-xs">Liabilities</p>
            <p className="font-medium text-red-600 dark:text-red-400">{fmt(nw.liabilities)}</p>
          </div>
        </div>
      </div>

      {/* Breakdown by kind */}
      {Object.entries(nw.byKind).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Breakdown</h2>
          <div className="divide-border-subtle divide-y rounded-lg border text-sm">
            {Object.entries(nw.byKind)
              .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
              .map(([kind, amount]) => (
                <div key={kind} className="flex items-center justify-between px-3 py-2">
                  <span>{kindLabel[kind] ?? kind}</span>
                  <span className={amount < 0 ? "text-red-600 dark:text-red-400" : ""}>
                    {fmt(amount)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Accounts */}
      {nw.accounts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            <a href="/wealth/accounts" className="hover:underline">
              Accounts →
            </a>
          </h2>
          <div className="divide-border-subtle divide-y rounded-lg border text-sm">
            {nw.accounts.map((acct) => (
              <a
                key={acct.id}
                href={`/wealth/accounts/${acct.id}`}
                className="flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div>
                  <p className="font-medium">{acct.name}</p>
                  <p className="text-fg-muted text-xs">{acct.currency} · {acct.kind}</p>
                </div>
                <span className={acct.balanceNative < 0 ? "text-red-600 dark:text-red-400" : ""}>
                  {fmt(acct.balanceNative, acct.currency)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Forecast */}
      {forecast.points.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Forecast</h2>
          <div className="border-border-subtle rounded-xl border p-4">
            <ForecastChart points={forecast.points} currency="EUR" />
            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <p className="text-fg-muted text-xs">In 12 months</p>
                <p className="font-medium">{fmt(forecast.projected12m)}</p>
              </div>
              <div>
                <p className="text-fg-muted text-xs">Monthly trend</p>
                <p className={`font-medium ${forecast.monthlyDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {forecast.monthlyDelta >= 0 ? "+" : ""}{fmt(forecast.monthlyDelta)}/mo
                </p>
              </div>
            </div>
          </div>
          <p className="text-fg-muted text-xs">
            Based on {history.length} daily snapshots · linear trend from {history[0]?.date}
          </p>
        </section>
      )}
    </main>
  );
}
