import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  PRIMARY_USER_ID,
  advisorConversation,
  advisorMessage,
  pendingProposal,
} from "@/lib/db/schema";
import { env } from "@/env";

export async function GET(
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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [conv] = await db
    .select()
    .from(advisorConversation)
    .where(
      and(eq(advisorConversation.id, id), eq(advisorConversation.userId, PRIMARY_USER_ID)),
    )
    .limit(1);

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lazily expire proposals older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db
    .update(pendingProposal)
    .set({ status: "expired", resolvedAt: new Date() })
    .where(
      and(
        eq(pendingProposal.status, "pending"),
        lt(pendingProposal.createdAt, sevenDaysAgo),
      ),
    );

  const messages = await db.query.advisorMessage.findMany({
    where: eq(advisorMessage.conversationId, id),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  // Fetch proposals for this conversation's messages
  const messageIds = messages.map((m) => m.id);
  let proposals: (typeof pendingProposal.$inferSelect)[] = [];
  if (messageIds.length > 0) {
    proposals = await db.query.pendingProposal.findMany({
      where: (pp, { inArray }) => inArray(pp.advisorMessageId, messageIds),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
  }

  // Today's token usage for cost indicator
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [usageRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${advisorMessage.inputTokens} + ${advisorMessage.outputTokens}), 0)`,
    })
    .from(advisorMessage)
    .where(gte(advisorMessage.createdAt, todayStart));

  return NextResponse.json({
    conversation: conv,
    messages,
    proposals,
    todayTokens: parseInt(usageRow?.total ?? "0", 10),
    tokenBudget: env().ADVISOR_DAILY_TOKEN_BUDGET,
  });
}
