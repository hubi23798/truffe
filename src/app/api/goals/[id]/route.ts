import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account, balanceSnapshot, goal } from "@/lib/db/schema";
import { env } from "@/env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetAmount: z.number().int().positive().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  linkedAccountIds: z.array(z.string().uuid()).min(1).optional(),
});

async function getLatestBalanceSum(
  db: ReturnType<typeof getDb>,
  accountIds: string[],
): Promise<number> {
  if (accountIds.length === 0) return 0;

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
  return [...latest.values()].reduce((s, { balance }) => s + balance, 0);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await db.query.goal.findFirst({
    where: (g, { and, eq }) =>
      and(eq(g.id, id), eq(g.userId, PRIMARY_USER_ID), eq(g.isArchived, false)),
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.linkedAccountIds) {
    const ownedAccounts = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, PRIMARY_USER_ID));
    const ownedIds = new Set(ownedAccounts.map((a) => a.id));
    if (!parsed.data.linkedAccountIds.every((aid) => ownedIds.has(aid))) {
      return NextResponse.json({ error: "Invalid account" }, { status: 400 });
    }
  }

  // Re-snapshot initialBalance when debt_payoff accounts change
  let newInitialBalance: number | undefined;
  if (existing.kind === "debt_payoff" && parsed.data.linkedAccountIds !== undefined) {
    newInitialBalance = await getLatestBalanceSum(db, parsed.data.linkedAccountIds);
  }

  const now = new Date();
  const [updated] = await db
    .update(goal)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.targetAmount !== undefined ? { targetAmount: parsed.data.targetAmount } : {}),
      ...("targetDate" in parsed.data ? { targetDate: parsed.data.targetDate ?? null } : {}),
      ...(parsed.data.linkedAccountIds !== undefined
        ? { linkedAccountIds: parsed.data.linkedAccountIds }
        : {}),
      ...(newInitialBalance !== undefined ? { initialBalance: newInitialBalance } : {}),
      updatedAt: now,
    })
    .where(and(eq(goal.id, id), eq(goal.userId, PRIMARY_USER_ID)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  return NextResponse.json({ goal: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [archived] = await db
    .update(goal)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(goal.id, id), eq(goal.userId, PRIMARY_USER_ID)))
    .returning({ id: goal.id });

  if (!archived) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
