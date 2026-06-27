import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  PRIMARY_TENANT_ID,
  PRIMARY_USER_ID,
  advisorConversation,
  advisorMessage,
  auditLog,
  categorizationRule,
  pendingProposal,
} from "@/lib/db/schema";
import { env } from "@/env";

const bodySchema = z.object({
  action: z.enum(["accept", "reject"]),
});

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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Verify proposal belongs to this user via conversation chain
  const [proposal] = await db
    .select({
      id: pendingProposal.id,
      status: pendingProposal.status,
      kind: pendingProposal.kind,
      payload: pendingProposal.payload,
      advisorMessageId: pendingProposal.advisorMessageId,
    })
    .from(pendingProposal)
    .innerJoin(advisorMessage, eq(pendingProposal.advisorMessageId, advisorMessage.id))
    .innerJoin(advisorConversation, eq(advisorMessage.conversationId, advisorConversation.id))
    .where(
      and(eq(pendingProposal.id, id), eq(advisorConversation.userId, PRIMARY_USER_ID)),
    )
    .limit(1);

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "pending")
    return NextResponse.json({ error: "Proposal is not pending" }, { status: 422 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const now = new Date();
  const action = parsed.data.action;

  if (action === "accept" && proposal.kind === "create_rule") {
    const p = proposal.payload as {
      matchKind: "description_contains" | "description_regex" | "type_raw_equals" | "amount_range" | "account_id_equals";
      matchValue: string;
      categoryId: string;
    };

    // Get next priority
    const existing = await db.query.categorizationRule.findMany({
      where: eq(categorizationRule.userId, PRIMARY_USER_ID),
      columns: { priority: true },
      orderBy: (t, { desc: d }) => [d(t.priority)],
    });
    const nextPriority = (existing[0]?.priority ?? 0) + 1;

    await db.insert(categorizationRule).values({
      tenantId: PRIMARY_TENANT_ID,
      userId: PRIMARY_USER_ID,
      priority: nextPriority,
      matchKind: p.matchKind,
      matchValue: p.matchValue,
      categoryId: p.categoryId,
      source: "llm_accepted",
    });

    await db.insert(auditLog).values({
      userId: PRIMARY_USER_ID,
      actor: "user",
      action: "accept_proposal",
      targetTable: "categorization_rule",
      advisorMessageId: proposal.advisorMessageId,
      after: proposal.payload as Record<string, unknown>,
    });
  } else if (action === "reject") {
    await db.insert(auditLog).values({
      userId: PRIMARY_USER_ID,
      actor: "user",
      action: "reject_proposal",
      targetTable: "pending_proposal",
      targetId: id,
      advisorMessageId: proposal.advisorMessageId,
    });
  }

  await db
    .update(pendingProposal)
    .set({ status: action === "accept" ? "accepted" : "rejected", resolvedAt: now })
    .where(eq(pendingProposal.id, id));

  return NextResponse.json({ ok: true });
}
