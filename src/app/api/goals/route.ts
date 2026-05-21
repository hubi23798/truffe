import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account, goal } from "@/lib/db/schema";
import { env } from "@/env";
import { getLatestBalances } from "@/lib/goals/balance";
import { calculateGoalProgress } from "@/lib/goals/progress";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["cash_target", "emergency_fund", "debt_payoff", "portfolio_target"]),
  targetAmount: z.number().int().positive(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedAccountIds: z.array(z.string().uuid()).min(1),
});

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await db.query.goal.findMany({
    where: (g, { and, eq }) => and(eq(g.userId, PRIMARY_USER_ID), eq(g.isArchived, false)),
    orderBy: (g, { asc }) => [asc(g.createdAt)],
  });

  const allAccountIds = [...new Set(goals.flatMap((g) => g.linkedAccountIds))];
  const latestBalances = await getLatestBalances(db, allAccountIds);
  const today = new Date().toISOString().slice(0, 10);

  const result = goals.map((g) => {
    const linkedBalances = g.linkedAccountIds.map((id) => latestBalances.get(id) ?? 0);
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate,
      linkedAccountIds: g.linkedAccountIds,
      initialBalance: g.initialBalance,
      progress: calculateGoalProgress(
        {
          kind: g.kind,
          targetAmount: g.targetAmount,
          targetDate: g.targetDate,
          initialBalance: g.initialBalance,
        },
        linkedBalances,
        today,
      ),
      createdAt: g.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ goals: result });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { name, kind, targetAmount, targetDate, linkedAccountIds } = parsed.data;

  // Verify all linked accounts belong to this user
  const ownedAccounts = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, PRIMARY_USER_ID));
  const ownedIds = new Set(ownedAccounts.map((a) => a.id));
  if (!linkedAccountIds.every((id) => ownedIds.has(id))) {
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }

  // For debt_payoff, capture current liability balance as the starting point
  let initialBalance: number | null = null;
  if (kind === "debt_payoff") {
    const latestBalances = await getLatestBalances(db, linkedAccountIds);
    initialBalance = linkedAccountIds.reduce((s, id) => s + (latestBalances.get(id) ?? 0), 0);
  }

  const now = new Date();
  const [inserted] = await db
    .insert(goal)
    .values({
      userId: PRIMARY_USER_ID,
      name,
      kind,
      targetAmount,
      targetDate: targetDate ?? null,
      linkedAccountIds,
      initialBalance,
      updatedAt: now,
    })
    .returning({ id: goal.id });

  if (!inserted) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
