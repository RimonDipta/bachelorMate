const { test, expect } = require("@playwright/test");
const { apiRegister, authed, login, expectAccessible } = require("./helpers");

test("a new home has this month's meal period and today's meals already filled in", async ({ page, request }) => {
  const u = await apiRegister(request, "Auto Meals");
  const home = (await (await request.post("/api/homes", { ...authed(u.token), data: { name: "Auto Home" } })).json()).home;
  await login(page, u.email);

  await page.goto(`/h/${home._id}`);
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  await expect(page.getByRole("heading", { name: `Meal account · ${month}` })).toBeVisible();

  await page.goto(`/h/${home._id}/meals/daily`);
  await expect(page.getByText("Today's meals were filled in from everyone's usual meals")).toBeVisible();
  await expect(page.getByText("Not filled")).toHaveCount(0);
  await expectAccessible(page);
});

test("amounts typed with Bangla digits are accepted", async ({ page, request }) => {
  const u = await apiRegister(request, "Bangla Digits");
  const home = (await (await request.post("/api/homes", { ...authed(u.token), data: { name: "Digit Home" } })).json()).home;
  await login(page, u.email);

  await page.goto(`/h/${home._id}/finance/me?pay=1`);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (BDT)").fill("১,২০০.৫০");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();

  const me = await (await request.get(`/api/homes/${home._id}/finance/accounts/${home.myMembership._id}`, authed(u.token))).json();
  expect(me.statement.balance).toBe(120050);
});

test("testers can send feedback from the account menu", async ({ page, request }) => {
  const u = await apiRegister(request, "Feedback Person");
  await login(page, u.email);
  await page.goto("/homes");

  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByText("Send feedback").click();
  const dialog = page.getByRole("dialog", { name: "Send feedback" });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Idea" }).click();
  await dialog.getByLabel("What would make it better?").fill("A weekly meal summary on WhatsApp would help.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks — we read every message.")).toBeVisible();
});
