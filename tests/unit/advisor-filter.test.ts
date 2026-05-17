import { describe, expect, it } from "vitest";
import { DISCLAIMER, applyOutputFilter } from "@/lib/advisor/filter";

describe("applyOutputFilter — ticker detection", () => {
  it("flags AAPL", () => {
    const r = applyOutputFilter("AAPL is a great stock");
    expect(r.ok).toBe(false);
    expect(r.flaggedTicker).toBe("AAPL");
  });

  it("flags TSLA", () => {
    const r = applyOutputFilter("Buy TSLA now");
    expect(r.ok).toBe(false);
  });

  it("flags BTC", () => {
    const r = applyOutputFilter("BTC is volatile");
    expect(r.ok).toBe(false);
  });

  it("passes EUR (safe cap)", () => {
    const r = applyOutputFilter("EUR is your base currency");
    expect(r.ok).toBe(true);
  });

  it("passes ETA (safe cap)", () => {
    const r = applyOutputFilter("ETA for your goal is 5 years");
    expect(r.ok).toBe(true);
  });

  it("passes ETF (safe cap)", () => {
    const r = applyOutputFilter("A global equity ETF is fine");
    expect(r.ok).toBe(true);
  });
});

describe("applyOutputFilter — disclaimer", () => {
  it("always appends DISCLAIMER when ok", () => {
    const r = applyOutputFilter("Your spending is on track.");
    expect(r.ok).toBe(true);
    expect(r.text).toContain(DISCLAIMER);
  });
});

describe("applyOutputFilter — length cap", () => {
  it("flags text approximating over 4000 tokens", () => {
    // ~4 chars per token; 3201 * 5 = 16005 chars ≈ 4001 tokens
    const longText = "word ".repeat(3201);
    const r = applyOutputFilter(longText);
    expect(r.ok).toBe(false);
  });

  it("passes text under 4000 tokens", () => {
    const shortText = "word ".repeat(100);
    const r = applyOutputFilter(shortText);
    expect(r.ok).toBe(true);
  });
});
