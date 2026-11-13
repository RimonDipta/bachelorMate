const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, app, request, as } = require("./helpers");
const { seedDemo, DOMAIN } = require("../scripts/seed-demo");
const User = require("../models/User");

describe("demo seed", () => {
  before(startDb);
  after(stopDb);

  it("creates usable demo accounts with consistent books, and is re-runnable", async () => {
    const outsider = await User.create({ name: "Real User", email: "real@example.com" });
    await seedDemo({ password: "Demo@1234" });
    const { home } = await seedDemo({ password: "Demo@1234" }); // second run replaces the first
    assert.ok(await User.exists({ _id: outsider._id }), "non-demo users untouched");
    assert.equal(await User.countDocuments({ email: { $regex: DOMAIN } }), 5);

    const login = await request(app).post("/api/auth/login").send({ email: `admin@${DOMAIN}`, password: "Demo@1234" });
    assert.equal(login.status, 200);
    const api = as(login.body.accessToken);
    const homes = await api.get("/api/homes");
    assert.equal(homes.body.homes.length, 1);

    const dash = await api.get(`/api/homes/${home._id}/dashboard`);
    assert.equal(dash.status, 200);
    assert.equal(dash.body.memberCount, 5);
    assert.ok(dash.body.mealPeriod.rate > 0);

    const fin = await api.get(`/api/homes/${home._id}/finance/overview`);
    const sum = fin.body.accounts.reduce((a, x) => a + x.balance, 0);
    const credits = fin.body.accounts.reduce((a, x) => a + x.credits, 0);
    const debits = fin.body.accounts.reduce((a, x) => a + x.debits, 0);
    assert.equal(sum, credits - debits);

    // The period can be closed and every charge adds up to the meal pool.
    const periods = await api.get(`/api/homes/${home._id}/meals/periods`);
    const closed = await api.post(`/api/homes/${home._id}/meals/periods/${periods.body.periods[0]._id}/close`);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.summary.members.reduce((a, x) => a + x.charge, 0), closed.body.summary.totalExpense);

    const member = await request(app).post("/api/auth/login").send({ email: `member@${DOMAIN}`, password: "Demo@1234" });
    const reqs = await as(member.body.accessToken).get(`/api/homes/${home._id}/requests`);
    assert.ok(reqs.body.requests.length >= 1);
  });
});
