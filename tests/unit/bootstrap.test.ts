import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_TOKEN_TTL_MS,
  hashToken,
  issueBootstrapToken,
  redeemBootstrapToken,
  verifyToken,
} from "@/lib/auth/bootstrap";

// -- Pure crypto helpers ------------------------------------------------

describe("hashToken", () => {
  it("is deterministic and produces 64 hex chars (sha256)", () => {
    const a = hashToken("the-token");
    const b = hashToken("the-token");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(a)).toBe(true);
  });
});

describe("verifyToken", () => {
  it("accepts a matching token and rejects a mismatch", () => {
    const knownHash = hashToken("good-token");
    expect(verifyToken("good-token", knownHash)).toBe(true);
    expect(verifyToken("bad-token", knownHash)).toBe(false);
  });
});

describe("BOOTSTRAP_TOKEN_TTL_MS", () => {
  it("is 1 hour", () => {
    expect(BOOTSTRAP_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});

// -- DB-touching helpers (fake Db) -------------------------------------

interface FakeRow {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function makeRedeemDb(rows: FakeRow[], updated: Array<{ id: string; consumedAt: Date }> = []) {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
    update: () => ({
      set: (v: { consumedAt: Date }) => ({
        where: (predicate: { __id?: string } | unknown) => {
          // The implementation calls .where(eq(bootstrap_token.id, row.id)).
          // We can't introspect the drizzle predicate from a fake; record the
          // update alongside what hashes were available so tests can assert.
          updated.push({ id: rows[0]?.id ?? "?", consumedAt: v.consumedAt });
          void predicate;
          return Promise.resolve();
        },
      }),
    }),
  } as unknown as Parameters<typeof redeemBootstrapToken>[0];
}

function makeIssueDb(captured: Array<{ tokenHash: string; expiresAt: Date }> = []) {
  return {
    insert: () => ({
      values: (v: { tokenHash: string; expiresAt: Date }) => {
        captured.push(v);
        return Promise.resolve();
      },
    }),
  } as unknown as Parameters<typeof issueBootstrapToken>[0];
}

describe("redeemBootstrapToken", () => {
  it("returns true and marks consumedAt when token matches an unconsumed unexpired row", async () => {
    const token = "the-secret-token";
    const row: FakeRow = {
      id: "row-1",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    };
    const updated: Array<{ id: string; consumedAt: Date }> = [];
    const ok = await redeemBootstrapToken(makeRedeemDb([row], updated), token);
    expect(ok).toBe(true);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.consumedAt).toBeInstanceOf(Date);
  });

  it("returns false when there are no candidate rows (covers already-consumed: filtered out by query)", async () => {
    const ok = await redeemBootstrapToken(makeRedeemDb([]), "any-token");
    expect(ok).toBe(false);
  });

  it("returns false when the matching row is expired (skipped, no fallback)", async () => {
    const token = "expired-token";
    const row: FakeRow = {
      id: "row-1",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() - 1),
      consumedAt: null,
      createdAt: new Date(),
    };
    const updated: Array<{ id: string; consumedAt: Date }> = [];
    const ok = await redeemBootstrapToken(makeRedeemDb([row], updated), token);
    expect(ok).toBe(false);
    expect(updated).toHaveLength(0);
  });
});

describe("issueBootstrapToken", () => {
  it("inserts a hashed token + future expiresAt and returns a non-empty raw token", async () => {
    const captured: Array<{ tokenHash: string; expiresAt: Date }> = [];
    const before = Date.now();
    const raw = await issueBootstrapToken(makeIssueDb(captured));
    const after = Date.now();
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeGreaterThan(0);
    expect(captured).toHaveLength(1);
    // Stored value is the hash of the raw token, not the raw token itself.
    expect(captured[0]!.tokenHash).toBe(hashToken(raw));
    expect(captured[0]!.tokenHash).not.toBe(raw);
    expect(captured[0]!.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + BOOTSTRAP_TOKEN_TTL_MS,
    );
    expect(captured[0]!.expiresAt.getTime()).toBeLessThanOrEqual(after + BOOTSTRAP_TOKEN_TTL_MS);
  });
});
