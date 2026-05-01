import { NextResponse } from "next/server";
import { issueChallenge } from "@/lib/auth/challenges";
import { readEnrollmentCookie } from "@/lib/auth/cookies";
import { buildRegistrationOptions } from "@/lib/auth/webauthn";
import { getDb } from "@/lib/db/client";
import { user as userTable } from "@/lib/db/schema";

/**
 * POST /api/auth/register/options
 *
 * Gated by the enrollment cookie (set by /api/auth/bootstrap on a valid
 * single-use token). Phase 0: at most one user — find-or-create on the
 * first successful ceremony. Returns the WebAuthn creation options +
 * the issued challenge id, which the client echoes back to /verify.
 */
export async function POST() {
  const enrollment = await readEnrollmentCookie();
  if (!enrollment) {
    return NextResponse.json({ error: "enrollment_not_authorized" }, { status: 401 });
  }

  const db = getDb();

  const existing = await db.query.user.findFirst();
  let userId: string;
  let userName: string;
  if (existing) {
    userId = existing.id;
    userName = `user-${existing.id.slice(0, 8)}`;
  } else {
    const [created] = await db.insert(userTable).values({}).returning({ id: userTable.id });
    if (!created) {
      return NextResponse.json({ error: "user_create_failed" }, { status: 500 });
    }
    userId = created.id;
    userName = `user-${userId.slice(0, 8)}`;
  }

  const options = await buildRegistrationOptions(db, userId, userName);
  const issued = await issueChallenge(db, "register", userId);
  return NextResponse.json({ options, challengeId: issued.id });
}
