import { describe, it, expect } from "vitest";
import { computeHash, verifyChain } from "@/lib/audit/hash-chain";

describe("computeHash", () => {
  it("is deterministic for the same input", () => {
    const a = computeHash(Buffer.alloc(32, 0), { foo: 1, bar: "x" });
    const b = computeHash(Buffer.alloc(32, 0), { bar: "x", foo: 1 });
    expect(a.equals(b)).toBe(true);
  });

  it("differs when row content differs", () => {
    const a = computeHash(Buffer.alloc(32, 0), { foo: 1 });
    const b = computeHash(Buffer.alloc(32, 0), { foo: 2 });
    expect(a.equals(b)).toBe(false);
  });

  it("differs when prevHash differs", () => {
    const a = computeHash(Buffer.alloc(32, 0), { foo: 1 });
    const b = computeHash(Buffer.alloc(32, 1), { foo: 1 });
    expect(a.equals(b)).toBe(false);
  });
});

describe("verifyChain", () => {
  it("accepts a valid chain", () => {
    const h0 = computeHash(Buffer.alloc(32, 0), { id: 1 });
    const h1 = computeHash(h0, { id: 2 });
    const rows = [
      { prevHash: Buffer.alloc(32, 0), thisHash: h0, payload: { id: 1 } },
      { prevHash: h0, thisHash: h1, payload: { id: 2 } },
    ];
    expect(verifyChain(rows)).toEqual({ valid: true, brokenAt: null });
  });

  it("rejects a tampered row", () => {
    const h0 = computeHash(Buffer.alloc(32, 0), { id: 1 });
    const h1 = computeHash(h0, { id: 2 });
    const rows = [
      { prevHash: Buffer.alloc(32, 0), thisHash: h0, payload: { id: 1 } },
      { prevHash: h0, thisHash: h1, payload: { id: 999 } }, // tampered
    ];
    expect(verifyChain(rows)).toEqual({ valid: false, brokenAt: 1 });
  });
});
