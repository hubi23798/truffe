import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { loginAttempt } from "@/lib/db/schema";

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX = 5;

/**
 * Returns true if `ip` has exceeded LOGIN_RATE_LIMIT_MAX attempts within
 * the past LOGIN_RATE_LIMIT_WINDOW_MS milliseconds. Caller should respond
 * 429 in that case.
 */
export async function isLoginRateLimited(db: Db, ip: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempt)
    .where(and(eq(loginAttempt.ip, ip), gt(loginAttempt.attemptedAt, cutoff)));
  const count = rows[0]?.count ?? 0;
  return count >= LOGIN_RATE_LIMIT_MAX;
}

/** Append-only record of a login attempt (success or fail) for rate limiting. */
export async function recordLoginAttempt(db: Db, ip: string): Promise<void> {
  await db.insert(loginAttempt).values({ ip });
}
