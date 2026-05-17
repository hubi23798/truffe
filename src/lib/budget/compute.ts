export type BudgetStatus = "no_target" | "on_track" | "getting_close" | "over_budget";

export interface BudgetResult {
  status: BudgetStatus;
  ratio: number | null;
}

export const BUDGET_WARN_THRESHOLD = 0.8;

export function computeBudgetStatus(actual: number, target: number | null): BudgetResult {
  if (target === null || target === 0) return { status: "no_target", ratio: null };
  const ratio = actual / target;
  if (ratio >= 1.0) return { status: "over_budget", ratio };
  if (ratio >= BUDGET_WARN_THRESHOLD) return { status: "getting_close", ratio };
  return { status: "on_track", ratio };
}
