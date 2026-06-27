import { test, expect } from "@playwright/test";

test.describe("AcademyOS smoke tests", () => {
  test("login page renders accessible sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "AcademyOS Sign In" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in to AcademyOS/i })).toBeVisible();
  });

  test("legacy admin route redirects to login when unauthenticated", async ({ page }) => {
    const response = await page.goto("/admin/scholarships");
    expect(response?.url()).toContain("/login");
  });

  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AcademyOS|EduOS/i);
  });
});
