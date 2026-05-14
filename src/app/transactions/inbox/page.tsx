import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { CategoryPicker } from "@/components/category-picker";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, category, transaction } from "@/lib/db/schema";
import { env } from "@/env";

export default async function InboxPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();

  const [uncategorized, categories] = await Promise.all([
    db.query.transaction.findMany({
      where: isNull(transaction.categoryId),
      orderBy: [desc(transaction.startedAt)],
      limit: 100,
      columns: {
        id: true,
        startedAt: true,
        amountNative: true,
        currency: true,
        descriptionRaw: true,
        typeRaw: true,
        state: true,
      },
    }),
    db.query.category.findMany({
      where: eq(category.userId, PRIMARY_USER_ID),
      orderBy: [asc(category.name)],
      columns: { id: true, name: true, parentId: true },
    }),
  ]);

  function formatAmount(minor: number, currency: string) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Transactions inbox</h1>
        <p className="text-fg-muted mt-1 text-sm">
          {uncategorized.length} uncategorized transaction{uncategorized.length !== 1 ? "s" : ""}
        </p>
      </div>

      {uncategorized.length === 0 ? (
        <p className="text-fg-muted text-sm">All transactions are categorized.</p>
      ) : (
        <div className="divide-border-subtle divide-y rounded-lg border text-sm">
          {uncategorized.map((txn) => (
            <div key={txn.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{txn.descriptionRaw || txn.typeRaw || "—"}</p>
                <p className="text-fg-muted text-xs">
                  {new Date(txn.startedAt).toLocaleDateString()} · {txn.state}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className={txn.amountNative < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                  {formatAmount(txn.amountNative, txn.currency)}
                </span>
                <CategoryPicker
                  transactionId={txn.id}
                  categories={categories}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
