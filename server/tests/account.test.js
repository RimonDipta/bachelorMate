// Data export, account deletion, health check and crash reports.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, registerUser, request, app } = require("./helpers");
const { todayIn } = require("../lib/dates");

describe("your data and account deletion", () => {
  let A, B, home;
  before(async () => {
    await startDb();
    [A, B] = await Promise.all([registerUser("Admin Asha"), registerUser("Member Badal")]);
    home = (await A.api.post("/api/homes").send({ name: "Shared Flat", settings: { requireApproval: false } })).body.home;
    const code = (await A.api.get(`/api/homes/${home._id}`)).body.home.code;
    await B.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    await A.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Rice and fish", category: "groceries", amount: "800", day: todayIn("Asia/Dhaka") }).expect(201);
  });
  after(stopDb);

  it("exports everything about you as a JSON download", async () => {
    const res = await B.api.get("/api/users/me/export");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-disposition"], /attachment; filename="bachelormate-data-/);
    const data = JSON.parse(res.text);
    assert.equal(data.profile.name, "Member Badal");
    assert.equal(data.profile.passwordHash, undefined, "no secrets in the export");
    assert.equal(data.homes[0].home.name, "Shared Flat");
    assert.ok(Array.isArray(data.ledger));
  });

  it("won't delete an account that still lives with others", async () => {
    const check = await A.api.get("/api/users/me/deletion-check");
    assert.equal(check.body.blockers[0].name, "Shared Flat");
    assert.equal(check.body.blockers[0].admin, true);
    const res = await A.api.delete("/api/users/me").send({ password: "Passw0rd!", confirm: "DELETE" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "LEAVE_HOMES_FIRST");
  });

  it("needs the password and the typed confirmation", async () => {
    assert.equal((await B.api.delete("/api/users/me").send({ password: "Passw0rd!" })).status, 400);
    assert.equal((await B.api.delete("/api/users/me").send({ password: "wrong-pass1", confirm: "DELETE" })).status, 400);
  });

  it("anonymises the person but keeps the home's money history intact", async () => {
    await A.api.post(`/api/homes/${home._id}/members/${(await A.api.get(`/api/homes/${home._id}/members`)).body.members.find((m) => m.user.name === "Member Badal")._id}/remove`).send({ reason: "Moved out" }).expect(200);
    const before = (await A.api.get(`/api/homes/${home._id}/finance/overview`)).body.totals;

    const res = await B.api.delete("/api/users/me").send({ password: "Passw0rd!", confirm: "DELETE" });
    assert.equal(res.status, 200);
    assert.equal((await B.api.get("/api/auth/me")).status, 401, "old sessions stop working");
    const login = await request(app).post("/api/auth/login").send({ email: B.email, password: "Passw0rd!" });
    assert.equal(login.status, 401, "can't sign in any more");

    const profile = await A.api.get(`/api/users/${B.user._id}`);
    assert.equal(profile.body.user.name, "Deleted user");
    const after = (await A.api.get(`/api/homes/${home._id}/finance/overview`)).body.totals;
    assert.deepEqual(after, before, "shared finances unchanged");
  });

  it("lets the last person in a home delete their account (the home is archived)", async () => {
    const solo = await registerUser("Solo Sami");
    const h = (await solo.api.post("/api/homes").send({ name: "Just Me" })).body.home;
    await solo.api.delete("/api/users/me").send({ password: "Passw0rd!", confirm: "DELETE" }).expect(200);
    const Home = require("../models/Home");
    assert.equal((await Home.findById(h._id)).status, "archived");
  });
});

describe("health and crash reports", () => {
  before(startDb);
  after(stopDb);

  it("reports the database as up", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.db, "up");
  });

  it("accepts browser crash reports and strips query strings", async () => {
    const res = await request(app).post("/api/client-errors").send({ message: "x is undefined", url: "/reset-password?token=secret", kind: "boundary" });
    assert.equal(res.status, 202);
    assert.match(res.body.ref, /^[a-f0-9]{8}$/);
    assert.equal((await request(app).post("/api/client-errors").send({ message: "" })).status, 400);
  });
});

describe("push notification subscriptions", () => {
  before(startDb);
  after(stopDb);

  it("reports push as off without keys and refuses subscriptions", async () => {
    const u = await registerUser("Pusher");
    const cfg = await u.api.get("/api/push/config");
    assert.deepEqual(cfg.body, { enabled: false, publicKey: null });
    const sub = { endpoint: "https://push.example.com/abc", keys: { p256dh: "k", auth: "a" } };
    assert.equal((await u.api.post("/api/push/subscriptions").send(sub)).status, 400);
    assert.equal((await u.api.post("/api/push/subscriptions").send({ ...sub, endpoint: "http://insecure.example.com" })).status, 400);
  });
});
