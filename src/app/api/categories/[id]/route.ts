import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
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

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isArchived: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Props) {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();
  const [updated] = await db
    .update(category)
    .set(body.data)
    .where(and(eq(category.id, id), eq(category.userId, PRIMARY_USER_ID)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
