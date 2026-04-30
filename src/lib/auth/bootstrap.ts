import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { bootstrapToken } from "@/lib/db/schema";

export const BOOTSTRAP_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// -- Pure crypto helpers ----------------------------------------------

/** Generate a 32-byte url-safe token (base64url, ~43 chars). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of the token, returned as 64-char lowercase hex. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of a raw token against a stored hex hash. */
export function verifyToken(provided: string, knownHash: string): boolean {
  const a = Buffer.from(hashToken(provided), "hex");
  const b = Buffer.from(knownHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// -- DB-touching helpers ----------------------------------------------

/** Issue a fresh bootstrap token. Stores its hash; returns the raw value. */
export async function issueBootstrapToken(db: Db): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + BOOTSTRAP_TOKEN_TTL_MS);
  await db.insert(bootstrapToken).values({ tokenHash: hashToken(token), expiresAt });
  return token;
}

/**
 * Single-use redemption. Returns true on success, false otherwise.
 *
 * Single-use is enforced by filtering candidates with `isNull(consumedAt)` —
 * once a row's `consumedAt` is set, it never appears in the candidate list
 * again, so a second redemption attempt for the same token returns false.
 *
 * Expired rows are also rejected.
 */
export async function redeemBootstrapToken(db: Db, provided: string): Promise<boolean> {
  const candidates = await db
    .select()
    .from(bootstrapToken)
    .where(isNull(bootstrapToken.consumedAt));
  const now = Date.now();
  for (const row of candidates) {
    if (row.expiresAt.getTime() < now) continue;
    if (verifyToken(provided, row.tokenHash)) {
      await db
        .update(bootstrapToken)
        .set({ consumedAt: new Date() })
        .where(eq(bootstrapToken.id, row.id));
      return true;
    }
  }
  return false;
}
