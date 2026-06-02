import { test, expect } from "@playwright/test";

test.describe("Diagrams -- Smoke Tests", () => {
  test("homepage returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("page title matches /Diagram/i", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Diagram/i);
  });

  test("h1 heading 'Diagrams' is visible", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await expect(heading).toHaveText("Diagrams");
  });

  test("'Continue with Google' button is visible", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: /continue with google/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test("login subtitle text is visible", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Sign in to view your saved diagrams")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("no severe console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter known benign browser/third-party noise
        const benign =
          text.includes("favicon") ||
          text.includes("ERR_ABORTED") ||
          text.includes("supabase") ||
          text.includes("Failed to load resource") ||
          text.includes("net::ERR");
        if (!benign) errors.push(text);
      }
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});
