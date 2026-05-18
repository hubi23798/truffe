import { describe, expect, it } from "vitest";
import { computeBudgetProposal } from "@/lib/recurring/budget-proposal";

describe("computeBudgetProposal", () => {
  it("returns none when categoryId is null", () => {
    expect(computeBudgetProposal(null, -8999, null)).toEqual({ action: "none" });
  });

  it("returns none when categoryId is null even with existing target", () => {
    expect(computeBudgetProposal(null, -8999, 8000)).toEqual({ action: "none" });
  });

  it("returns create when category set and no existing target", () => {
    expect(computeBudgetProposal("cat-1", -8999, null)).toEqual({
      action: "create",
      amount: 8999,
    });
  });

  it("returns create for income (positive amount) with no existing target", () => {
    expect(computeBudgetProposal("cat-1", 175000, null)).toEqual({
      action: "create",
      amount: 175000,
    });
  });

  it("returns none when category set and amounts match", () => {
    expect(computeBudgetProposal("cat-1", -8999, 8999)).toEqual({ action: "none" });
  });

  it("returns conflict when category set and amounts differ", () => {
    expect(computeBudgetProposal("cat-1", -8999, 8000)).toEqual({
      action: "conflict",
      existingAmount: 8000,
      proposedAmount: 8999,
    });
  });

  it("returns conflict when existing target is higher than subscription", () => {
    expect(computeBudgetProposal("cat-1", -6000, 9000)).toEqual({
      action: "conflict",
      existingAmount: 9000,
      proposedAmount: 6000,
    });
  });
});
