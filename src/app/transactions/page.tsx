import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account, category, transaction } from "@/lib/db/schema";
import { env } from "@/env";

interface Props {
  searchParams: Promise<{
    accountId?: string;
    categoryId?: string;
    q?: string;
    from?: string;
    to?: string;
    uncategorized?: string;
  }>;
}

function fmt(minor: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
}

export default async function TransactionsPage({ searchParams }: Props) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const filters = await searchParams;

  const [accounts, allCategories] = await Promise.all([
    db.query.account.findMany({
      where: eq(account.userId, PRIMARY_USER_ID),
      columns: { id: true, name: true, currency: true },
      orderBy: (a, { asc }) => [asc(a.name)],
    }),
    db.query.category.findMany({
      where: eq(category.userId, PRIMARY_USER_ID),
      columns: { id: true, name: true, kind: true, parentId: true },
      orderBy: (c, { asc }) => [asc(c.name)],
    }),
  ]);

  // Build expense/income leaf categories for the dropdown (exclude transfer)
  const leafCategories = allCategories.filter(
    (c) => c.parentId !== null && c.kind !== "transfer",
  );

  const conditions = [];
  if (filters.accountId) conditions.push(eq(transaction.accountId, filters.accountId));
  if (filters.from) conditions.push(gte(transaction.startedAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(transaction.startedAt, new Date(filters.to + "T23:59:59Z")));
  if (filters.uncategorized === "1") {
    conditions.push(isNull(transaction.categoryId));
  } else if (filters.categoryId) {
    conditions.push(eq(transaction.categoryId, filters.categoryId));
  }
  if (filters.q?.trim()) {
    conditions.push(ilike(transaction.descriptionRaw, `%${filters.q.trim()}%`));
  }

  const txns = await db.query.transaction.findMany({
    where:
      conditions.length > 0
        ? and(...(conditions as [typeof conditions[0], ...typeof conditions]))
        : undefined,
    orderBy: [desc(transaction.startedAt)],
    limit: 200,
    columns: {
      id: true,
      startedAt: true,
      amountNative: true,
      feeNative: true,
      currency: true,
      descriptionRaw: true,
      state: true,
      categoryId: true,
      accountId: true,
    },
  });

  const categoryIds = [...new Set(txns.map((t) => t.categoryId).filter(Boolean) as string[])];
  const txnCategories =
    categoryIds.length > 0
      ? await db.query.category.findMany({
          where: (cat, { inArray }) => inArray(cat.id, categoryIds),
          columns: { id: true, name: true },
        })
      : [];
  const catName = new Map(txnCategories.map((c) => [c.id, c.name]));
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));

  const totalIn = txns.filter((t) => t.amountNative > 0).reduce((s, t) => s + t.amountNative, 0);
  const totalOut = txns.filter((t) => t.amountNative < 0).reduce((s, t) => s + t.amountNative, 0);

  const activeFilterCount = [
    filters.accountId,
    filters.categoryId,
    filters.q?.trim(),
    filters.from,
    filters.to,
    filters.uncategorized === "1" ? "1" : undefined,
  ].filter(Boolean).length;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Transactions</h1>
        <p className="text-fg-muted mt-1 text-xs">
          {txns.length} rows (max 200){activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active` : ""}
        </p>
      </div>

      {/* Filter bar */}
      <form method="GET" className="space-y-2 text-sm">
        {/* Row 1: search */}
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search description…"
          className="border-border-subtle bg-surface w-full rounded-md border px-3 py-1.5 text-sm placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-fg-muted"
        />

        {/* Row 2: dropdowns + dates */}
        <div className="flex flex-wrap gap-2">
          <select
            name="accountId"
            defaultValue={filters.accountId ?? ""}
            className="border-border-subtle bg-surface rounded-md border px-2 py-1 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            className="border-border-subtle bg-surface rounded-md border px-2 py-1 text-sm"
            disabled={filters.uncategorized === "1"}
          >
            <option value="">All categories</option>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className="border-border-subtle bg-surface rounded-md border px-2 py-1 text-sm"
          />
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className="border-border-subtle bg-surface rounded-md border px-2 py-1 text-sm"
          />
        </div>

        {/* Row 3: checkbox + actions */}
        <div className="flex items-center gap-3">
          <label className="border-border-subtle flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1">
            <input
              type="checkbox"
              name="uncategorized"
              value="1"
              defaultChecked={filters.uncategorized === "1"}
            />
            <span>Uncategorized only</span>
          </label>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-3 py-1 font-medium"
          >
            Apply
          </button>
          {activeFilterCount > 0 && (
            <a href="/transactions" className="text-fg-muted hover:text-fg-default">
              Clear
            </a>
          )}
        </div>
      </form>

      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-fg-muted text-xs">In</p>
          <p className="font-medium text-green-600 dark:text-green-400">{fmt(totalIn)}</p>
        </div>
        <div>
          <p className="text-fg-muted text-xs">Out</p>
          <p className="font-medium text-red-600 dark:text-red-400">{fmt(Math.abs(totalOut))}</p>
        </div>
        <div>
          <p className="text-fg-muted text-xs">Net</p>
          <p
            className={`font-medium ${totalIn + totalOut < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
          >
            {fmt(totalIn + totalOut)}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      {txns.length === 0 ? (
        <p className="text-fg-muted text-sm">No transactions match these filters.</p>
      ) : (
        <div className="divide-border-subtle divide-y rounded-lg border text-sm">
          {txns.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate">{txn.descriptionRaw || "—"}</p>
                <p className="text-fg-muted mt-0.5 text-xs">
                  {new Date(txn.startedAt).toLocaleDateString("en-IE")}
                  {!filters.accountId && ` · ${acctName.get(txn.accountId) ?? ""}`}
                  {txn.categoryId ? ` · ${catName.get(txn.categoryId) ?? ""}` : ""}
                  {!txn.categoryId && (
                    <>
                      {" · "}
                      <span className="text-warning">uncategorized</span>
                    </>
                  )}
                  {txn.state !== "completed" && ` · ${txn.state}`}
                </p>
              </div>
              <div className="ml-3 shrink-0 text-right">
                <span
                  className={`font-medium ${
                    txn.amountNative < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {fmt(txn.amountNative, txn.currency)}
                </span>
                {txn.feeNative !== 0 && (
                  <p className="text-fg-muted text-xs">fee {fmt(txn.feeNative, txn.currency)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
