import bcrypt from "bcryptjs";

/**
 * A precomputed bcrypt hash used as a dummy compare target when the
 * provided email doesn't match the admin email. Running bcrypt.compare
 * regardless keeps the response time independent of which check failed,
 * which mitigates email-enumeration timing attacks.
 *
 * The hash itself is never matchable — its plaintext is random and
 * discarded at startup. Cost factor matches a typical ADMIN_PASSWORD hash
 * (12) so the timing matches.
 */
const DUMMY_HASH = bcrypt.hashSync(
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"),
  12,
);

/**
 * Constant-time-ish password verification.
 *
 *  - If `expectedHash` is falsy (e.g. unknown user), still runs a bcrypt
 *    compare against DUMMY_HASH so total elapsed time is comparable.
 *  - If the email/user is known, compares against `expectedHash`.
 *
 * Returns true only when the supplied password matches the real hash.
 */
export async function verifyPassword(
  supplied: string,
  expectedHash: string | null,
): Promise<boolean> {
  if (!expectedHash) {
    await bcrypt.compare(supplied, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(supplied, expectedHash);
}

/**
 * Constant-time string comparison. Use for email check so a longer-or-
 * shorter mismatch doesn't leak through string equality timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  if (aBuf.length !== bBuf.length) {
    // Still touch every byte of `a` to keep timing roughly independent
    // of length difference.
    let acc = 0;
    for (let i = 0; i < aBuf.length; i++) acc |= aBuf[i]!;
    void acc;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) diff |= aBuf[i]! ^ bBuf[i]!;
  return diff === 0;
}
