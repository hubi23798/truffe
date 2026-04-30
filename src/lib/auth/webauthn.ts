import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";
import { env } from "@/env";

/**
 * Generate registration options for a fresh enrollment ceremony.
 * Excludes already-enrolled credentials so the same authenticator can't
 * be enrolled twice. attestationType=none keeps things simple — we don't
 * try to verify which authenticator was used. userVerification=required
 * means the platform must prompt for Touch ID / Face ID / PIN.
 */
export async function buildRegistrationOptions(
  db: Db,
  userId: string,
  userName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const e = env();
  const existing = await db.query.passkeyCredential.findMany({
    where: eq(passkeyCredential.userId, userId),
  });
  return generateRegistrationOptions({
    rpName: e.RP_NAME,
    rpID: e.RP_ID,
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
  });
}

/** Verify the browser's attestation response against the issued challenge. */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const e = env();
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: e.ORIGIN,
    expectedRPID: e.RP_ID,
    requireUserVerification: true,
  });
}

/**
 * Generate authentication options. With a userId, restrict to that user's
 * credentials; without it, allow any discoverable credential (smoother UX
 * for the "passkey on this device" flow).
 */
export async function buildAuthenticationOptions(
  db: Db,
  userId?: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const e = env();
  const allow = userId
    ? (
        await db.query.passkeyCredential.findMany({
          where: eq(passkeyCredential.userId, userId),
        })
      ).map((c) => ({
        id: c.credentialId,
        transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      }))
    : undefined;
  return generateAuthenticationOptions({
    rpID: e.RP_ID,
    userVerification: "required",
    allowCredentials: allow,
  });
}

/** Verify a browser's assertion response against a stored credential. */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
) {
  const e = env();
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: e.ORIGIN,
    expectedRPID: e.RP_ID,
    credential,
    requireUserVerification: true,
  });
}
