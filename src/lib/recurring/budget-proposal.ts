export type BudgetProposalAction =
  | { action: "none" }
  | { action: "create"; amount: number }
  | { action: "conflict"; existingAmount: number; proposedAmount: number };

export function computeBudgetProposal(
  categoryId: string | null,
  subscriptionAmount: number,
  existingTarget: number | null,
): BudgetProposalAction {
  if (!categoryId) return { action: "none" };
  const proposed = Math.abs(subscriptionAmount);
  if (existingTarget === null) return { action: "create", amount: proposed };
  if (existingTarget === proposed) return { action: "none" };
  return { action: "conflict", existingAmount: existingTarget, proposedAmount: proposed };
}
