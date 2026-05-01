import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { destroySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

/**
 * POST /api/auth/logout
 *
 * Idempotent: clears the cookie and (if a session id is present) deletes
 * the server-side session row + audits. Returns 200 either way.
 */
export async function POST() {
  const db = getDb();
  const sid = await readSessionCookie();
  if (sid) {
    await destroySession(db, sid);
    await recordAudit(db, { actor: "user", action: "logout" });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
