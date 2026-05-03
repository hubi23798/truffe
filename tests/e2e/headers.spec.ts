import { expect, test } from "@playwright/test";

const REQUIRED_HEADERS = [
  ["strict-transport-security", /max-age=63072000.*includeSubDomains.*preload/i],
  ["x-content-type-options", /nosniff/i],
  ["referrer-policy", /strict-origin-when-cross-origin/i],
  ["x-frame-options", /DENY/i],
  ["permissions-policy", /camera=\(\)/i],
  ["content-security-policy", /default-src 'self'/i],
] as const;

test("security headers present on /api/health", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  for (const [name, pattern] of REQUIRED_HEADERS) {
    const value = res.headers()[name];
    expect(value, `expected header ${name}`).toBeDefined();
    expect(value).toMatch(pattern);
  }
});
