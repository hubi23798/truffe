import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RevolutCsvSource } from "@/lib/ingestion/revolut-csv";

const HEADERS =
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";

function csv(...rows: string[]): Buffer {
  return Buffer.from([HEADERS, ...rows].join("\n"));
}

const ROW_A =
  "CARD_PAYMENT,Current,2026-01-15 10:00:00,2026-01-15 10:01:00,Spotify,-9.99,0.00,EUR,COMPLETED,990.01";
const ROW_B =
  "CARD_PAYMENT,Current,2026-01-16 09:00:00,2026-01-16 09:01:00,Netflix,-13.99,0.00,EUR,COMPLETED,976.02";

const src = new RevolutCsvSource();

describe("externalId deduplication invariants", () => {
  it("parsing the same row twice produces the same externalId", () => {
    const { rows: first } = src.parse(csv(ROW_A));
    const { rows: second } = src.parse(csv(ROW_A));
    expect(first[0]!.txn.externalId).toBe(second[0]!.txn.externalId);
  });

  it("two different rows produce different externalIds", () => {
    const { rows } = src.parse(csv(ROW_A, ROW_B));
    expect(rows[0]!.txn.externalId).not.toBe(rows[1]!.txn.externalId);
  });

  it("externalId is a 64-char hex SHA-256 string", () => {
    const { rows } = src.parse(csv(ROW_A));
    expect(rows[0]!.txn.externalId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("externalId matches expected SHA-256 of started|completed|amount|fee|description", () => {
    const { rows } = src.parse(csv(ROW_A));
    const expected = createHash("sha256")
      .update(["2026-01-15 10:00:00", "2026-01-15 10:01:00", "-9.99", "0.00", "Spotify"].join("|"))
      .digest("hex");
    expect(rows[0]!.txn.externalId).toBe(expected);
  });

  it("changing any field changes the externalId", () => {
    const rowAltAmount =
      "CARD_PAYMENT,Current,2026-01-15 10:00:00,2026-01-15 10:01:00,Spotify,-10.00,0.00,EUR,COMPLETED,990.01";
    const { rows: orig } = src.parse(csv(ROW_A));
    const { rows: alt } = src.parse(csv(rowAltAmount));
    expect(orig[0]!.txn.externalId).not.toBe(alt[0]!.txn.externalId);
  });
});

describe("import idempotency invariants (parser-level)", () => {
  it("parsing the same CSV file twice yields identical rows", () => {
    const { rows: r1 } = src.parse(csv(ROW_A, ROW_B));
    const { rows: r2 } = src.parse(csv(ROW_A, ROW_B));
    expect(r1.map((r) => r.txn.externalId)).toEqual(r2.map((r) => r.txn.externalId));
  });

  it("row order is preserved (first row in CSV = first in result)", () => {
    const { rows } = src.parse(csv(ROW_A, ROW_B));
    // ROW_A starts 2026-01-15, ROW_B starts 2026-01-16
    expect(rows[0]!.txn.startedAt < rows[1]!.txn.startedAt).toBe(true);
  });
});

describe("multi-account CSV invariants", () => {
  const DEPOSIT_ROW =
    "TRANSFER,Deposit,2026-01-10 08:00:00,,Savings deposit,500.00,0.00,EUR,COMPLETED,500.00";

  it("returns different account hints for Current vs Deposit product", () => {
    const { rows } = src.parse(csv(ROW_A, DEPOSIT_ROW));
    const hints = rows.map((r) => r.accountHint.externalAccountId);
    expect(hints).toContain("EUR|Current");
    expect(hints).toContain("EUR|Deposit");
  });

  it("groups rows by externalAccountId correctly", () => {
    const { rows } = src.parse(csv(ROW_A, ROW_B, DEPOSIT_ROW));
    const current = rows.filter((r) => r.accountHint.externalAccountId === "EUR|Current");
    const deposit = rows.filter((r) => r.accountHint.externalAccountId === "EUR|Deposit");
    expect(current).toHaveLength(2);
    expect(deposit).toHaveLength(1);
  });
});
