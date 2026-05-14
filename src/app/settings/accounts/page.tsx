import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account } from "@/lib/db/schema";
import { env } from "@/env";
import { AccountRow } from "./account-row";

export default async function SettingsAccountsPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const accounts = await db.query.account.findMany({
    where: eq(account.userId, PRIMARY_USER_ID),
    orderBy: (a, { asc }) => [asc(a.name)],
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <a href="/settings" className="text-fg-muted text-sm hover:underline">← Settings</a>
        <h1 className="mt-2 text-xl font-semibold">Accounts</h1>
        <p className="text-fg-muted mt-1 text-xs">
          {accounts.length} accounts · {accounts.filter((a) => !a.isActive).length} archived
        </p>
      </div>

      <div className="divide-border-subtle divide-y rounded-lg border text-sm">
        {accounts.map((acct) => (
          <AccountRow key={acct.id} account={acct} />
        ))}
      </div>
    </main>
  );
}
