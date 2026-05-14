import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getNetWorthNow } from "@/lib/net-worth/engine";
import { transaction } from "@/lib/db/schema";
import { env } from "@/env";
import { Badge } from "@/components/ui/badge";

function fmt(minor: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const [nw, recentTxns, uncategorizedCount] = await Promise.all([
    getNetWorthNow(db),
    db.query.transaction.findMany({
      orderBy: [desc(transaction.startedAt)],
      limit: 5,
      columns: {
        id: true,
        startedAt: true,
        amountNative: true,
        currency: true,
        descriptionRaw: true,
        categoryId: true,
        accountId: true,
      },
    }),
    db.$count(transaction, isNull(transaction.categoryId)),
  ]);

  const categoryIds = [...new Set(recentTxns.map((t) => t.categoryId).filter(Boolean) as string[])];
  const categories = categoryIds.length > 0
    ? await db.query.category.findMany({
        where: (cat, { inArray }) => inArray(cat.id, categoryIds),
        columns: { id: true, name: true },
      })
    : [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));

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
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Financial Position hero */}
      <div className="border-border-subtle rounded-xl border p-6">
        <p className="text-fg-muted text-sm">Net worth · as of {nw.asOf}</p>
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
        {Object.entries(nw.byKind).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(nw.byKind)
              .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
              .map(([kind, amount]) => (
                <div key={kind} className="text-fg-muted text-xs">
                  <span>{kindLabel[kind] ?? kind}: </span>
                  <span className={amount < 0 ? "text-red-600 dark:text-red-400" : "text-fg-default"}>
                    {fmt(amount)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Next Actions */}
      {uncategorizedCount > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Next actions</h2>
          <a
            href="/transactions/inbox"
            className="border-border-subtle flex items-center justify-between rounded-lg border p-3 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div>
              <p className="text-sm font-medium">Categorize transactions</p>
              <p className="text-fg-muted text-xs">{uncategorizedCount} uncategorized transactions</p>
            </div>
            <Badge variant="warning">{uncategorizedCount}</Badge>
          </a>
        </section>
      )}

      {/* Recent Transactions */}
      {recentTxns.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            <a href="/transactions" className="hover:underline">Recent transactions →</a>
          </h2>
          <div className="divide-border-subtle divide-y rounded-lg border text-sm">
            {recentTxns.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate">{txn.descriptionRaw || "—"}</p>
                  <p className="text-fg-muted text-xs">
                    {new Date(txn.startedAt).toLocaleDateString("en-IE")}
                    {txn.categoryId
                      ? ` · ${catName.get(txn.categoryId) ?? ""}`
                      : " · "}
                    {!txn.categoryId && (
                      <span className="text-warning">uncategorized</span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium ${
                    txn.amountNative < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {fmt(txn.amountNative, txn.currency)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          { href: "/wealth/accounts", label: "Accounts", sub: `${nw.accounts.length} accounts` },
          { href: "/settings/import", label: "Import CSV", sub: "Revolut CSV" },
          { href: "/settings/categories", label: "Categories", sub: "Manage" },
          { href: "/settings/rules", label: "Rules", sub: "Auto-categorize" },
          { href: "/settings/accounts", label: "Manage accounts", sub: "Rename · archive" },
          { href: "/settings/profile", label: "Profile", sub: "Preferences" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="border-border-subtle rounded-lg border p-3 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <p className="font-medium">{item.label}</p>
            <p className="text-fg-muted text-xs">{item.sub}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
