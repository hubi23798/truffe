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
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { TransactionList, type Transaction } from "@/components/transaction-row";
import { TrendingUp, Wallet, CreditCard, PiggyBank, MessageSquare } from "lucide-react";

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
      limit: 8,
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
  const savingsRate =
    thisMo.income > 0 ? Math.round((thisMo.net / thisMo.income) * 100) : null;

  const mappedTxns: Transaction[] = recentTxns.map((txn) => ({
    id: txn.id,
    merchant: txn.descriptionRaw || "Unknown",
    category: txn.categoryId ? (catName.get(txn.categoryId) ?? null) : null,
    date: txn.startedAt.toISOString(),
    amountCents: txn.amountNative,
    currency: txn.currency ?? "EUR",
  }));

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
    <div className="space-y-6 px-6 py-8">

      {/* Net worth hero */}
      <KpiCard
        variant="hero"
        label={`Net Worth · ${nw.asOf}`}
        value={fmt(nw.netWorth)}
        delta={
          (lastMo.income > 0 || lastMo.expenses < 0)
            ? `${fmtSigned(netDelta)} vs ${monthLabel(prev.year, prev.month)}`
            : undefined
        }
        deltaDirection={netDelta >= 0 ? "up" : "down"}
        icon={TrendingUp}
      />

      {/* Monthly KPIs */}
      {hasMonthlyData && (
        <KpiGrid>
          <KpiCard
            label="Income"
            value={thisMo.income > 0 ? fmt(thisMo.income) : "—"}
            delta={lastMo.income > 0 ? `${fmtSigned(thisMo.income - lastMo.income)} vs last mo` : undefined}
            deltaDirection={thisMo.income >= lastMo.income ? "up" : "down"}
            icon={Wallet}
          />
          <KpiCard
            label="Spending"
            value={fmt(Math.abs(thisMo.expenses))}
            delta={lastMo.expenses < 0 ? `${fmtSigned(Math.abs(thisMo.expenses) - Math.abs(lastMo.expenses))} vs last mo` : undefined}
            deltaDirection={Math.abs(thisMo.expenses) <= Math.abs(lastMo.expenses) ? "up" : "down"}
            icon={CreditCard}
          />
          <KpiCard
            label="Net"
            value={fmt(thisMo.net)}
            delta={lastMo.income > 0 ? `${fmtSigned(netDelta)} vs last mo` : undefined}
            deltaDirection={thisMo.net >= 0 ? "up" : "down"}
            icon={TrendingUp}
          />
          {savingsRate !== null && (
            <KpiCard
              label="Savings Rate"
              value={`${savingsRate}%`}
              icon={PiggyBank}
              deltaDirection={savingsRate >= 20 ? "up" : savingsRate >= 0 ? "neutral" : "down"}
            />
          )}
        </KpiGrid>
      )}

      {/* Weekly debrief */}
      {latestDebrief && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-[#F7F4EE]">Weekly debrief</h2>
            <span className="font-mono text-xs text-[#6B5040]">
              {latestDebrief.weekStart} – {latestDebrief.weekEnd}
            </span>
          </div>
          <div className="rounded-xl border border-[#4A2E1A] bg-[#3A2414] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.3)] space-y-3">
            <p className="text-sm leading-relaxed text-[#F7F4EE]">{latestDebrief.narrativeText}</p>
            {latestDebrief.flags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {latestDebrief.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background:
                        flag.kind === "spending_spike" || flag.kind === "budget_overrun"
                          ? "rgba(224,112,112,0.15)"
                          : flag.kind === "spending_drop"
                            ? "rgba(107,191,133,0.15)"
                            : "rgba(201,168,76,0.15)",
                      color:
                        flag.kind === "spending_spike" || flag.kind === "budget_overrun"
                          ? "#E07070"
                          : flag.kind === "spending_drop"
                            ? "#6BBF85"
                            : "#C9A84C",
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

      {/* Next actions */}
      {uncategorizedCount > 0 && (
        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold tracking-tight text-[#F7F4EE]">Next actions</h2>
          <a
            href="/transactions/inbox"
            className="flex items-center justify-between rounded-xl border border-[#4A2E1A] bg-[#3A2414] p-4 transition-colors hover:bg-[#4A2E1A]"
          >
            <div>
              <p className="text-sm font-medium text-[#F7F4EE]">Categorize transactions</p>
              <p className="mt-0.5 text-xs text-[#C4B8A8]">{uncategorizedCount} uncategorized</p>
            </div>
            <Badge variant="warning">{uncategorizedCount}</Badge>
          </a>
        </section>
      )}

      {/* Recent transactions */}
      {mappedTxns.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-[#F7F4EE]">Recent transactions</h2>
            <a href="/transactions" className="text-xs text-[#6BBF85] hover:underline">
              View all →
            </a>
          </div>
          <TransactionList transactions={mappedTxns} />
        </section>
      )}

      {/* Ask your advisor */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-semibold tracking-tight text-[#F7F4EE]">Ask your advisor</h2>
          <a href="/advisor" className="text-xs text-[#6BBF85] hover:underline">
            Open advisor →
          </a>
        </div>
        <div className="rounded-xl border border-[#4A2E1A] bg-[#3A2414] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
          {(["How did I do this month?", "Am I on track with my budget?", "What are my biggest subscriptions costing me?"] as const).map((q, i) => (
            <form key={q} action={createConversationWithQuestion.bind(null, q)}>
              <button
                type="submit"
                className="group flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#C4B8A8] transition-colors hover:bg-[#4A2E1A] hover:text-[#F7F4EE]"
                style={i > 0 ? { borderTop: "1px solid #4A2E1A" } : {}}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-[#C9A84C]" strokeWidth={1.75} />
                {q}
              </button>
            </form>
          ))}
        </div>
      </section>

    </div>
  );
}
