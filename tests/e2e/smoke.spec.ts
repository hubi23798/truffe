import { expect, test } from "@playwright/test";

test("unauthenticated home redirects to /login", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login(\?from=)?/);
  await expect(page.getByText(/sign in to piggy\.ai/i)).toBeVisible();
});

test("login page renders email + password form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

// NOTE: this test requires a logged-in session. Without auth fixtures it will land on /login.
// Run as part of the full e2e suite with auth storageState configured.
test("primary tenant data renders on /", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("net-worth-hero")).toBeVisible();
  // Tenant picker should NOT appear for single-membership user.
  await expect(page).not.toHaveURL(/\/tenants/);
});
