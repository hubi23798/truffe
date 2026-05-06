import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { setSessionCookie } from "@/lib/auth/cookies";
import { timingSafeEqual, verifyPassword } from "@/lib/auth/password";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID } from "@/lib/db/schema";
import { env } from "@/env";

const bodySchema = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(512),
});

/**
 * POST /api/auth/login
 *
 * Single-user email + password login. Replaces the passkey ceremony.
 *
 * Steps:
 *   1. Parse body (zod).
 *   2. Per-IP rate limit (5 attempts / 15 min) — returns 429 when exceeded.
 *   3. Always record the attempt (so rate limit tracks both fail + success).
 *   4. Always run bcrypt.compare (against ADMIN_PASSWORD hash on email match,
 *      against a dummy hash otherwise) so timing doesn't leak email validity.
 *   5. On success: create session, set cookie, audit, 200 ok.
 *   6. On failure: audit (no userId), 401 invalid credentials.
 */
export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ip = clientIp(req);
  const db = getDb();

  if (await isLoginRateLimited(db, ip)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  await recordLoginAttempt(db, ip);

  const e = env();
  const emailMatches = timingSafeEqual(
    parsed.data.email.toLowerCase(),
    e.ADMIN_EMAIL.toLowerCase(),
  );
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    emailMatches ? e.ADMIN_PASSWORD : null,
  );

  if (!emailMatches || !passwordMatches) {
    await recordAudit(db, { actor: "user", action: "login.failed" });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sess = await createSession(db, PRIMARY_USER_ID, userAgent);
  await setSessionCookie(sess.id, sess.expiresAt);
  await recordAudit(db, { actor: "user", action: "login.ok", userId: PRIMARY_USER_ID });
  return NextResponse.json({ ok: true });
}

/**
 * Best-effort client IP extraction. Vercel and most proxies set
 * x-forwarded-for; first hop is the original client. Fallback "unknown"
 * still rate-limits (anyone hitting the endpoint without a proxy header
 * shares the same bucket — fine for a personal app).
 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
