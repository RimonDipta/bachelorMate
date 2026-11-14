// Beta-readiness: the meal book runs itself (monthly period, today's default
// meals) and testers can send feedback from inside the app.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, registerUser } = require("./helpers");
const { todayIn, addDays, monthRange } = require("../lib/dates");
const Home = require("../models/Home");
const Feedback = require("../models/Feedback");
const { MealEntry, MealPeriod } = require("../models/Meal");
const { ensureCurrentPeriod, fillTodaysMeals, monthName } = require("../services/mealAutomation");

describe("meal automation", () => {
  let A, B, home, today;
  before(async () => {
    await startDb();
    [A, B] = await Promise.all([registerUser("Auto Admin"), registerUser("Auto Member")]);
    home = (await A.api.post("/api/homes").send({ name: "Auto Mess", settings: { requireApproval: false } })).body.home;
    const code = (await A.api.get(`/api/homes/${home._id}/invitations`)).body.code;
    await B.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    today = todayIn(home.timezone);
  });
  after(stopDb);

  it("opens this month's meal period the first time the home is opened", async () => {
    const dash = (await A.api.get(`/api/homes/${home._id}/dashboard`)).body;
    const { from, to } = monthRange(today.slice(0, 7));
    const periods = await MealPeriod.find({ home: home._id });
    assert.equal(periods.length, 1);
    assert.equal(periods[0].name, monthName(today.slice(0, 7)));
    assert.equal(periods[0].startDay, from);
    assert.equal(periods[0].endDay, to);
    assert.equal(dash.mealPeriod.name, periods[0].name);
  });

  it("fills today's meals from each member's defaults", async () => {
    const entries = await MealEntry.find({ home: home._id, day: today });
    assert.equal(entries.length, 2);
    for (const e of entries) assert.deepEqual(Object.fromEntries(e.counts), { breakfast: 1, lunch: 1, dinner: 1 });
    // Filled automatically, so the setup checklist still asks someone to look at today's meals.
    assert.equal((await A.api.get(`/api/homes/${home._id}/dashboard`)).body.setup.meals, false);
  });

  it("never overwrites a meal someone already set", async () => {
    const members = (await A.api.get(`/api/homes/${home._id}/members`).query({ status: "active" })).body.members;
    const b = members.find((m) => m.user.name === "Auto Member");
    await A.api.put(`/api/homes/${home._id}/meals/entries`).send({ entries: [{ membershipId: b._id, day: today, counts: { breakfast: 0, lunch: 0, dinner: 0 } }] }).expect(200);
    await MealEntry.deleteOne({ home: home._id, day: today, membership: { $ne: b._id } });
    const created = await fillTodaysMeals(await Home.findById(home._id));
    assert.equal(created, 1); // only the missing entry
    const mine = await MealEntry.findOne({ home: home._id, day: today, membership: b._id });
    assert.deepEqual(Object.fromEntries(mine.counts), { breakfast: 0, lunch: 0, dinner: 0 });
  });

  it("fits a new period around periods made by hand and never overlaps", async () => {
    const h = await Home.findById(home._id);
    assert.equal(await ensureCurrentPeriod(h), null); // today is already covered
    await MealPeriod.deleteMany({ home: home._id });
    const yesterday = addDays(today, -1);
    await MealPeriod.create({ home: home._id, name: "Custom", startDay: addDays(yesterday, -5), endDay: yesterday });
    const created = await ensureCurrentPeriod(h);
    assert.equal(created.startDay, today);
    assert.equal(created.endDay, monthRange(today.slice(0, 7)).to);
  });

  it("does nothing when the home turns it off", async () => {
    await A.api.patch(`/api/homes/${home._id}/settings`).send({ autoMealPeriods: false, autoFillMeals: false }).expect(200);
    const h = await Home.findById(home._id);
    await MealPeriod.deleteMany({ home: home._id });
    await MealEntry.deleteMany({ home: home._id });
    assert.equal(await ensureCurrentPeriod(h), null);
    assert.equal(await fillTodaysMeals(h), 0);
    assert.equal(await MealEntry.countDocuments({ home: home._id }), 0);
  });

  it("does not fill days in a closed period", async () => {
    await A.api.patch(`/api/homes/${home._id}/settings`).send({ autoFillMeals: true }).expect(200);
    await MealPeriod.create({ home: home._id, name: "Closed", startDay: today, endDay: today, status: "closed" });
    assert.equal(await fillTodaysMeals(await Home.findById(home._id)), 0);
  });
});

describe("feedback", () => {
  let U;
  before(async () => {
    await startDb();
    U = await registerUser("Beta Tester");
  });
  after(stopDb);

  it("saves feedback with the page it came from, without query strings", async () => {
    await U.api.post("/api/feedback").send({ kind: "problem", message: "The meal list is confusing", page: "/h/x/meals/daily?token=secret", language: "bn" }).expect(201);
    const saved = await Feedback.findOne({});
    assert.equal(saved.kind, "problem");
    assert.equal(saved.page, "/h/x/meals/daily");
    assert.equal(saved.language, "bn");
  });

  it("rejects empty feedback and requires sign-in", async () => {
    assert.equal((await U.api.post("/api/feedback").send({ message: " " })).status, 400);
    const { request, app } = require("./helpers");
    assert.equal((await request(app).post("/api/feedback").send({ message: "hello there" })).status, 401);
  });

  it("is part of the data export", async () => {
    const data = (await U.api.get("/api/users/me/export")).body;
    assert.equal(data.feedback.length, 1);
    assert.equal(data.feedback[0].message, "The meal list is confusing");
  });
});
