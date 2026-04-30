import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { challenge as challengeTable } from "@/lib/db/schema";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type ChallengePurpose = "register" | "login";

export interface IssuedChallenge {
  id: string;
  challenge: string;
  expiresAt: Date;
}

/**
 * Issue a fresh WebAuthn challenge. Caller stores the returned id, ships
 * the challenge value to the browser, then validates it on response.
 */
export async function issueChallenge(
  db: Db,
  purpose: ChallengePurpose,
  userId?: string,
): Promise<IssuedChallenge> {
  const challenge = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const [row] = await db
    .insert(challengeTable)
    .values({ challenge, purpose, expiresAt, userId })
    .returning({
      id: challengeTable.id,
      challenge: challengeTable.challenge,
      expiresAt: challengeTable.expiresAt,
    });
  if (!row) throw new Error("Failed to issue challenge");
  return { id: row.id, challenge: row.challenge, expiresAt: row.expiresAt };
}

/**
 * Consume a challenge once. Returns the challenge value + userId on success;
 * null if the row is missing, already consumed, expired, or has the wrong
 * purpose. Single-use: success path marks consumed = true.
 */
export async function consumeChallenge(
  db: Db,
  challengeId: string,
  expectedPurpose: ChallengePurpose,
): Promise<{ challenge: string; userId: string | null } | null> {
  const row = await db.query.challenge.findFirst({
    where: eq(challengeTable.id, challengeId),
  });
  if (!row) return null;
  if (row.consumed) return null;
  if (row.purpose !== expectedPurpose) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.update(challengeTable).set({ consumed: true }).where(eq(challengeTable.id, challengeId));
  return { challenge: row.challenge, userId: row.userId };
}
