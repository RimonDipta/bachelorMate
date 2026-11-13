// Recurring costs and the "amount to pay" maths.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, registerUser } = require("./helpers");
const { todayIn } = require("../lib/dates");
const { occurrences } = require("../services/recurring");

describe("recurring costs", () => {
  let A, X, Y, Z, home, m = {};
  const monthStart = `${todayIn("Asia/Dhaka").slice(0, 7)}-01`;
  const rent = (overrides = {}) => ({ title: "House rent", category: "rent", amount: "20", frequency: "monthly", dayOfMonth: 1, startDay: monthStart, allocation: { mode: "equal", allMembers: true }, ...overrides });

  before(async () => {
    await startDb();
    [A, X, Y, Z] = await Promise.all(["Admin Ann", "Member Xavi", "Member Yara", "Member Zed"].map((n) => registerUser(n)));
    home = (await A.api.post("/api/homes").send({ name: "Rent Test Home", settings: { requireApproval: false } })).body.home;
    const code = (await A.api.get(`/api/homes/${home._id}`)).body.home.code;
    for (const u of [X, Y, Z]) await u.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    const list = (await A.api.get(`/api/homes/${home._id}/members`)).body.members;
    for (const x of list) m[x.user.name.split(" ")[1]] = x._id;
    // Meal balances from the example: Xavi owes 5, Yara has 5 in advance.
    await A.api.post(`/api/homes/${home._id}/finance/adjustments`).send({ membershipId: m.Xavi, direction: "debit", amount: "5", description: "Meal dues" }).expect(201);
    await A.api.post(`/api/homes/${home._id}/finance/adjustments`).send({ membershipId: m.Yara, direction: "credit", amount: "5", description: "Meal advance" }).expect(201);
  });
  after(stopDb);

  const accounts = async () => {
    const o = await A.api.get(`/api/homes/${home._id}/finance/overview`);
    return Object.fromEntries(o.body.accounts.map((a) => [a.user.name.split(" ")[1], a]));
  };

  it("splits rent 20 equally between 4 people and computes what each must pay", async () => {
    const r = await A.api.post(`/api/homes/${home._id}/recurring`).send(rent());
    assert.equal(r.status, 201);
    assert.equal(r.body.posted, 1, "this month's rent posts immediately");
    const acc = await accounts();
    assert.equal(acc.Ann.payable, 500); // 5.00
    assert.equal(acc.Xavi.payable, 1000); // 5 rent + 5 meal dues = 10
    assert.equal(acc.Yara.payable, 0); // 5 rent − 5 advance = 0
    assert.equal(acc.Zed.payable, 500);
    const stmt = await X.api.get(`/api/homes/${home._id}/finance/accounts/${m.Xavi}`);
    assert.equal(stmt.body.statement.payable, 1000);
    assert.equal(stmt.body.statement.thisMonth.expense_share, -500);
  });

  it("never posts the same occurrence twice", async () => {
    const again = await A.api.post(`/api/homes/${home._id}/recurring/sync`);
    assert.equal(again.body.posted, 0);
    const exp = await A.api.get(`/api/homes/${home._id}/expenses?category=rent`);
    assert.equal(exp.body.expenses.filter((e) => e.title.startsWith("House rent")).length, 1);
  });

  it("supports custom amounts per member, including members who pay nothing", async () => {
    const bad = await A.api.post(`/api/homes/${home._id}/recurring`).send({
      title: "Internet", category: "internet", amount: "20", dayOfMonth: 1, startDay: monthStart,
      allocation: { mode: "custom", shares: [{ membershipId: m.Xavi, amount: "10" }, { membershipId: m.Yara, amount: "9" }] },
    });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /add up to/);
    const ok = await A.api.post(`/api/homes/${home._id}/recurring`).send({
      title: "Internet", category: "internet", amount: "20", dayOfMonth: 1, startDay: monthStart,
      allocation: { mode: "custom", shares: [{ membershipId: m.Ann, amount: "0" }, { membershipId: m.Xavi, amount: "10" }, { membershipId: m.Yara, amount: "5" }, { membershipId: m.Zed, amount: "5" }] },
    });
    assert.equal(ok.status, 201);
    const acc = await accounts();
    assert.equal(acc.Ann.payable, 500, "Ann pays nothing for internet");
    assert.equal(acc.Xavi.payable, 2000);
    assert.equal(acc.Yara.payable, 500);
  });

  it("splits equally between chosen members only, with exact rounding", async () => {
    const r = await A.api.post(`/api/homes/${home._id}/recurring`).send({ title: "Cleaner", category: "cleaning", amount: "10.01", dayOfMonth: 1, startDay: monthStart, allocation: { mode: "equal", allMembers: false, memberships: [m.Xavi, m.Zed] } });
    assert.equal(r.status, 201);
    const list = await A.api.get(`/api/homes/${home._id}/recurring`);
    const cleaner = list.body.templates.find((t) => t.title === "Cleaner");
    assert.deepEqual(cleaner.perMember.map((p) => p.amount).sort(), [500, 501]);
    assert.ok(cleaner.nextDay > monthStart);
  });

  it("only admins/managers can manage recurring costs", async () => {
    assert.equal((await X.api.post(`/api/homes/${home._id}/recurring`).send(rent({ title: "Hack" }))).status, 403);
    assert.equal((await X.api.get(`/api/homes/${home._id}/recurring`)).status, 200, "members can view");
  });

  it("pausing stops posting and resuming does not back-charge", async () => {
    const list = await A.api.get(`/api/homes/${home._id}/recurring`);
    const t = list.body.templates.find((x) => x.title === "House rent");
    await A.api.post(`/api/homes/${home._id}/recurring/${t._id}/active`).send({ active: false }).expect(200);
    const resumed = await A.api.post(`/api/homes/${home._id}/recurring/${t._id}/active`).send({ active: true });
    assert.equal(resumed.body.posted, 0);
    await A.api.delete(`/api/homes/${home._id}/recurring/${t._id}`).expect(200);
    const exp = await A.api.get(`/api/homes/${home._id}/expenses?category=rent`);
    assert.equal(exp.body.expenses.length, 1, "posted expenses survive deleting the template");
  });

  it("works out monthly and weekly occurrences", () => {
    const monthly = occurrences({ frequency: "monthly", dayOfMonth: 5, startDay: "2026-01-10" }, "2026-04-30", "");
    assert.deepEqual(monthly, ["2026-02-05", "2026-03-05", "2026-04-05"]);
    const weekly = occurrences({ frequency: "weekly", weekday: 1, startDay: "2026-11-01" }, "2026-11-20", "");
    assert.deepEqual(weekly, ["2026-11-02", "2026-11-09", "2026-11-16"]);
    assert.deepEqual(occurrences({ frequency: "monthly", dayOfMonth: 1, startDay: "2026-01-01", endDay: "2026-02-15" }, "2026-12-31", ""), ["2026-01-01", "2026-02-01"]);
  });
});
