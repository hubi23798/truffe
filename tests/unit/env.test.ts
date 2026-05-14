import { describe, expect, it } from "vitest";
import { loadEnv } from "@/env";

const VALID = {
  DATABASE_URL: "postgresql://postgres:secret@db.fake.supabase.co:5432/postgres",
  RP_ID: "localhost",
  RP_NAME: "piggy.ai",
  ORIGIN: "http://localhost:3000",
  SESSION_COOKIE_NAME: "__Host-session",
  NODE_ENV: "test",
  ADMIN_EMAIL: "admin@piggy.ai",
  // Real-shape bcrypt hash (60 chars, $2b prefix). Not a real password.
  ADMIN_PASSWORD: "$2b$12$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghijklmn",
};

describe("loadEnv", () => {
  it("accepts valid env", () => {
    const env = loadEnv(VALID);
    expect(env.RP_ID).toBe("localhost");
    expect(env.RP_NAME).toBe("piggy.ai");
    expect(env.ADMIN_EMAIL).toBe("admin@piggy.ai");
  });

  it("accepts both postgres:// and postgresql:// schemes", () => {
    expect(() =>
      loadEnv({ ...VALID, DATABASE_URL: "postgres://localhost:5432/boink" }),
    ).not.toThrow();
    expect(() =>
      loadEnv({ ...VALID, DATABASE_URL: "postgresql://localhost:5432/boink" }),
    ).not.toThrow();
  });

  it("rejects DATABASE_URL with a non-postgres scheme", () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: "mysql://localhost/boink" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _omitted, ...without } = VALID;
    expect(() => loadEnv(without)).toThrow(/DATABASE_URL/);
  });

  it("rejects ADMIN_PASSWORD shorter than 60 chars (bcrypt hash length)", () => {
    expect(() => loadEnv({ ...VALID, ADMIN_PASSWORD: "too-short" })).toThrow(/ADMIN_PASSWORD/);
  });

  it("defaults ADMIN_EMAIL to admin@piggy.ai when omitted", () => {
    const { ADMIN_EMAIL: _omitted, ...without } = VALID;
    const env = loadEnv(without);
    expect(env.ADMIN_EMAIL).toBe("admin@piggy.ai");
  });
});
