import { describe, expect, it } from "vitest";
import { computeBudgetStatus } from "@/lib/budget/compute";

describe("computeBudgetStatus", () => {
  it("returns no_target when target is null", () => {
    expect(computeBudgetStatus(500, null)).toEqual({ status: "no_target", ratio: null });
  });

  it("returns no_target when target is 0 (divide-by-zero guard)", () => {
    expect(computeBudgetStatus(500, 0)).toEqual({ status: "no_target", ratio: null });
  });

  it("returns on_track at 0% spent", () => {
    const r = computeBudgetStatus(0, 10000);
    expect(r.status).toBe("on_track");
    expect(r.ratio).toBe(0);
  });

  it("returns on_track at 79% spent", () => {
    const r = computeBudgetStatus(7900, 10000);
    expect(r.status).toBe("on_track");
    expect(r.ratio).toBeCloseTo(0.79);
  });

  it("returns getting_close at exactly 80% spent", () => {
    const r = computeBudgetStatus(8000, 10000);
    expect(r.status).toBe("getting_close");
    expect(r.ratio).toBe(0.8);
  });

  it("returns getting_close at 99% spent", () => {
    const r = computeBudgetStatus(9900, 10000);
    expect(r.status).toBe("getting_close");
    expect(r.ratio).toBeCloseTo(0.99);
  });

  it("returns over_budget at exactly 100% spent", () => {
    const r = computeBudgetStatus(10000, 10000);
    expect(r.status).toBe("over_budget");
    expect(r.ratio).toBe(1.0);
  });

  it("returns over_budget at 120% spent", () => {
    const r = computeBudgetStatus(12000, 10000);
    expect(r.status).toBe("over_budget");
    expect(r.ratio).toBeCloseTo(1.2);
  });
});
