import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account, transaction } from "@/lib/db/schema";
import { env } from "@/env";
import { detectRecurring, type Frequency } from "@/lib/recurring/detect";
import { eq, gte } from "drizzle-orm";

function fmt(minor: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(
    Math.abs(minor) / 100,
  );
}

function freqLabel(f: Frequency) {
  return { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" }[f];
}

function daysLabel(days: number, nextExpected: Date, asOf: Date): string {
  const diff = Math.round((nextExpected.getTime() - asOf.getTime()) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "due today";
  return `due in ${diff}d`;
}

export default async function RecurringPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const asOf = new Date();

  // Look back 3 months to detect patterns
  const lookback = new Date(asOf);
  lookback.setUTCMonth(lookback.getUTCMonth() - 3);

  const [txns, accounts] = await Promise.all([
    db.query.transaction.findMany({
      where: gte(transaction.startedAt, lookback),
      columns: {
        accountId: true,
        descriptionRaw: true,
        amountNative: true,
        currency: true,
        startedAt: true,
      },
    }),
    db.query.account.findMany({
      where: eq(account.userId, PRIMARY_USER_ID),
      columns: { id: true, name: true },
    }),
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const recurring = detectRecurring(txns, asOf);

  // Group by frequency
  const grouped: Record<Frequency, typeof recurring> = {
    monthly: recurring.filter((r) => r.frequency === "monthly"),
    fortnightly: recurring.filter((r) => r.frequency === "fortnightly"),
    weekly: recurring.filter((r) => r.frequency === "weekly"),
  };

  const hasAny = recurring.length > 0;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-semibold">Recurring</h1>

      {!hasAny && (
        <p className="text-fg-muted text-sm">
          No recurring transactions detected in the last 3 months.
        </p>
      )}

      {(["monthly", "fortnightly", "weekly"] as Frequency[]).map((freq) => {
        const items = grouped[freq];
        if (items.length === 0) return null;

        return (
          <section key={freq} className="space-y-3">
            <h2 className="text-sm font-medium">{freqLabel(freq)}</h2>

            <div className="border-border-subtle divide-border-subtle divide-y overflow-hidden rounded-xl border">
              {items.map((item) => {
                const nextLabel = daysLabel(item.daysSinceLastSeen, item.nextExpected, asOf);
                const isExpense = item.amountNative < 0;
                const isOverdue = item.nextExpected < asOf;

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.description}</p>
                      <p className="text-fg-muted truncate text-xs">
                        {accountName.get(item.accountId) ?? item.accountId} ·{" "}
                        {item.occurrences.length} times
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={`tabular-nums font-medium ${
                          isExpense ? "text-fg-default" : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {isExpense ? "−" : "+"}
                        {fmt(item.amountNative, item.currency)}
                      </span>
                      <span
                        className={`text-xs tabular-nums ${
                          isOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-fg-muted"
                        }`}
                      >
                        {nextLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
