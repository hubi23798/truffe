import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  PRIMARY_TENANT_ID,
  PRIMARY_USER_ID,
  advisorConversation,
  advisorMessage,
} from "@/lib/db/schema";
import { env } from "@/env";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: advisorConversation.id,
      title: advisorConversation.title,
      startedAt: advisorConversation.startedAt,
      isArchived: advisorConversation.isArchived,
      messageCount: count(advisorMessage.id),
    })
    .from(advisorConversation)
    .leftJoin(advisorMessage, eq(advisorMessage.conversationId, advisorConversation.id))
    .where(eq(advisorConversation.userId, PRIMARY_USER_ID))
    .groupBy(
      advisorConversation.id,
      advisorConversation.title,
      advisorConversation.startedAt,
      advisorConversation.isArchived,
    )
    .orderBy(desc(advisorConversation.startedAt));

  return NextResponse.json({ conversations: rows });
}

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [conv] = await db
    .insert(advisorConversation)
    .values({ tenantId: PRIMARY_TENANT_ID, userId: PRIMARY_USER_ID, title: "New conversation" })
    .returning({ id: advisorConversation.id });

  return NextResponse.json({ id: conv!.id }, { status: 201 });
}
