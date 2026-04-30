import { describe, expect, it } from "vitest";
import { isExpired, SESSION_HARD_TTL_MS, SESSION_SLIDING_TTL_MS } from "@/lib/auth/session";

describe("session TTL constants", () => {
  it("sliding TTL is 30 days", () => {
    expect(SESSION_SLIDING_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("hard TTL is 90 days", () => {
    expect(SESSION_HARD_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe("isExpired", () => {
  it("returns true when expiresAt is in the past", () => {
    const expired = {
      expiresAt: new Date(Date.now() - 1_000),
      createdAt: new Date(Date.now() - 1_000),
    };
    expect(isExpired(expired)).toBe(true);
  });

  it("returns true when older than the hard cap, even if expiresAt is future", () => {
    const tooOld = {
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - SESSION_HARD_TTL_MS - 1),
    };
    expect(isExpired(tooOld)).toBe(true);
  });

  it("returns false for a fresh, unexpired session", () => {
    const ok = {
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - 60_000),
    };
    expect(isExpired(ok)).toBe(false);
  });
});
