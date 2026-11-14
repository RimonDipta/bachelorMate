const { test, expect } = require("@playwright/test");
const { expectAccessible, uniqueEmail, PASSWORD } = require("./helpers");

test("homepage loads and is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "BachelorMate home" }).first()).toBeVisible();
  await expectAccessible(page);
});

test("seat search is public", async ({ page }) => {
  await page.goto("/seats");
  await expect(page).toHaveURL(/\/seats/);
  await expectAccessible(page);
});

test("sign up, create a home and see the setup checklist", async ({ page }) => {
  await page.goto("/register");
  await expectAccessible(page);
  await page.getByLabel("Full name").fill("Rahim Test");
  await page.getByLabel("Email").fill(uniqueEmail("rahim"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL(/\/(homes|onboarding)/);
  if (!page.url().includes("/onboarding")) await page.goto("/onboarding");
  await page.getByRole("button", { name: /Create a new home/ }).click();
  await page.getByLabel("Home name").fill("Playwright Mess");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Create home" }).click();

  // Skip inviting, then finish the wizard and land on the overview.
  await page.getByRole("button", { name: "Skip, I'll invite later" }).click();
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Get your home set up" })).toBeVisible();
  await expect(page.getByText("0 of 4 done")).toBeVisible();
  await expectAccessible(page);
});

test("app manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const m = await manifest.json();
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i) => i.purpose === "maskable")).toBeTruthy();
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toBe("no-cache");
});
