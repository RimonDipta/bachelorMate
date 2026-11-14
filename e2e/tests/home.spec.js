const { test, expect } = require("@playwright/test");
const { apiRegister, authed, login, expectAccessible } = require("./helpers");

test("an invite link joins straight away, even when approval is on", async ({ page, request }) => {
  const admin = await apiRegister(request, "Admin Asha");
  const home = (await (await request.post("/api/homes", { ...authed(admin.token), data: { name: "Invite Test Home", settings: { requireApproval: true } } })).json()).home;
  const link = await (await request.post(`/api/homes/${home._id}/invitations`, { ...authed(admin.token), data: { kind: "link" } })).json();

  const guest = await apiRegister(request, "Guest Badal");
  await login(page, guest.email);
  await page.goto(`/join/${link.token}`);
  await expect(page.getByText("Invite Test Home").first()).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join home" }).click();
  await page.waitForURL(new RegExp(`/h/${home._id}`));
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening|night), Guest/ })).toBeVisible();
});

test("daily meals can be filled in and saved", async ({ page, request }) => {
  const admin = await apiRegister(request, "Meal Manager");
  const home = (await (await request.post("/api/homes", { ...authed(admin.token), data: { name: "Meal Home" } })).json()).home;
  await login(page, admin.email);
  await page.goto(`/h/${home._id}/meals/daily`);

  await page.getByRole("button", { name: "Increase Meal Manager Lunch" }).filter({ visible: true }).click();
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await page.getByRole("button", { name: "Save meals" }).click();
  await expect(page.getByText("Meals saved")).toBeVisible();
  await expectAccessible(page);

  // The overview checklist picks it up.
  await page.goto(`/h/${home._id}`);
  await expect(page.getByText("1 of 4 done")).toBeVisible();
});

test("account settings: export works and deletion is guarded", async ({ page, request }) => {
  const u = await apiRegister(request, "Export Person");
  await login(page, u.email);
  await page.goto("/settings/data");
  await expectAccessible(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toMatch(/^bachelormate-data-.*\.json$/);

  await page.getByRole("button", { name: "Delete account" }).click();
  const confirm = page.getByRole("button", { name: "Delete my account" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Your password").fill("E2e-pass-1234");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL((url) => url.pathname === "/");
  expect((await request.post("/api/auth/login", { data: { email: u.email, password: "E2e-pass-1234" } })).status()).toBe(401);
});
