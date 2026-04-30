import { describe, expect, it } from "vitest";
import { loadEnv } from "@/env";

const VALID = {
  DATABASE_URL: "postgres://u:p@localhost:5432/finance",
  RP_ID: "localhost",
  RP_NAME: "boink!",
  ORIGIN: "http://localhost:3000",
  SESSION_COOKIE_NAME: "__Host-session",
  NODE_ENV: "test",
};

describe("loadEnv", () => {
  it("accepts valid env", () => {
    const env = loadEnv(VALID);
    expect(env.RP_ID).toBe("localhost");
    expect(env.RP_NAME).toBe("boink!");
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _omitted, ...without } = VALID;
    expect(() => loadEnv(without)).toThrow(/DATABASE_URL/);
  });

  it("rejects non-URL ORIGIN", () => {
    expect(() => loadEnv({ ...VALID, ORIGIN: "not-a-url" })).toThrow(/ORIGIN/);
  });
});
