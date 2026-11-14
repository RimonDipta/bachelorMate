const { test, expect } = require("@playwright/test");
const { apiRegister, authed, login, expectAccessible } = require("./helpers");

/** The page must not scroll sideways (Bangla strings run longer than English). */
async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
  // Text clipped by an overflow:hidden parent doesn't scroll the page, so also check that no
  // visible heading, paragraph or control runs past the right edge of the screen.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3, p, button, a, label")]
      // Tab strips and tables scroll sideways on purpose.
      .filter((el) => !el.closest("[aria-hidden='true'], .sr-only, .table-wrap, .modal, .tabs, .segmented") && el.offsetParent !== null)
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}: ${el.textContent.trim().slice(0, 40)}`)
  );
  expect(clipped, "text running off screen").toEqual([]);
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

  // Every screen: the page heading is in Bangla and nothing scrolls sideways.
  const homePages = [
    "meals", "meals/daily", "meals/history", "requests", "chat", "calendar", "finance", "finance/me", "finance/expenses", "finance/recurring",
    "finance/transactions", "announcements", "grocery", "members", "invites", "settings", "listings", "reviews", "reports", "activity",
  ].map((p) => `/h/${home._id}/${p}`);
  const personal = ["/homes", "/friends", "/messages", "/notifications", "/invitations", "/reviews", `/people/${u.user._id}`, "/settings/profile", "/settings/security", "/settings/notifications", "/settings/data", "/join", "/seats", "/privacy", "/terms"];
  for (const path of [...homePages, ...personal]) {
    await page.goto(path);
    // A profile's h1 is the person's name, so check its first section heading.
    const heading = page.locator(path.startsWith("/people/") ? "main h2" : "main h1, main h2").first();
    await expect(heading, path).toBeVisible();
    await expect(heading, path).toHaveText(/[ঀ-৿]/);
    await expectNoSidewaysScroll(page);
  }
  await page.goto(`/h/${home._id}/meals/daily`);
  await expectAccessible(page);

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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("আপনার বাসা");
  await expect(page.locator("#features")).toContainText("শেয়ার করা বাসার");
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});
