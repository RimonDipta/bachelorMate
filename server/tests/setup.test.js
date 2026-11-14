// First-run "Get your home set up" checklist on the dashboard.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, registerUser } = require("./helpers");
const { todayIn } = require("../lib/dates");

describe("setup checklist", () => {
  let A, B, home;
  before(async () => {
    await startDb();
    [A, B] = await Promise.all([registerUser("Admin Setup"), registerUser("Member Setup")]);
    home = (await A.api.post("/api/homes").send({ name: "Fresh Home", settings: { requireApproval: false } })).body.home;
  });
  after(stopDb);

  const setup = async (u = A) => (await u.api.get(`/api/homes/${home._id}/dashboard`)).body.setup;

  it("starts empty and ticks steps off from real data", async () => {
    assert.deepEqual(await setup(), { invited: false, recurring: false, meals: false, expenses: false });

    const code = (await A.api.get(`/api/homes/${home._id}`)).body.home.code;
    await B.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    await A.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Bazar", category: "groceries", amount: "500", day: todayIn("Asia/Dhaka") }).expect(201);

    const s = await setup();
    assert.equal(s.invited, true);
    assert.equal(s.expenses, true);
    assert.equal(s.recurring, false);
  });

  it("is only shown to people who run the home", async () => {
    assert.equal(await setup(B), undefined);
  });

  it("can be dismissed for good", async () => {
    assert.equal((await B.api.post(`/api/homes/${home._id}/setup/dismiss`)).status, 403);
    await A.api.post(`/api/homes/${home._id}/setup/dismiss`).expect(200);
    assert.equal(await setup(), undefined);
  });
});
