import { test, expect } from "@playwright/test";

test("single-membership user is redirected straight to /", async ({ page }) => {
  await page.goto("/tenants");
  // Single-membership redirect should land on / (optionally with ?tenant=<id>), not on /tenants
  await expect(page).not.toHaveURL(/\/tenants/);
});
