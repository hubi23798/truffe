import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { auditLogV2 } from "@/lib/db/schema";
import { computeHash } from "./hash-chain";

export interface AppendParams {
  tenantId: string;
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  context?: unknown;
}

const ZERO_HASH = Buffer.alloc(32, 0);

export async function appendAudit(db: Db, params: AppendParams): Promise<number> {
  return db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ thisHash: auditLogV2.thisHash })
      .from(auditLogV2)
      .where(eq(auditLogV2.tenantId, params.tenantId))
      .orderBy(desc(auditLogV2.id))
      .limit(1);

    const prevHash = prev?.thisHash ?? ZERO_HASH;
    const payload = {
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      context: params.context ?? null,
    };
    const thisHash = computeHash(prevHash, payload);

    const [row] = await tx
      .insert(auditLogV2)
      .values({ ...payload, prevHash, thisHash })
      .returning({ id: auditLogV2.id });
    if (!row) throw new Error("appendAudit: insert returned no row");
    return row.id;
  });
}

export function __resetForTests() {
  // noop; reserved for future stateful test resets
}
