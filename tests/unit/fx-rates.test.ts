import { describe, expect, it, vi } from "vitest";
import { getFxRate, storeRates } from "@/lib/fx/rates";
import type { Db } from "@/lib/db/client";

function makeDb(rateRow: { rateToBase: string } | null) {
  return {
    query: {
      fxRate: {
        findFirst: vi.fn().mockResolvedValue(rateRow),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  } as unknown as Db;
}

describe("getFxRate", () => {
  it("returns 1 for EUR (base currency)", async () => {
    const db = makeDb(null);
    expect(await getFxRate(db, "EUR", "2026-01-15")).toBe(1);
    expect(db.query.fxRate.findFirst).not.toHaveBeenCalled();
  });

  it("returns the stored rate as a number when found", async () => {
    const db = makeDb({ rateToBase: "1.0823" });
    const rate = await getFxRate(db, "USD", "2026-01-15");
    expect(rate).toBe(1.0823);
  });

  it("returns 1 (graceful fallback) when no rate exists in the DB", async () => {
    const db = makeDb(null);
    const rate = await getFxRate(db, "USD", "2026-01-15");
    expect(rate).toBe(1);
  });

  it("queries by currency and date (lte lookup for fallback to prior date)", async () => {
    const db = makeDb({ rateToBase: "4.2500" });
    await getFxRate(db, "PLN", "2026-06-01");
    expect(db.query.fxRate.findFirst).toHaveBeenCalledOnce();
  });
});

describe("storeRates", () => {
  it("returns 0 when given an empty array", async () => {
    const db = makeDb(null);
    const stored = await storeRates(db, []);
    expect(stored).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("inserts rates and returns the count", async () => {
    const db = makeDb(null);
    const rates = [
      { date: "2026-01-15", currency: "USD", rate: 1.0823 },
      { date: "2026-01-15", currency: "PLN", rate: 4.25 },
    ];
    const stored = await storeRates(db, rates);
    expect(stored).toBe(2);
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("splits into chunks of 500 rows", async () => {
    const db = makeDb(null);
    const rates = Array.from({ length: 1001 }, (_, i) => ({
      date: "2026-01-15",
      currency: `C${i}`,
      rate: 1.0,
    }));
    const stored = await storeRates(db, rates);
    // 1001 rows → 3 chunks (500 + 500 + 1)
    expect(db.insert).toHaveBeenCalledTimes(3);
    expect(stored).toBe(1001);
  });
});
