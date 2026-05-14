import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  PRIMARY_USER_ID,
  account,
  importBatch,
  importBatchRejection,
  transaction,
} from "@/lib/db/schema";
import { categorize } from "@/lib/categorization/categorize";
import { backfillSnapshots } from "@/lib/net-worth/snapshots";
import { RevolutCsvSource } from "./revolut-csv";
import type { AccountHint } from "./types";

export class DuplicateFileError extends Error {
  constructor(public readonly existingBatchId: string) {
    super(`File already imported (batch: ${existingBatchId})`);
    this.name = "DuplicateFileError";
  }
}

export interface IngestResult {
  batchId: string;
  status: "done" | "partial";
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  dedupedCount: number;
  newAccountNames: string[];
}

async function resolveAccount(db: Db, hint: AccountHint): Promise<{ id: string; isNew: boolean }> {
  const existing = await db.query.account.findFirst({
    where: and(
      eq(account.userId, PRIMARY_USER_ID),
      eq(account.externalProvider, "revolut"),
      eq(account.externalAccountId, hint.externalAccountId),
    ),
    columns: { id: true },
  });

  if (existing) return { id: existing.id, isNew: false };

  const [created] = await db
    .insert(account)
    .values({
      userId: PRIMARY_USER_ID,
      name: hint.suggestedName,
      kind: hint.suggestedKind,
      currency: hint.currency,
      isLiquid: hint.isLiquid,
      externalProvider: "revolut",
      externalAccountId: hint.externalAccountId,
    })
    .returning({ id: account.id });

  return { id: created!.id, isNew: true };
}

export async function ingest(db: Db, file: Buffer): Promise<IngestResult> {
  const fileSha256 = createHash("sha256").update(file).digest("hex");

  // File-level dedup: same sha256 → idempotent no-op
  const existing = await db.query.importBatch.findFirst({
    where: eq(importBatch.fileSha256, fileSha256),
    columns: { id: true },
  });
  if (existing) throw new DuplicateFileError(existing.id);

  const source = new RevolutCsvSource();
  const parsed = source.parse(file);

  const [batch] = await db
    .insert(importBatch)
    .values({
      sourceKind: "revolut_csv",
      fileSha256,
      status: "parsing",
      rowCount: parsed.rows.length + parsed.rejections.length,
      importedByUserId: PRIMARY_USER_ID,
    })
    .returning({ id: importBatch.id });
  const batchId = batch!.id;

  // Resolve accounts (create on first sight)
  const accountCache = new Map<string, string>();
  const newAccountNames: string[] = [];

  for (const { accountHint } of parsed.rows) {
    const key = accountHint.externalAccountId;
    if (accountCache.has(key)) continue;
    const { id, isNew } = await resolveAccount(db, accountHint);
    accountCache.set(key, id);
    if (isNew) newAccountNames.push(accountHint.suggestedName);
  }

  // Insert transactions inside a DB transaction
  let acceptedCount = 0;
  let dedupedCount = 0;
  const allRejections = [...parsed.rejections];
  const acceptedIds: string[] = [];

  try {
    await db.transaction(async (tx) => {
      for (const { txn, accountHint } of parsed.rows) {
        const accountId = accountCache.get(accountHint.externalAccountId)!;

        const inserted = await tx
          .insert(transaction)
          .values({
            accountId,
            externalId: txn.externalId,
            startedAt: txn.startedAt,
            completedAt: txn.completedAt,
            amountNative: txn.amountNative,
            feeNative: txn.feeNative,
            currency: txn.currency,
            state: txn.state,
            descriptionRaw: txn.descriptionRaw,
            typeRaw: txn.typeRaw,
            productRaw: txn.productRaw,
            runningBalanceNative: txn.runningBalanceNative,
            importBatchId: batchId,
          })
          .onConflictDoNothing()
          .returning({ id: transaction.id });

        if (inserted.length > 0) {
          acceptedCount++;
          acceptedIds.push(inserted[0]!.id);
        } else {
          dedupedCount++;
        }
      }
    });
  } catch (e) {
    await db
      .update(importBatch)
      .set({ status: "failed" })
      .where(eq(importBatch.id, batchId));
    throw e;
  }

  // Post-ingestion: categorize new rows, then refresh balance snapshots
  if (acceptedIds.length > 0) {
    await categorize(db, acceptedIds);
    await backfillSnapshots(db);
  }

  if (allRejections.length > 0) {
    await db.insert(importBatchRejection).values(
      allRejections.map((r) => ({
        importBatchId: batchId,
        rowIndex: r.rowIndex,
        rawRowJson: r.rawRow,
        reason: r.reason,
      })),
    );
  }

  const finalStatus = allRejections.length > 0 ? "partial" : "done";
  await db
    .update(importBatch)
    .set({ status: finalStatus, acceptedCount, rejectedCount: allRejections.length })
    .where(eq(importBatch.id, batchId));

  return {
    batchId,
    status: finalStatus,
    rowCount: parsed.rows.length + parsed.rejections.length,
    acceptedCount,
    rejectedCount: allRejections.length,
    dedupedCount,
    newAccountNames,
  };
}
