import { and, eq, gte, sum } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { category, transaction } from "@/lib/db/schema";

export async function suggestEmergencyFund(db: Db): Promise<{
  suggested3x: number;
  suggested6x: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const [row] = await db
    .select({ total: sum(transaction.amountNative) })
    .from(transaction)
    .innerJoin(category, eq(transaction.categoryId, category.id))
    .where(
      and(
        eq(category.kind, "expense"),
        eq(transaction.state, "completed"),
        gte(transaction.startedAt, cutoff),
      ),
    );

  // Expense amountNative is negative; abs() gives total spent over 90 days.
  const totalExpenses = Math.abs(Number(row?.total ?? 0));
  const monthlyAvg = Math.round(totalExpenses / 3);

  return {
    suggested3x: monthlyAvg * 3,
    suggested6x: monthlyAvg * 6,
  };
}
