import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, categorizationRule } from "@/lib/db/schema";
import { env } from "@/env";

async function auth() {
  const sid = (await cookies()).get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return readSession(getDb(), sid);
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db.query.categorizationRule.findMany({
    where: eq(categorizationRule.userId, PRIMARY_USER_ID),
    orderBy: [asc(categorizationRule.priority)],
  });

  return NextResponse.json(rows);
}

const createSchema = z.object({
  priority: z.number().int().min(0),
  matchKind: z.enum([
    "description_contains",
    "description_regex",
    "type_raw_equals",
    "amount_range",
    "account_id_equals",
  ]),
  matchValue: z.string().min(1),
  categoryId: z.string().uuid(),
});

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(categorizationRule)
    .values({ userId: PRIMARY_USER_ID, source: "user", ...body.data })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
