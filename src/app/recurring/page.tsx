import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gte } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  PRIMARY_USER_ID,
  account,
  category,
  recurringDismissal,
  recurringSubscription,
  transaction,
  user,
} from "@/lib/db/schema";
import { env } from "@/env";
import { detectRecurring } from "@/lib/recurring/detect";
import { RecurringView } from "./recurring-view";

export default async function RecurringPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) redirect("/login");

  const asOf = new Date();
  const lookback = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 3, asOf.getUTCDate()),
  );

  const [subs, dismissals, txns, accounts, allCats, userRows] = await Promise.all([
    db.select().from(recurringSubscription).where(eq(recurringSubscription.userId, PRIMARY_USER_ID)),
    db.select({ key: recurringDismissal.key }).from(recurringDismissal).where(eq(recurringDismissal.userId, PRIMARY_USER_ID)),
    db.select({
      accountId: transaction.accountId,
      descriptionRaw: transaction.descriptionRaw,
      amountNative: transaction.amountNative,
      currency: transaction.currency,
      startedAt: transaction.startedAt,
    }).from(transaction).where(gte(transaction.startedAt, lookback)),
    db.select({ id: account.id, name: account.name }).from(account).where(eq(account.userId, PRIMARY_USER_ID)),
    db.select({ id: category.id, name: category.name, parentId: category.parentId, kind: category.kind })
      .from(category)
      .where(and(eq(category.userId, PRIMARY_USER_ID), eq(category.isArchived, false))),
    db.select({ baseCurrency: user.baseCurrency }).from(user).where(eq(user.id, PRIMARY_USER_ID)).limit(1),
  ]);

  const confirmedKeys = new Set(
    subs.map((s) => s.detectionKey).filter((k): k is string => k !== null),
  );
  const dismissedKeys = new Set(dismissals.map((d) => d.key));

  const allDetected = detectRecurring(txns, asOf);
  const candidates = allDetected.filter(
    (r) => !confirmedKeys.has(r.key) && !dismissedKeys.has(r.key),
  );

  const parentMap = new Map(
    allCats.filter((c) => !c.parentId).map((c) => [c.id, c.name]),
  );
  const categories = allCats
    .filter((c) => c.parentId !== null && (c.kind === "expense" || c.kind === "investment_flow"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      parentName: parentMap.get(c.parentId!) ?? "Other",
    }));

  const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const currency = userRows[0]?.baseCurrency ?? "EUR";

  return (
    <RecurringView
      subscriptions={subs}
      candidates={candidates}
      categories={categories}
      accountNames={accountNames}
      currency={currency}
    />
  );
}
