import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { consumeChallenge } from "@/lib/auth/challenges";
import { clearEnrollmentCookie, setSessionCookie } from "@/lib/auth/cookies";
import { createSession } from "@/lib/auth/session";
import { verifyRegistration } from "@/lib/auth/webauthn";
import { getDb } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.unknown(),
  nickname: z.string().max(60).optional(),
});

interface RegistrationResponseTransports {
  response?: { transports?: string[] };
}

/**
 * POST /api/auth/register/verify
 *
 * Consumes the challenge issued by /options, verifies the WebAuthn
 * registration response, persists the new passkey_credential, mints a
 * session (one per user, see session.ts), sets the session cookie, and
 * clears the enrollment cookie. Audited.
 */
export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const consumed = await consumeChallenge(db, parsed.data.challengeId, "register");
  if (!consumed || !consumed.userId) {
    return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
  }

  // SimpleWebAuthn validates the full response; we don't pre-shape it.
  const result = await verifyRegistration(
    parsed.data.response as Parameters<typeof verifyRegistration>[0],
    consumed.challenge,
  );
  if (!result.verified || !result.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 401 });
  }

  const reg = result.registrationInfo;
  const transports =
    (parsed.data.response as RegistrationResponseTransports)?.response?.transports ?? [];

  await db.insert(passkeyCredential).values({
    userId: consumed.userId,
    credentialId: reg.credential.id,
    publicKey: Buffer.from(reg.credential.publicKey).toString("base64"),
    signCount: Number(reg.credential.counter ?? 0),
    transports,
    nickname: parsed.data.nickname,
  });

  await recordAudit(db, {
    actor: "user",
    action: "passkey.register",
    userId: consumed.userId,
  });

  await clearEnrollmentCookie();
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sess = await createSession(db, consumed.userId, userAgent);
  await setSessionCookie(sess.id, sess.expiresAt);
  return NextResponse.json({ ok: true });
}
