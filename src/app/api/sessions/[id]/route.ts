import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { readSession, destroySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, session } from "@/lib/db/schema";
import { env } from "@/env";

interface Context {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: Context) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sess = await readSession(getDb(), sid);
  if (!sess) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const target = await db.query.session.findFirst({
    where: and(eq(session.id, id), eq(session.userId, PRIMARY_USER_ID)),
    columns: { id: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  await destroySession(db, id);
  return NextResponse.json({ ok: true });
}
