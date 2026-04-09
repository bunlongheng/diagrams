import { test, expect } from "@playwright/test";

test.describe("Diagrams — Smoke Tests", () => {
  test("homepage loads with 200 status", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test("page title contains Diagrams", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Diagram/i);
  });

  test("sign-in form is visible for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    // The login form has email input, password input, and Sign In button
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign In");
  });

  test("app heading and branding are present", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await expect(heading).toHaveText("Diagrams");
  });
});
