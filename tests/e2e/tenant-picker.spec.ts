import { test, expect } from "@playwright/test";

test("unauthenticated /tenants redirects to /login", async ({ page }) => {
  await page.goto("/tenants");
  await expect(page).toHaveURL(/\/login/);
});
