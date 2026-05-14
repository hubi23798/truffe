import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, categorizationRule } from "@/lib/db/schema";
import { env } from "@/env";

async function auth() {
  const sid = (await cookies()).get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return readSession(getDb(), sid);
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Props) {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const [deleted] = await db
    .delete(categorizationRule)
    .where(and(eq(categorizationRule.id, id), eq(categorizationRule.userId, PRIMARY_USER_ID)))
    .returning({ id: categorizationRule.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
