import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, category } from "@/lib/db/schema";
import { env } from "@/env";

async function auth() {
  const sid = (await cookies()).get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return readSession(getDb(), sid);
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db.query.category.findMany({
    where: eq(category.userId, PRIMARY_USER_ID),
    orderBy: [isNull(category.parentId), asc(category.name)],
  });

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
  kind: z.enum(["income", "expense", "transfer", "investment_flow"]),
});

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(category)
    .values({
      userId: PRIMARY_USER_ID,
      name: body.data.name,
      parentId: body.data.parentId ?? null,
      kind: body.data.kind,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
