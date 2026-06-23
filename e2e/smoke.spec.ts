import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("home page redirects to setup when Supabase is not configured", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup/);
  });

  test("setup page loads correctly", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.locator("h1, h2")).toBeVisible();
  });

  test("login page loads with form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login page navigates to setup if no config", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test("book page shows 404 for random company", async ({ page }) => {
    const response = await page.goto("/book/00000000-0000-0000-0000-000000000000");
    expect(response?.status()).toBe(404);
  });

  test("app has correct title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/BarberHub Pro/);
  });
});
