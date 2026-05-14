import { and, desc, eq, lte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { fxRate } from "@/lib/db/schema";

export const BASE_CURRENCY = "EUR";

/**
 * Look up the ECB reference rate for `currency` on or before `date`.
 * Returns 1.0 for the base currency or if no prior rate exists (graceful
 * fallback — should only occur before the first backfill).
 *
 * The stored rate means: 1 EUR = `rate` units of `currency`.
 * Conversion: base_amount = native_amount / rate
 */
export async function getFxRate(db: Db, currency: string, date: string): Promise<number> {
  if (currency === BASE_CURRENCY) return 1;

  const row = await db.query.fxRate.findFirst({
    where: and(eq(fxRate.currency, currency), lte(fxRate.asOfDate, date)),
    orderBy: [desc(fxRate.asOfDate)],
    columns: { rateToBase: true },
  });

  return row ? parseFloat(row.rateToBase) : 1;
}

/**
 * Store ECB rates, skipping any (date, currency) pair already present.
 * Batches in chunks of 500 to stay within postgres parameter limits.
 */
export async function storeRates(
  db: Db,
  rates: Array<{ date: string; currency: string; rate: number }>,
): Promise<number> {
  if (rates.length === 0) return 0;

  const values = rates.map((r) => ({
    asOfDate: r.date,
    currency: r.currency,
    rateToBase: String(r.rate),
  }));

  const CHUNK = 500;
  let stored = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    await db.insert(fxRate).values(chunk).onConflictDoNothing();
    stored += chunk.length;
  }
  return stored;
}
