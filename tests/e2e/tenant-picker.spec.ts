import { test, expect } from "@playwright/test";

test("single-membership user is redirected straight to /", async ({ page }) => {
  // Test runs against seeded primary tenant only (one membership).
  // Assumes auth helpers from existing tests/e2e/ are reused; if not present,
  // mock auth state via Playwright storageState fixture.
  await page.goto("/tenants");
  await expect(page).toHaveURL(/\/(\?tenant=.*)?$/);
});
