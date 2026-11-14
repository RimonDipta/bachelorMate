// Shared helpers: create accounts and homes through the API (fast), then
// drive the real UI for the flows under test.
const { expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

let n = 0;
const uniqueEmail = (name) => `${name.toLowerCase().replace(/\W/g, "")}.${Date.now()}.${++n}@example.test`;
const PASSWORD = "E2e-pass-1234";

/** Registers through the API and returns { email, token }. */
async function apiRegister(request, name) {
  const email = uniqueEmail(name);
  const res = await request.post("/api/auth/register", { data: { name, email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { name, email, token: body.accessToken, user: body.user };
}

const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Signs in through the real login form. */
async function login(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Fails on serious or critical WCAG A/AA problems. */
async function expectAccessible(page, { exclude = [] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  for (const sel of exclude) builder = builder.exclude(sel);
  const { violations } = await builder.analyze();
  const serious = violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((x) => x.target.join(" ")).join(", ")}`);
  expect(summary, "accessibility violations").toEqual([]);
}

module.exports = { apiRegister, authed, login, expectAccessible, uniqueEmail, PASSWORD };
