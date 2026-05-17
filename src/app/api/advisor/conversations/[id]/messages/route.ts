import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  PRIMARY_USER_ID,
  advisorConversation,
  advisorMessage,
} from "@/lib/db/schema";
import { env } from "@/env";
import { runAdvisorTurn } from "@/lib/advisor/engine";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(
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

  const [conv] = await db
    .select({ id: advisorConversation.id, title: advisorConversation.title })
    .from(advisorConversation)
    .where(
      and(eq(advisorConversation.id, id), eq(advisorConversation.userId, PRIMARY_USER_ID)),
    )
    .limit(1);

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Check if this is the first message to auto-set title
  const [firstCheck] = await db
    .select({ id: advisorMessage.id })
    .from(advisorMessage)
    .where(eq(advisorMessage.conversationId, id))
    .limit(1);
  const isFirst = !firstCheck;

  let result;
  try {
    result = await runAdvisorTurn(db, id, parsed.data.message);
  } catch (err) {
    console.error("[advisor] runAdvisorTurn failed:", err);
    return NextResponse.json({ error: "Advisor unavailable. Please try again." }, { status: 500 });
  }

  if (isFirst) {
    await db
      .update(advisorConversation)
      .set({ title: parsed.data.message.slice(0, 60) })
      .where(eq(advisorConversation.id, id));
  }

  return NextResponse.json(result);
}
