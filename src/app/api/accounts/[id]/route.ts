import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, account } from "@/lib/db/schema";
import { env } from "@/env";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isLiquid: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Context) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sess = await readSession(getDb(), sid);
  if (!sess) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(account)
    .set(patch)
    .where(and(eq(account.id, id), eq(account.userId, PRIMARY_USER_ID)))
    .returning({ id: account.id });

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
