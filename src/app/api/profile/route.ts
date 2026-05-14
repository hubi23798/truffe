import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, user } from "@/lib/db/schema";
import { env } from "@/env";

const patchSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  locale: z.string().min(2).max(10).optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  timeHorizonYears: z.number().int().min(1).max(60).nullable().optional(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).nullable().optional(),
});

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sess = await readSession(getDb(), sid);
  if (!sess) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  await db.update(user).set(parsed.data).where(eq(user.id, PRIMARY_USER_ID));

  return NextResponse.json({ ok: true });
}
