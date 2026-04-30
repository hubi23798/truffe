import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

type Actor = "user" | "advisor" | "system" | "cron";

export interface AuditEntry {
  actor: Actor;
  action: string;
  userId?: string;
  targetTable?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only mutation log. One row per call; no batching, no querying.
 */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    userId: entry.userId,
    targetTable: entry.targetTable,
    targetId: entry.targetId,
    before: entry.before as never,
    after: entry.after as never,
  });
}
