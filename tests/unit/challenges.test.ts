import { describe, expect, it, vi } from "vitest";
import { CHALLENGE_TTL_MS, consumeChallenge, issueChallenge } from "@/lib/auth/challenges";

type Inserted = Record<string, unknown>;

function makeIssueDb(captured: Inserted[] = []) {
  return {
    insert: () => ({
      values: (v: Inserted) => {
        captured.push(v);
        return {
          returning: () =>
            Promise.resolve([{ id: "cid", challenge: v.challenge, expiresAt: v.expiresAt }]),
        };
      },
    }),
  } as unknown as Parameters<typeof issueChallenge>[0];
}

interface FakeRow {
  id: string;
  challenge: string;
  purpose: string;
  consumed: boolean;
  expiresAt: Date;
  userId: string | null;
}

function makeConsumeDb(row: FakeRow | undefined, updated: unknown[] = []) {
  return {
    query: { challenge: { findFirst: vi.fn().mockResolvedValue(row ?? null) } },
    update: () => ({
      set: (v: unknown) => ({
        where: () => {
          updated.push(v);
          return Promise.resolve();
        },
      }),
    }),
  } as unknown as Parameters<typeof consumeChallenge>[0];
}

const freshRow = (overrides: Partial<FakeRow> = {}): FakeRow => ({
  id: "cid",
  challenge: "abc",
  purpose: "register",
  consumed: false,
  expiresAt: new Date(Date.now() + 60_000),
  userId: null,
  ...overrides,
});

describe("CHALLENGE_TTL_MS", () => {
  it("is 5 minutes", () => {
    expect(CHALLENGE_TTL_MS).toBe(5 * 60 * 1000);
  });
});

describe("issueChallenge", () => {
  it("inserts purpose + userId and returns id, base64url challenge, expiresAt = now + TTL", async () => {
    const captured: Inserted[] = [];
    const before = Date.now();
    const out = await issueChallenge(makeIssueDb(captured), "register", "user-1");
    const after = Date.now();
    expect(out.id).toBe("cid");
    expect(typeof out.challenge).toBe("string");
    expect(out.challenge.length).toBeGreaterThan(0);
    expect(out.expiresAt.getTime()).toBeGreaterThanOrEqual(before + CHALLENGE_TTL_MS);
    expect(out.expiresAt.getTime()).toBeLessThanOrEqual(after + CHALLENGE_TTL_MS);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.purpose).toBe("register");
    expect(captured[0]!.userId).toBe("user-1");
  });
});

describe("consumeChallenge", () => {
  it("returns the challenge value and marks the row consumed on a fresh matching row", async () => {
    const updated: unknown[] = [];
    const out = await consumeChallenge(makeConsumeDb(freshRow(), updated), "cid", "register");
    expect(out).toEqual({ challenge: "abc", userId: null });
    expect(updated).toEqual([{ consumed: true }]);
  });

  it("returns null when no row is found", async () => {
    const out = await consumeChallenge(makeConsumeDb(undefined), "cid", "register");
    expect(out).toBeNull();
  });

  it("returns null when the row is already consumed", async () => {
    const out = await consumeChallenge(
      makeConsumeDb(freshRow({ consumed: true })),
      "cid",
      "register",
    );
    expect(out).toBeNull();
  });

  it("returns null when expiresAt is in the past", async () => {
    const out = await consumeChallenge(
      makeConsumeDb(freshRow({ expiresAt: new Date(Date.now() - 1) })),
      "cid",
      "register",
    );
    expect(out).toBeNull();
  });

  it("returns null when the purpose does not match", async () => {
    const out = await consumeChallenge(
      makeConsumeDb(freshRow({ purpose: "login" })),
      "cid",
      "register",
    );
    expect(out).toBeNull();
  });
});
