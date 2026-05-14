import type { Db } from "@/lib/db/client";
import { applyRules } from "./rules";
import { applyTransferHeuristic } from "./transfer-heuristic";

export interface CategorizeResult {
  ruleMatches: number;
  transferMatches: number;
}

/**
 * Run the categorization pipeline on a set of newly inserted transaction IDs.
 * Order: rules pass first, then transfer heuristic on still-uncategorized rows.
 */
export async function categorize(db: Db, transactionIds: string[]): Promise<CategorizeResult> {
  const ruleMatches = await applyRules(db, transactionIds);
  const transferMatches = await applyTransferHeuristic(db, transactionIds);
  return { ruleMatches, transferMatches };
}
