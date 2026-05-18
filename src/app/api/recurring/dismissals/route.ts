import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, recurringDismissal } from "@/lib/db/schema";
import { env } from "@/env";

const bodySchema = z.object({ key: z.string().min(1).max(512) });

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await db
    .insert(recurringDismissal)
    .values({ userId: PRIMARY_USER_ID, key: parsed.data.key })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
