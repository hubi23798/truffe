import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { consumeChallenge } from "@/lib/auth/challenges";
import { setSessionCookie } from "@/lib/auth/cookies";
import { createSession } from "@/lib/auth/session";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { getDb } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.unknown().optional(),
  }),
});

/**
 * POST /api/auth/login/verify
 *
 * Consumes the login challenge, looks up the credential, verifies the
 * assertion against the stored public key + counter, bumps signCount /
 * lastUsedAt, mints a session (replacing any existing one for the user),
 * sets the session cookie. Audited.
 */
export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const consumed = await consumeChallenge(db, parsed.data.challengeId, "login");
  if (!consumed) {
    return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
  }

  const credentialId = parsed.data.response.id;
  const cred = await db.query.passkeyCredential.findFirst({
    where: eq(passkeyCredential.credentialId, credentialId),
  });
  if (!cred) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 401 });
  }

  const publicKey = new Uint8Array(Buffer.from(cred.publicKey, "base64")) as Parameters<
    typeof verifyAuthentication
  >[2]["publicKey"];

  const result = await verifyAuthentication(
    parsed.data.response as Parameters<typeof verifyAuthentication>[0],
    consumed.challenge,
    {
      id: cred.credentialId,
      publicKey,
      counter: cred.signCount,
    },
  );

  if (!result.verified) {
    await recordAudit(db, {
      actor: "user",
      action: "login.failed",
      userId: cred.userId,
    });
    return NextResponse.json({ error: "verification_failed" }, { status: 401 });
  }

  await db
    .update(passkeyCredential)
    .set({
      signCount: Number(result.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    })
    .where(eq(passkeyCredential.id, cred.id));

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sess = await createSession(db, cred.userId, userAgent);
  await setSessionCookie(sess.id, sess.expiresAt);
  await recordAudit(db, { actor: "user", action: "login.ok", userId: cred.userId });
  return NextResponse.json({ ok: true });
}
