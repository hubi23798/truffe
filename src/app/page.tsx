import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getNetWorthNow } from "@/lib/net-worth/engine";
import { getMonthlySummary, monthLabel, prevMonth } from "@/lib/summary";
import { advisorConversation, PRIMARY_USER_ID, transaction } from "@/lib/db/schema";
import { env } from "@/env";
import { Badge } from "@/components/ui/badge";

function fmt(minor: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
}

function fmtSigned(minor: number, currency = "EUR") {
  const abs = new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(
    Math.abs(minor) / 100,
  );
  return minor >= 0 ? `+${abs}` : `−${abs}`;
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  const prev = prevMonth(curYear, curMonth);

  const [nw, thisMo, lastMo, recentTxns, uncategorizedCount] = await Promise.all([
    getNetWorthNow(db),
    getMonthlySummary(db, curYear, curMonth),
    getMonthlySummary(db, prev.year, prev.month),
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
      },
    }),
    db.$count(transaction, isNull(transaction.categoryId)),
  ]);

  const categoryIds = [
    ...new Set(
      [...recentTxns.map((t) => t.categoryId), ...thisMo.topCategories.map((c) => c.id)].filter(
        Boolean,
      ) as string[],
    ),
  ];
  const categoriesData =
    categoryIds.length > 0
      ? await db.query.category.findMany({
          where: (cat, { inArray }) => inArray(cat.id, categoryIds),
          columns: { id: true, name: true },
        })
      : [];
  const catName = new Map(categoriesData.map((c) => [c.id, c.name]));

  const netDelta = thisMo.net - lastMo.net;

  async function createConversationWithQuestion(q: string) {
    "use server";
    const cookieStore2 = await cookies();
    const sid2 = cookieStore2.get(env().SESSION_COOKIE_NAME)?.value;
    if (!sid2) redirect("/login");
    const db2 = getDb();
    const sess2 = await readSession(db2, sid2);
    if (!sess2) redirect("/login");
    const [conv] = await db2
      .insert(advisorConversation)
      .values({ userId: PRIMARY_USER_ID, title: q.slice(0, 60) })
      .returning({ id: advisorConversation.id });
    redirect(`/advisor/c/${conv!.id}?q=${encodeURIComponent(q)}`);
  }

  const kindLabel: Record<string, string> = {
    cash: "Cash",
    investment: "Investments",
    crypto: "Crypto",
    pension: "Pension",
    property: "Property",
    other_asset: "Other assets",
    liability: "Liabilities",
  };

  const hasMonthlyData = thisMo.income > 0 || thisMo.expenses < 0;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Net worth hero */}
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

      {/* This month summary */}
      {hasMonthlyData && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">This month</h2>
            <span className="text-fg-muted text-xs">{monthLabel(curYear, curMonth)}</span>
          </div>

          <div className="border-border-subtle grid grid-cols-3 rounded-xl border text-sm">
            <div className="p-4">
              <p className="text-fg-muted text-xs">Income</p>
              <p className="mt-1 font-semibold tabular-nums">
                {thisMo.income > 0 ? fmt(thisMo.income) : <span className="text-fg-muted">—</span>}
              </p>
            </div>
            <div className="border-border-subtle border-l p-4">
              <p className="text-fg-muted text-xs">Spending</p>
              <p className="mt-1 font-semibold tabular-nums">{fmt(Math.abs(thisMo.expenses))}</p>
            </div>
            <div className="border-border-subtle border-l p-4">
              <p className="text-fg-muted text-xs">Net</p>
              <p
                className={`mt-1 font-semibold tabular-nums ${
                  thisMo.net >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {fmtSigned(thisMo.net)}
              </p>
            </div>
          </div>

          {lastMo.income > 0 || lastMo.expenses < 0 ? (
            <p className="text-fg-muted text-xs">
              <span
                className={
                  netDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }
              >
                {fmtSigned(netDelta)}
              </span>
              {" vs "}
              {monthLabel(prev.year, prev.month)}
            </p>
          ) : null}

          {thisMo.topCategories.length > 0 && (
            <div className="space-y-1">
              <p className="text-fg-muted text-xs font-medium">Top spending</p>
              {thisMo.topCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg-muted">{catName.get(cat.id) ?? cat.name}</span>
                  <span className="tabular-nums">{fmt(Math.abs(cat.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Next actions */}
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

      {/* Recent transactions */}
      {recentTxns.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            <a href="/transactions" className="hover:underline">
              Recent transactions →
            </a>
          </h2>
          <div className="divide-border-subtle divide-y rounded-lg border text-sm">
            {recentTxns.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate">{txn.descriptionRaw || "—"}</p>
                  <p className="text-fg-muted text-xs">
                    {new Date(txn.startedAt).toLocaleDateString("en-IE")}
                    {txn.categoryId ? ` · ${catName.get(txn.categoryId) ?? ""}` : " · "}
                    {!txn.categoryId && <span className="text-warning">uncategorized</span>}
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

      {/* Advisor prompt card */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Ask your advisor</h2>
          <a href="/advisor" className="text-fg-muted text-xs hover:underline">
            Open advisor →
          </a>
        </div>
        <div className="border-border-subtle divide-border-subtle divide-y rounded-xl border text-sm">
          {(
            [
              "How did I do this month?",
              "Am I on track with my budget?",
              "What are my biggest subscriptions costing me?",
            ] as const
          ).map((q) => (
            <form key={q} action={createConversationWithQuestion.bind(null, q)}>
              <button
                type="submit"
                className="text-fg-muted hover:text-fg-default hover:bg-surface-hover w-full px-4 py-3 text-left transition-colors"
              >
                {q}
              </button>
            </form>
          ))}
        </div>
      </section>

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
