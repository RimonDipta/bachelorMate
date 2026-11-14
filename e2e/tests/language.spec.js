const { test, expect } = require("@playwright/test");
const { apiRegister, authed, login, expectAccessible } = require("./helpers");

/** The page must not scroll sideways (Bangla strings run longer than English). */
async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}

test("switching to Bangla translates the app, shows Bangla digits and is saved to the account", async ({ page, request }) => {
  const u = await apiRegister(request, "Bhasha Test");
  const home = (await (await request.post("/api/homes", { ...authed(u.token), data: { name: "Bhasha Home" } })).json()).home;
  await login(page, u.email);

  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { name: "অ্যাকাউন্ট সেটিংস" })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.goto(`/h/${home._id}`);
  await expect(page.getByRole("heading", { name: /^শুভ (সকাল|দুপুর|সন্ধ্যা|রাত্রি), Bhasha$/ })).toBeVisible();
  await expect(page.getByText(/৪টির মধ্যে [০-৪]টি শেষ/)).toBeVisible();
  await expect(page.getByText("মিল রেট", { exact: false }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);

  for (const path of ["meals", "meals/daily", "finance", "finance/me", "finance/expenses", "finance/recurring", "finance/transactions"]) {
    await page.goto(`/h/${home._id}/${path}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoSidewaysScroll(page);
  }

  const me = await (await request.get("/api/auth/me", authed(u.token))).json();
  expect(me.user.appearance.language).toBe("bn");

  // Back to English from the landing-style switch on the sign-in page.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: "Switch language to বাংলা" }).click();
  await expect(page.getByRole("heading", { name: "আবার স্বাগতম" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the landing page has a language switch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch language to বাংলা" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("link", { name: "BachelorMate হোম" }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});
