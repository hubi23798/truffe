import { NextResponse } from "next/server";
import { issueChallenge } from "@/lib/auth/challenges";
import { buildAuthenticationOptions } from "@/lib/auth/webauthn";
import { getDb } from "@/lib/db/client";

/**
 * POST /api/auth/login/options
 *
 * No userId: allows the browser to discover credentials on the device
 * (smoother UX after iCloud Keychain sync). Returns the WebAuthn
 * request options + challenge id for /verify to consume.
 */
export async function POST() {
  const db = getDb();
  const options = await buildAuthenticationOptions(db);
  const issued = await issueChallenge(db, "login");
  return NextResponse.json({ options, challengeId: issued.id });
}
