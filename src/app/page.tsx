import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getNetWorthNow } from "@/lib/net-worth/engine";
import { getMonthlySummary, monthLabel, prevMonth } from "@/lib/summary";
import { advisorConversation, PRIMARY_USER_ID, transaction, weeklyDebrief } from "@/lib/db/schema";
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

const kindLabel: Record<string, string> = {
  cash: "Cash",
  investment: "Investments",
  crypto: "Crypto",
  pension: "Pension",
  property: "Property",
  other_asset: "Other assets",
  liability: "Liabilities",
};

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

  const [nw, thisMo, lastMo, recentTxns, uncategorizedCount, latestDebrief] = await Promise.all([
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
    db.query.weeklyDebrief.findFirst({
      where: (d, { eq }) => eq(d.userId, PRIMARY_USER_ID),
      orderBy: (d, { desc }) => [desc(d.weekStart)],
      columns: { narrativeText: true, flags: true, weekStart: true, weekEnd: true },
    }),
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
  const hasMonthlyData = thisMo.income > 0 || thisMo.expenses < 0;

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

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">

      {/* ── Net worth hero ── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <p className="text-xs" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-mono)" }}>
          Net worth · as of {nw.asOf}
        </p>
        <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
          <p
            className="tracking-tight"
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 36,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(nw.netWorth)}
          </p>
          {(lastMo.income > 0 || lastMo.expenses < 0) && (
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold"
              style={{
                background: netDelta >= 0 ? "rgba(31,77,58,0.1)" : "rgba(220,38,38,0.08)",
                color: netDelta >= 0 ? "var(--brand-forest)" : "#dc2626",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtSigned(netDelta)} vs {monthLabel(prev.year, prev.month)}
            </span>
          )}
        </div>

        <div className="mt-5 flex gap-8 text-sm">
          <div>
            <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>Assets</p>
            <p className="mt-0.5 font-semibold tabular-nums" style={{ color: "var(--brand-forest)", fontFamily: "var(--font-mono)" }}>
              {fmt(nw.assets)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>Liabilities</p>
            <p className="mt-0.5 font-semibold tabular-nums text-red-600 dark:text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
              {fmt(nw.liabilities)}
            </p>
          </div>
        </div>

        {Object.entries(nw.byKind).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
            {Object.entries(nw.byKind)
              .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
              .map(([kind, amount]) => (
                <div key={kind} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-fg-muted)" }}>
                  <span>{kindLabel[kind] ?? kind}</span>
                  <span
                    className="font-medium tabular-nums"
                    style={{
                      color: amount < 0 ? "#dc2626" : "var(--color-fg-default)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {fmt(amount)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── This month ── */}
      {hasMonthlyData && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>This month</h2>
            <span className="text-xs" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-mono)" }}>
              {monthLabel(curYear, curMonth)}
            </span>
          </div>

          <div
            className="grid grid-cols-3 rounded-xl overflow-hidden text-sm"
            style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
          >
            <div className="p-4">
              <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>Income</p>
              <p className="mt-1.5 font-semibold" style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {thisMo.income > 0 ? fmt(thisMo.income) : <span style={{ color: "var(--color-fg-muted)" }}>—</span>}
              </p>
            </div>
            <div className="p-4" style={{ borderLeft: "1px solid var(--color-border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>Spending</p>
              <p className="mt-1.5 font-semibold" style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {fmt(Math.abs(thisMo.expenses))}
              </p>
            </div>
            <div className="p-4" style={{ borderLeft: "1px solid var(--color-border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>Net</p>
              <p
                className="mt-1.5 font-semibold"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  color: thisMo.net >= 0 ? "var(--brand-forest)" : "#dc2626",
                }}
              >
                {fmtSigned(thisMo.net)}
              </p>
            </div>
          </div>

          {thisMo.topCategories.length > 0 && (
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--color-fg-muted)" }}>Top spending</p>
              {thisMo.topCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--color-fg-muted)" }}>{catName.get(cat.id) ?? cat.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(Math.abs(cat.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Weekly debrief ── */}
      {latestDebrief && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>Weekly debrief</h2>
            <span className="text-xs" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-mono)" }}>
              {latestDebrief.weekStart} – {latestDebrief.weekEnd}
            </span>
          </div>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
          >
            <p className="text-sm leading-relaxed">{latestDebrief.narrativeText}</p>
            {latestDebrief.flags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {latestDebrief.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background:
                        flag.kind === "spending_spike" || flag.kind === "budget_overrun"
                          ? "rgba(220,38,38,0.08)"
                          : flag.kind === "spending_drop"
                            ? "rgba(31,77,58,0.1)"
                            : "rgba(201,168,106,0.15)",
                      color:
                        flag.kind === "spending_spike" || flag.kind === "budget_overrun"
                          ? "#dc2626"
                          : flag.kind === "spending_drop"
                            ? "var(--brand-forest)"
                            : "var(--brand-truffle)",
                    }}
                    title={flag.message}
                  >
                    {flag.kind === "spending_spike" && `↑ ${flag.category}`}
                    {flag.kind === "spending_drop" && `↓ ${flag.category}`}
                    {flag.kind === "budget_overrun" && `Over budget: ${flag.category}`}
                    {flag.kind === "recurring_due" && `Due: ${flag.name}`}
                    {flag.kind === "income_change" && "Income changed"}
                    {flag.kind === "new_category" && `New: ${flag.category}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Next actions ── */}
      {uncategorizedCount > 0 && (
        <section className="space-y-2">
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>Next actions</h2>
          <a
            href="/transactions/inbox"
            className="flex items-center justify-between rounded-xl p-4 transition-colors hover:brightness-95"
            style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
          >
            <div>
              <p className="text-sm font-medium">Categorize transactions</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-muted)" }}>
                {uncategorizedCount} uncategorized
              </p>
            </div>
            <Badge variant="warning">{uncategorizedCount}</Badge>
          </a>
        </section>
      )}

      {/* ── Recent transactions ── */}
      {recentTxns.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Recent transactions
            </h2>
            <a
              href="/transactions"
              className="text-xs hover:underline"
              style={{ color: "var(--brand-forest)" }}
            >
              View all →
            </a>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
          >
            {recentTxns.map((txn, i) => (
              <div
                key={txn.id}
                className="flex items-center justify-between px-4 py-3"
                style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : {}}
              >
                <div className="min-w-0">
                  <p className="text-sm truncate font-medium">{txn.descriptionRaw || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-mono)" }}>
                    {new Date(txn.startedAt).toLocaleDateString("en-IE")}
                    {txn.categoryId
                      ? ` · ${catName.get(txn.categoryId) ?? ""}`
                      : <span style={{ color: "var(--brand-gold)" }}> · uncategorized</span>}
                  </p>
                </div>
                <span
                  className="shrink-0 ml-4 text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    color: txn.amountNative < 0 ? "#dc2626" : "var(--brand-forest)",
                  }}
                >
                  {fmt(txn.amountNative, txn.currency)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ask your advisor ── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>Ask your advisor</h2>
          <a href="/advisor" className="text-xs hover:underline" style={{ color: "var(--brand-forest)" }}>
            Open advisor →
          </a>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-border-subtle)", background: "white" }}
        >
          {(
            [
              "How did I do this month?",
              "Am I on track with my budget?",
              "What are my biggest subscriptions costing me?",
            ] as const
          ).map((q, i) => (
            <form key={q} action={createConversationWithQuestion.bind(null, q)}>
              <button
                type="submit"
                className="w-full px-4 py-3 text-left text-sm transition-colors hover:brightness-95"
                style={{
                  color: "var(--color-fg-muted)",
                  borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : undefined,
                  background: "transparent",
                }}
              >
                {q}
              </button>
            </form>
          ))}
        </div>
      </section>

    </main>
  );
}
