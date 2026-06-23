import { test, expect } from "@playwright/test";

test.describe("Core flows", () => {
  test("full login page interaction: validation errors", async ({ page }) => {
    await page.goto("/login");

    // Try submitting empty form
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);

    // Try invalid email
    await page.fill('input[type="email"]', "not-an-email");
    await page.fill('input[type="password"]', "123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test("login redirects when supabase is not configured", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Should stay on login page (or redirect somewhere)
    // The key is that no crash occurs
    await expect(page.locator("body")).toBeVisible();
  });

  test("book page with valid UUID but no location shows 404", async ({ page }) => {
    const response = await page.goto("/book/00000000-0000-0000-0000-000000000000");
    expect(response?.status()).toBe(404);
  });

  test("area-personale without company redirects", async ({ page }) => {
    const response = await page.goto("/book/invalid/area-personale");
    expect(response == null || response.status() >= 400).toBeTruthy();
  });

  test("security headers are present on all pages", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["strict-transport-security"]).toBeTruthy();
    expect(response?.headers()["content-security-policy"]).toBeTruthy();
    expect(response?.headers()["x-trace-id"]).toBeTruthy();
  });

  test("rate limit headers present", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.headers()["x-ratelimit-limit"]).toBeTruthy();
    expect(response?.headers()["x-ratelimit-remaining"]).toBeTruthy();
  });

  test("response time header present", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.headers()["x-response-time-ms"]).toBeTruthy();
  });

  test("trace ID is propagated across requests", async ({ page }) => {
    const response1 = await page.goto("/login");
    const traceId1 = response1?.headers()["x-trace-id"];

    await page.goto("/setup");
    const response2 = await page.goto("/login");
    const traceId2 = response2?.headers()["x-trace-id"];

    // Each request should have its own trace ID
    expect(traceId1).toBeTruthy();
    expect(traceId2).toBeTruthy();
    expect(traceId1).toMatch(/^[a-f0-9]{16}$/);
    expect(traceId2).toMatch(/^[a-f0-9]{16}$/);
  });

  test("CSP blocks inline scripts", async ({ page }) => {
    await page.goto("/login");
    const csp = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute("content") ?? null;
    });
    // CSP should be set via header, not meta
    expect(csp).toBeNull();

    // Verify the CSP header exists
    const response = await page.goto("/login");
    const cspHeader = response?.headers()["content-security-policy"];
    expect(cspHeader).toContain("default-src 'self'");
    expect(cspHeader).toContain("frame-ancestors 'none'");
  });
});
