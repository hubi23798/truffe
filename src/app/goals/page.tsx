import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account, goal, user } from "@/lib/db/schema";
import { env } from "@/env";
import { getLatestBalances } from "@/lib/goals/balance";
import { calculateGoalProgress } from "@/lib/goals/progress";
import { GoalsView } from "./goals-view";
import type { GoalProgress } from "@/lib/goals/progress";

export interface SerializedGoal {
  id: string;
  name: string;
  kind: "cash_target" | "emergency_fund" | "debt_payoff" | "portfolio_target";
  targetAmount: number;
  targetDate: string | null;
  linkedAccountIds: string[];
  initialBalance: number | null;
  progress: GoalProgress;
}

export interface AccountOption {
  id: string;
  name: string;
  kind: string;
}

export default async function GoalsPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) redirect("/login");

  const [goals, accounts, userRows] = await Promise.all([
    db
      .select()
      .from(goal)
      .where(eq(goal.userId, PRIMARY_USER_ID) && eq(goal.isArchived, false))
      .orderBy(asc(goal.createdAt)),
    db
      .select({ id: account.id, name: account.name, kind: account.kind })
      .from(account)
      .where(eq(account.userId, PRIMARY_USER_ID)),
    db
      .select({ baseCurrency: user.baseCurrency })
      .from(user)
      .where(eq(user.id, PRIMARY_USER_ID))
      .limit(1),
  ]);

  const allLinkedIds = [...new Set(goals.flatMap((g) => g.linkedAccountIds))];
  const latestBalances = await getLatestBalances(db, allLinkedIds);
  const today = new Date().toISOString().slice(0, 10);

  const serializedGoals: SerializedGoal[] = goals.map((g) => {
    const linkedBalances = g.linkedAccountIds.map((id) => latestBalances.get(id) ?? 0);
    const progress = calculateGoalProgress(
      {
        kind: g.kind,
        targetAmount: g.targetAmount,
        targetDate: g.targetDate ?? null,
        initialBalance: g.initialBalance ?? null,
      },
      linkedBalances,
      today,
    );
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate ?? null,
      linkedAccountIds: g.linkedAccountIds,
      initialBalance: g.initialBalance ?? null,
      progress,
    };
  });

  const currency = userRows[0]?.baseCurrency ?? "EUR";

  return (
    <GoalsView
      goals={serializedGoals}
      accounts={accounts}
      currency={currency}
    />
  );
}
