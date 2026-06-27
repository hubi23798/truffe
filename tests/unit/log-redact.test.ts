import { describe, it, expect } from "vitest";
import { redact } from "@/lib/logging/redact";

describe("redact", () => {
  it("masks access tokens", () => {
    expect(redact({ access_token: "abc.def.ghi" })).toEqual({ access_token: "[redacted]" });
  });

  it("masks refresh tokens, passwords, service-role keys, anon keys, api keys", () => {
    expect(
      redact({
        refresh_token: "x",
        password: "y",
        service_role_key: "z",
        anon_key: "a",
        api_key: "b",
      }),
    ).toEqual({
      refresh_token: "[redacted]",
      password: "[redacted]",
      service_role_key: "[redacted]",
      anon_key: "[redacted]",
      api_key: "[redacted]",
    });
  });

  it("masks long digit sequences (>=8 digits) regardless of key", () => {
    expect(redact({ acct: "1234567890123456" })).toEqual({ acct: "[redacted]" });
    expect(redact({ other: "12345678" })).toEqual({ other: "[redacted]" });
  });

  it("preserves short digit sequences (<8 digits)", () => {
    expect(redact({ pin: "1234567" })).toEqual({ pin: "1234567" });
  });

  it("masks amounts at/above the threshold", () => {
    expect(redact({ amount: 250_00 }, { amountThresholdCents: 100_00 })).toEqual({
      amount: "[redacted]",
    });
    expect(redact({ amount: 100_00 }, { amountThresholdCents: 100_00 })).toEqual({
      amount: "[redacted]",
    });
  });

  it("preserves amounts below the threshold", () => {
    expect(redact({ amount: 99_99 }, { amountThresholdCents: 100_00 })).toEqual({
      amount: 99_99,
    });
  });

  it("preserves amount when no threshold given", () => {
    expect(redact({ amount: 1_000_000_00 })).toEqual({ amount: 1_000_000_00 });
  });

  it("walks nested objects", () => {
    expect(
      redact({ user: { access_token: "x", email: "a@b.c" } }),
    ).toEqual({ user: { access_token: "[redacted]", email: "a@b.c" } });
  });

  it("walks arrays of objects", () => {
    expect(
      redact([{ access_token: "x" }, { other: "ok" }]),
    ).toEqual([{ access_token: "[redacted]" }, { other: "ok" }]);
  });

  it("passes through primitives unchanged", () => {
    expect(redact(null)).toBe(null);
    expect(redact(42)).toBe(42);
    expect(redact("plain string")).toBe("plain string");
    expect(redact(true)).toBe(true);
  });

  it("does not mutate the input object", () => {
    const input = { access_token: "x", nested: { password: "y" } };
    const copy = JSON.parse(JSON.stringify(input));
    redact(input);
    expect(input).toEqual(copy);
  });
});
