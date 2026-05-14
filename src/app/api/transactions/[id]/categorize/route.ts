import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { account, transaction } from "@/lib/db/schema";
import { PRIMARY_USER_ID } from "@/lib/db/schema";
import { env } from "@/env";

async function auth() {
  const sid = (await cookies()).get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return readSession(getDb(), sid);
}

const bodySchema = z.object({
  categoryId: z.string().uuid(),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Props) {
  if (!(await auth())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();

  // Verify the transaction belongs to the user via account ownership
  const txn = await db.query.transaction.findFirst({
    where: eq(transaction.id, id),
    columns: { id: true, accountId: true },
  });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acct = await db.query.account.findFirst({
    where: and(eq(account.id, txn.accountId), eq(account.userId, PRIMARY_USER_ID)),
    columns: { id: true },
  });
  if (!acct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(transaction)
    .set({
      categoryId: body.data.categoryId,
      categorizedBy: "manual",
      categorizationRuleId: null,
    })
    .where(eq(transaction.id, id))
    .returning({ id: transaction.id, categoryId: transaction.categoryId });

  return NextResponse.json(updated);
}
