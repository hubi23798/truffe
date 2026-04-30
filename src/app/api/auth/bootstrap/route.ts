import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { redeemBootstrapToken } from "@/lib/auth/bootstrap";
import { setEnrollmentCookie } from "@/lib/auth/cookies";
import { getDb } from "@/lib/db/client";

const bodySchema = z.object({ token: z.string().min(1).max(256) });

/**
 * POST /api/auth/bootstrap
 *
 * Body: { token: string }
 *
 * Verifies a single-use bootstrap token. On success, mints a short-lived
 * enrollment nonce cookie that the passkey registration ceremony (Task 15)
 * will require. Audit-logged either way.
 */
export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const ok = await redeemBootstrapToken(db, parsed.data.token);
  if (!ok) {
    await recordAudit(db, { actor: "system", action: "bootstrap.redeem.failed" });
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const enrollmentNonce = randomBytes(16).toString("base64url");
  await setEnrollmentCookie(enrollmentNonce);
  await recordAudit(db, { actor: "system", action: "bootstrap.redeem.ok" });
  return NextResponse.json({ ok: true });
}
