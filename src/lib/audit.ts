import type { Db } from "@/lib/db/client";
import { PRIMARY_TENANT_ID } from "@/lib/db/schema";
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

/** @deprecated Use appendAudit directly. tenantId hardcoded to PRIMARY_TENANT_ID — safe during migration window (single tenant). */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await appendAudit(db, {
    tenantId: PRIMARY_TENANT_ID,
    actorUserId: entry.userId ?? null,
    action: entry.action,
    targetType: entry.targetTable,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    context: { actor: entry.actor },
  });
}
