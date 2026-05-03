import { expect, test } from "@playwright/test";

test("unauthenticated home redirects to /login", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login(\?from=)?/);
  await expect(page.getByText(/sign in to boink/i)).toBeVisible();
});

test("login page renders enroll link", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /enroll a passkey/i })).toBeVisible();
});
