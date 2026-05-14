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
