import { inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { balanceSnapshot } from "@/lib/db/schema";

export async function getLatestBalances(
  db: Db,
  accountIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (accountIds.length === 0) return result;

  const snapshots = await db
    .select({
      accountId: balanceSnapshot.accountId,
      asOfDate: balanceSnapshot.asOfDate,
      balanceBaseCcy: balanceSnapshot.balanceBaseCcy,
    })
    .from(balanceSnapshot)
    .where(inArray(balanceSnapshot.accountId, accountIds));

  const latest = new Map<string, { asOfDate: string; balance: number }>();
  for (const row of snapshots) {
    const cur = latest.get(row.accountId);
    if (!cur || row.asOfDate > cur.asOfDate) {
      latest.set(row.accountId, { asOfDate: row.asOfDate, balance: row.balanceBaseCcy });
    }
  }
  for (const [id, { balance }] of latest) {
    result.set(id, balance);
  }
  return result;
}
