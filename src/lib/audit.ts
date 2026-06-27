import type { Db } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";

export { appendAudit } from "@/lib/audit/append";

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

/** @deprecated Use appendAudit directly. */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await appendAudit(db, {
    tenantId: "00000000-0000-0000-0000-0000000000aa",
    actorUserId: entry.userId ?? null,
    action: entry.action,
    targetType: entry.targetTable,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    context: { actor: entry.actor },
  });
}
