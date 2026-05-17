import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { budgetTarget, category } from "@/lib/db/schema";
import { env } from "@/env";

const putBody = z.object({
  amountMonthly: z.number().int().positive(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { categoryId } = await params;

  const cat = await db.query.category.findFirst({
    where: and(eq(category.id, categoryId), eq(category.userId, sess.userId)),
  });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!cat.parentId)
    return NextResponse.json({ error: "Targets can only be set on leaf categories" }, { status: 422 });
  if (cat.kind !== "expense" && cat.kind !== "investment_flow")
    return NextResponse.json(
      { error: "Targets can only be set on expense or investment_flow categories" },
      { status: 422 },
    );

  const parsed = putBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const now = new Date();
  const [row] = await db
    .insert(budgetTarget)
    .values({
      userId: sess.userId,
      categoryId,
      amountMonthly: parsed.data.amountMonthly,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [budgetTarget.userId, budgetTarget.categoryId],
      set: { amountMonthly: parsed.data.amountMonthly, updatedAt: now },
    })
    .returning();

  return NextResponse.json({ id: row!.id, categoryId, amountMonthly: row!.amountMonthly });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { categoryId } = await params;

  await db
    .delete(budgetTarget)
    .where(and(eq(budgetTarget.userId, sess.userId), eq(budgetTarget.categoryId, categoryId)));

  return NextResponse.json({ ok: true });
}
