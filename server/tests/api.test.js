// End-to-end API tests against a real (in-memory, replica-set) MongoDB.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startDb, stopDb, app, request, as, registerUser } = require("./helpers");
const { outbox } = require("../lib/mailer");
const { todayIn, addDays } = require("../lib/dates");

const tokenFromMail = (to, path) => {
  const mail = [...outbox].reverse().find((m) => m.to === to && m.cta?.url.includes(path));
  return new URL(mail.cta.url).searchParams.get("token");
};

describe("BachelorMate API", () => {
  let A, B, C, D, E; // admin, manager, meal manager, member, outsider
  let home, home2, members = {};
  const today = todayIn("Asia/Dhaka");

  before(async () => {
    await startDb();
    [A, B, C, D, E] = await Promise.all(["Alice", "Bob", "Chloe", "Dan", "Eve"].map((n) => registerUser(n)));
  });
  after(stopDb);

  describe("authentication", () => {
    it("rejects wrong passwords with a generic message", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: A.email, password: "wrong-pass1" });
      assert.equal(res.status, 401);
      assert.equal(res.body.message, "Invalid email or password");
    });

    it("rejects weak passwords and duplicate emails", async () => {
      let res = await request(app).post("/api/auth/register").send({ name: "X", email: "x@example.com", password: "short" });
      assert.equal(res.status, 400);
      res = await request(app).post("/api/auth/register").send({ name: "Alice2", email: A.email, password: "Passw0rd!" });
      assert.equal(res.status, 400);
    });

    it("never leaks password hashes", async () => {
      const res = await A.api.get("/api/auth/me");
      assert.equal(res.status, 200);
      assert.equal(res.body.user.passwordHash, undefined);
      assert.equal(res.body.user.email, A.email);
    });

    it("verifies email with a single-use token", async () => {
      const token = tokenFromMail(A.email, "/verify-email");
      let res = await request(app).post("/api/auth/verify-email").send({ token });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.emailVerified, true);
      res = await request(app).post("/api/auth/verify-email").send({ token });
      assert.equal(res.status, 400);
    });

    it("resets a password once and invalidates old tokens", async () => {
      const user = await registerUser("Resetter");
      const res0 = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
      assert.equal(res0.status, 200);
      const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });
      assert.equal(unknown.body.message, res0.body.message); // no enumeration
      const token = tokenFromMail(user.email, "/reset-password");
      let res = await request(app).post("/api/auth/reset-password").send({ token, password: "NewPassw0rd" });
      assert.equal(res.status, 200);
      res = await request(app).post("/api/auth/reset-password").send({ token, password: "Another1pass" });
      assert.equal(res.status, 400, "token must be single-use");
      res = await user.api.get("/api/auth/me");
      assert.equal(res.status, 401, "old access token revoked");
      res = await request(app).post("/api/auth/login").send({ email: user.email, password: "NewPassw0rd" });
      assert.equal(res.status, 200);
    });

    it("rotates refresh tokens and detects reuse", async () => {
      const agent = request.agent(app);
      const user = await registerUser("Refresher");
      await agent.post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" }).expect(200);
      const first = await agent.post("/api/auth/refresh").expect(200);
      assert.ok(first.body.accessToken);
      const oldCookie = first.request.cookies; // agent now holds the rotated cookie
      assert.ok(oldCookie !== undefined);
      await agent.post("/api/auth/refresh").expect(200);
      await agent.post("/api/auth/logout").expect(200);
      await agent.post("/api/auth/refresh").expect(401);
    });

    it("changes password and signs out other sessions", async () => {
      const user = await registerUser("Changer");
      const res = await user.api.post("/api/auth/change-password").send({ currentPassword: "Passw0rd!", newPassword: "Changed123" });
      assert.equal(res.status, 200);
      assert.equal((await user.api.get("/api/auth/me")).status, 401);
      assert.equal((await as(res.body.accessToken).get("/api/auth/me")).status, 200);
    });

    it("requires auth on protected routes", async () => {
      assert.equal((await request(app).get("/api/homes")).status, 401);
      assert.equal((await request(app).get("/api/homes").set("Authorization", "Bearer garbage")).status, 401);
    });

    it("persists appearance preferences", async () => {
      await A.api.patch("/api/users/me/preferences").send({ appearance: { mode: "dark", accent: "emerald" } }).expect(200);
      const me = await A.api.get("/api/auth/me");
      assert.equal(me.body.user.appearance.mode, "dark");
      assert.equal(me.body.user.appearance.accent, "emerald");
      assert.equal((await A.api.patch("/api/users/me/preferences").send({ appearance: { accent: "neon" } })).status, 400);
    });
  });

  describe("homes, invitations and joining", () => {
    it("creates homes with the creator as admin", async () => {
      const res = await A.api.post("/api/homes").send({
        name: "Green Villa",
        address: "Road 5, Dhaka",
        type: "bachelor_mess",
        settings: { rules: ["Keep the kitchen clean", "Quiet after 11pm"], departureNoticeDays: 15 },
      });
      assert.equal(res.status, 201);
      home = res.body.home;
      assert.deepEqual(home.myMembership.roles, ["admin"]);
      assert.equal(home.currency, "BDT");
      assert.ok(home.permissions.includes("home.delete"));
      home2 = (await A.api.post("/api/homes").send({ name: "Second Home" })).body.home;
      const list = await A.api.get("/api/homes");
      assert.equal(list.body.homes.length, 2);
    });

    it("joins via invitation link with approval", async () => {
      const inv = await A.api.post(`/api/homes/${home._id}/invitations`).send({ kind: "link", expiresInDays: 7, maxUses: 2 });
      assert.equal(inv.status, 201);
      const token = inv.body.token;
      const preview = await B.api.get(`/api/join/preview?token=${token}`);
      assert.equal(preview.status, 200);
      assert.equal(preview.body.home.name, "Green Villa");
      assert.deepEqual(preview.body.home.rules, ["Keep the kitchen clean", "Quiet after 11pm"]);

      assert.equal((await B.api.post("/api/join").send({ token })).status, 400, "rules must be accepted");
      const join = await B.api.post("/api/join").send({ token, rulesAccepted: true, room: "2B" });
      assert.equal(join.status, 201);
      assert.equal(join.body.status, "pending");
      assert.equal((await B.api.post("/api/join").send({ token, rulesAccepted: true })).status, 409, "duplicate");
      assert.equal((await B.api.get(`/api/homes/${home._id}`)).status, 404, "pending members have no access");

      const pending = await A.api.get(`/api/homes/${home._id}/members?status=pending`);
      const bm = pending.body.members.find((m) => m.user._id === B.user._id);
      await A.api.post(`/api/homes/${home._id}/members/${bm._id}/approve`).expect(200);
      assert.equal((await B.api.get(`/api/homes/${home._id}`)).status, 200);

      // revoke link → unusable
      await A.api.delete(`/api/homes/${home._id}/invitations/${inv.body.invitation._id}`).expect(200);
      assert.equal((await E.api.get(`/api/join/preview?token=${token}`)).status, 400);
    });

    it("enforces invitation usage limits", async () => {
      const inv = await A.api.post(`/api/homes/${home2._id}/invitations`).send({ kind: "link", maxUses: 1 });
      const x = await registerUser("Limit1");
      const y = await registerUser("Limit2");
      await x.api.post("/api/join").send({ token: inv.body.token, rulesAccepted: true }).expect(201);
      assert.equal((await y.api.post("/api/join").send({ token: inv.body.token, rulesAccepted: true })).status, 400);
    });

    it("joins via home code, and without approval when disabled", async () => {
      const code = (await A.api.get(`/api/homes/${home._id}`)).body.home.code;
      assert.ok(code);
      await C.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
      const pending = await A.api.get(`/api/homes/${home._id}/members?status=pending`);
      await A.api.post(`/api/homes/${home._id}/members/${pending.body.members[0]._id}/approve`).expect(200);

      await A.api.patch(`/api/homes/${home._id}/settings`).send({ requireApproval: false }).expect(200);
      const res = await D.api.post("/api/join").send({ code: code.toLowerCase(), rulesAccepted: true });
      assert.equal(res.body.status, "active");
      assert.equal((await E.api.post("/api/join").send({ code: "ZZZZZZZZ", rulesAccepted: true })).status, 404);

      const list = await A.api.get(`/api/homes/${home._id}/members`);
      for (const m of list.body.members) members[m.user.name] = m._id;
      assert.equal(Object.keys(members).length, 4);
    });

    it("supports in-app invitations with accept / decline", async () => {
      const inv = await A.api.post(`/api/homes/${home2._id}/invitations`).send({ kind: "direct", userId: E.user._id, message: "Join us" });
      assert.equal(inv.status, 201);
      const mine = await E.api.get("/api/invitations/mine");
      assert.equal(mine.body.invitations.length, 1);
      await E.api.post(`/api/invitations/${inv.body.invitation._id}/decline`).expect(200);
      assert.equal((await E.api.get("/api/invitations/mine")).body.invitations.length, 0);
    });

    it("isolates data between homes (no IDOR)", async () => {
      assert.equal((await B.api.get(`/api/homes/${home2._id}`)).status, 404);
      assert.equal((await B.api.get(`/api/homes/${home2._id}/expenses`)).status, 404);
      assert.equal((await E.api.get(`/api/homes/${home._id}/finance/overview`)).status, 404);
      assert.equal((await E.api.get(`/api/homes/${home._id}/members`)).status, 404);
    });
  });

  describe("role-based access control", () => {
    it("only the admin assigns roles", async () => {
      await A.api.patch(`/api/homes/${home._id}/members/${members.Bob}/roles`).send({ roles: ["manager"] }).expect(200);
      await A.api.patch(`/api/homes/${home._id}/members/${members.Chloe}/roles`).send({ roles: ["meal_manager"] }).expect(200);
      assert.equal((await B.api.patch(`/api/homes/${home._id}/members/${members.Dan}/roles`).send({ roles: ["manager"] })).status, 403);
      assert.equal((await A.api.patch(`/api/homes/${home._id}/members/${members.Dan}/roles`).send({ roles: ["admin"] })).status, 400, "cannot grant admin");
    });

    it("blocks privilege escalation through settings", async () => {
      assert.equal((await B.api.patch(`/api/homes/${home._id}/settings`).send({ rules: ["x"] })).status, 403);
      assert.equal((await B.api.patch(`/api/homes/${home._id}/settings`).send({ rolePermissions: { manager: ["members.roles"] } })).status, 403);
      assert.equal((await C.api.patch(`/api/homes/${home._id}/settings`).send({ requireApproval: true })).status, 403);
      await C.api.patch(`/api/homes/${home._id}/settings`).send({ mealOffCutoff: "21:00" }).expect(200);
      assert.equal((await D.api.patch(`/api/homes/${home._id}`).send({ name: "Hacked" })).status, 403);
      assert.equal((await A.api.patch(`/api/homes/${home._id}/settings`).send({ rolePermissions: { manager: ["home.delete"] } })).status, 400);
    });

    it("prevents members from touching others' money or meals", async () => {
      assert.equal((await D.api.post(`/api/homes/${home._id}/finance/payments`).send({ membershipId: members.Bob, amount: 100 })).status, 403);
      assert.equal((await D.api.put(`/api/homes/${home._id}/meals/entries`).send({ entries: [{ membershipId: members.Dan, day: today, counts: { lunch: 5 } }] })).status, 403);
      assert.equal((await C.api.post(`/api/homes/${home._id}/finance/payments`).send({ membershipId: members.Dan, amount: 100 })).status, 403);
      assert.equal((await D.api.get(`/api/homes/${home._id}/finance/accounts/${members.Bob}`)).status, 403);
      assert.equal((await D.api.get(`/api/homes/${home._id}/activity`)).status, 403);
    });

    it("lets the manager not remove other managers", async () => {
      assert.equal((await B.api.post(`/api/homes/${home._id}/members/${members.Chloe}/remove`).send({})).status, 403);
    });
  });

  describe("meals, expenses and the ledger", () => {
    let period;
    const d1 = addDays(today, -2);
    const d2 = addDays(today, -1);

    it("meal manager configures a period and records meals", async () => {
      const p = await C.api.post(`/api/homes/${home._id}/meals/periods`).send({ name: "Test period", startDay: addDays(today, -5), endDay: addDays(today, 20) });
      assert.equal(p.status, 201);
      period = p.body.period;
      assert.equal((await C.api.post(`/api/homes/${home._id}/meals/periods`).send({ name: "Overlap", startDay: today, endDay: addDays(today, 3) })).status, 409);

      const gen = await C.api.post(`/api/homes/${home._id}/meals/generate`).send({ from: d1, to: d1 });
      assert.equal(gen.body.created, 4);
      // Day 2: explicit entries. Breakfast weight is 0.5 by default.
      await C.api.put(`/api/homes/${home._id}/meals/entries`).send({
        entries: [
          { membershipId: members.Alice, day: d2, counts: { breakfast: 0, lunch: 1, dinner: 1 } },
          { membershipId: members.Bob, day: d2, counts: { breakfast: 0, lunch: 0, dinner: 0 } },
          { membershipId: members.Chloe, day: d2, counts: { breakfast: 0, lunch: 1, dinner: 1 } },
          { membershipId: members.Dan, day: d2, counts: { breakfast: 0, lunch: 1, dinner: 1 }, guests: { dinner: 1 } },
        ],
      }).expect(200);
      assert.equal((await C.api.put(`/api/homes/${home._id}/meals/entries`).send({ entries: [{ membershipId: members.Dan, day: d2, counts: { snack: 1 } }] })).status, 400);
    });

    it("meal manager can only record meal expenses", async () => {
      const res = await C.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Bazar", category: "groceries", amount: "1700.00", day: d1, paidBy: members.Chloe });
      assert.equal(res.status, 201);
      assert.equal(res.body.expense.allocation.mode, "meal_pool");
      assert.equal((await C.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Rent", category: "rent", amount: 100, day: d1 })).status, 403);
    });

    it("manager splits utilities equally with exact rounding", async () => {
      const res = await B.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Electricity", category: "utilities", amount: "1000.01", day: d1, allocationMode: "equal" });
      assert.equal(res.status, 201);
      const tx = await B.api.get(`/api/homes/${home._id}/finance/transactions?type=expense_share`);
      const shares = tx.body.items.map((i) => i.amount);
      assert.equal(shares.length, 4);
      assert.equal(shares.reduce((a, b) => a + b, 0), 100001);
    });

    it("handles submitted and recorded payments", async () => {
      const sub = await D.api.post(`/api/homes/${home._id}/finance/payments`).send({ amount: 500, method: "bkash" });
      assert.equal(sub.status, 201);
      assert.equal(sub.body.entry.status, "pending");
      await B.api.post(`/api/homes/${home._id}/finance/entries/${sub.body.entry._id}/approve`).expect(200);
      assert.equal((await B.api.post(`/api/homes/${home._id}/finance/entries/${sub.body.entry._id}/approve`)).status, 409);
      const rec = await B.api.post(`/api/homes/${home._id}/finance/payments`).send({ membershipId: members.Dan, amount: "300.50", method: "cash" });
      assert.equal(rec.body.entry.status, "posted");
      assert.equal(rec.body.entry.amount, 30050);
    });

    it("calculates the meal rate and closes the period into the ledger", async () => {
      const s = await C.api.get(`/api/homes/${home._id}/meals/periods/${period._id}`);
      const sum = s.body.summary;
      // d1: 4 members × (0.5 + 1 + 1) = 10 ; d2: A2 + B0 + C2 + D2 = 6 member meals + 1 guest
      assert.equal(sum.memberMeals, 16);
      assert.equal(sum.guestMeals, 1);
      assert.equal(sum.chargeableMeals, 17);
      assert.equal(sum.totalExpense, 170000);
      assert.equal(sum.rate, 10000); // 100.00 per meal
      const dan = sum.members.find((m) => m.membership === members.Dan);
      assert.equal(dan.meals, 4.5);
      assert.equal(dan.guestMeals, 1);
      assert.equal(dan.charge, 55000); // 5.5 meals × 100.00
      assert.equal(sum.members.reduce((a, m) => a + m.charge, 0), sum.totalExpense);

      // A plain member can see the summary but not other members' charges.
      const asMember = await D.api.get(`/api/homes/${home._id}/meals/periods/${period._id}`);
      assert.equal(asMember.body.summary.members.find((m) => m.membership === members.Bob).charge, undefined);

      const closed = await C.api.post(`/api/homes/${home._id}/meals/periods/${period._id}/close`);
      assert.equal(closed.status, 200);
      const mc = await A.api.get(`/api/homes/${home._id}/finance/transactions?type=meal_charge`);
      assert.equal(mc.body.items.reduce((a, e) => a + e.amount, 0), 170000);
    });

    it("keeps balances consistent: Σ balances = Σ credits − Σ debits", async () => {
      const o = await A.api.get(`/api/homes/${home._id}/finance/overview`);
      assert.equal(o.status, 200);
      const total = o.body.accounts.reduce((a, x) => a + x.balance, 0);
      // credits: payments 800.50 + reimbursement 1700 ; debits: utilities 1000.01 + meals 1700
      assert.equal(total, 80050 + 170000 - 100001 - 170000);
      const chloe = o.body.accounts.find((x) => String(x.membership) === members.Chloe);
      assert.equal(chloe.byType.reimbursement, 170000);
      assert.equal(o.body.totals.outstandingDues - o.body.totals.advances, 19951);
      // member view hides others' accounts
      const dv = await D.api.get(`/api/homes/${home._id}/finance/overview`);
      assert.equal(dv.body.accounts, undefined);
      assert.ok(typeof dv.body.mine.balance === "number");
    });

    it("locks closed periods and reverses charges on reopen", async () => {
      assert.equal((await C.api.put(`/api/homes/${home._id}/meals/entries`).send({ entries: [{ membershipId: members.Dan, day: d1, counts: { lunch: 3 } }] })).status, 400);
      assert.equal((await C.api.post(`/api/homes/${home._id}/expenses`).send({ title: "Late bazar", category: "groceries", amount: 10, day: d1 })).status, 400);
      assert.equal((await C.api.post(`/api/homes/${home._id}/meals/periods/${period._id}/reopen`).send({ reason: "fix" })).status, 403);
      await A.api.post(`/api/homes/${home._id}/meals/periods/${period._id}/reopen`).send({ reason: "Correction" }).expect(200);
      const rev = await A.api.get(`/api/homes/${home._id}/finance/transactions?type=reversal`);
      assert.equal(rev.body.items.reduce((a, e) => a + e.amount, 0), 170000);
      const o = await A.api.get(`/api/homes/${home._id}/finance/overview`);
      assert.equal(o.body.accounts.reduce((a, x) => a + x.balance, 0), 80050 - 100001 + 170000);
    });

    it("edits expenses with an audit trail and voids via reversal", async () => {
      const list = await B.api.get(`/api/homes/${home._id}/expenses?category=utilities`);
      const exp = list.body.expenses[0];
      const res = await B.api.patch(`/api/homes/${home._id}/expenses/${exp._id}`).send({ title: "Electricity (Oct)", category: "utilities", amount: "800", day: exp.day, allocationMode: "equal" });
      assert.equal(res.status, 200);
      assert.equal(res.body.expense.history.length, 2);
      assert.equal(res.body.expense.history[1].changes.amount.to, 80000);
      const shares = await B.api.get(`/api/homes/${home._id}/finance/transactions?type=expense_share`);
      const live = shares.body.items.filter((e) => !e.reversedBy);
      assert.equal(live.reduce((a, e) => a + e.amount, 0), 80000);
      await B.api.post(`/api/homes/${home._id}/expenses/${exp._id}/void`).send({ reason: "Duplicate bill" }).expect(200);
      const after = await B.api.get(`/api/homes/${home._id}/finance/transactions?type=expense_share`);
      assert.equal(after.body.items.filter((e) => !e.reversedBy).length, 0);
    });

    it("reverses payments instead of deleting them", async () => {
      const pays = await B.api.get(`/api/homes/${home._id}/finance/transactions?type=payment`);
      const p = pays.body.items.find((e) => e.amount === 30050);
      await B.api.post(`/api/homes/${home._id}/finance/entries/${p._id}/reverse`).send({ reason: "Wrong member" }).expect(200);
      assert.equal((await B.api.post(`/api/homes/${home._id}/finance/entries/${p._id}/reverse`).send({ reason: "again" })).status, 409);
      const acct = await D.api.get(`/api/homes/${home._id}/finance/accounts/${members.Dan}`);
      assert.ok(acct.body.entries.some((e) => e.type === "reversal"));
      assert.equal(acct.body.entries[0].runningBalance, acct.body.balance.balance);
    });

    it("exports CSV reports", async () => {
      const res = await B.api.get(`/api/homes/${home._id}/reports/outstanding-dues?format=csv`);
      assert.equal(res.status, 200);
      assert.match(res.headers["content-type"], /text\/csv/);
      assert.match(res.text, /Member,Status/);
      const json = await B.api.get(`/api/homes/${home._id}/reports/meal-consumption?month=${today.slice(0, 7)}`);
      assert.equal(json.status, 200);
      assert.equal((await D.api.get(`/api/homes/${home._id}/reports/outstanding-dues`)).status, 403);
    });
  });

  describe("request center", () => {
    const future = addDays(today, 3);

    it("handles meal-off requests with duplicate prevention", async () => {
      const r = await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "meal_off", startDay: future, mealTypes: ["lunch"], note: "Out for work" });
      assert.equal(r.status, 201);
      assert.equal((await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "meal_off", startDay: future })).status, 409);
      assert.equal((await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "meal_off", startDay: today })).status, 400, "past the cutoff");
      assert.equal((await D.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/approve`)).status, 403);
      const queue = await C.api.get(`/api/homes/${home._id}/requests?scope=review&status=pending`);
      assert.equal(queue.body.requests.length, 1);
      await C.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/approve`).send({ note: "OK" }).expect(200);
      const grid = await D.api.get(`/api/homes/${home._id}/meals/days?from=${future}&to=${future}`);
      const entry = grid.body.entries.find((e) => e.membership === members.Dan);
      assert.equal(entry.counts.lunch, 0);
      assert.equal(entry.counts.dinner, 1);
    });

    it("rejects requests for days in a closed meal period", async () => {
      const p = await C.api.post(`/api/homes/${home._id}/meals/periods`).send({ name: "Future", startDay: addDays(today, 40), endDay: addDays(today, 45) });
      await C.api.post(`/api/homes/${home._id}/meals/periods/${p.body.period._id}/close`).expect(200);
      const r = await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "meal_off", startDay: addDays(today, 41) });
      assert.equal(r.status, 400);
      assert.match(r.body.message, /closed/);
    });

    it("adds approved guest meals to the meal entry", async () => {
      const r = await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "guest_meal", startDay: future, mealTypes: ["dinner"], guestCount: 2, guestName: "Cousin" });
      assert.equal(r.status, 201);
      await C.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/approve`).expect(200);
      const grid = await D.api.get(`/api/homes/${home._id}/meals/days?from=${future}&to=${future}`);
      assert.equal(grid.body.entries.find((e) => e.membership === members.Dan).guests.dinner, 2);
    });

    it("enforces the departure notice period with admin-only exceptions", async () => {
      const info = await D.api.get(`/api/homes/${home._id}/requests/departure-info`);
      assert.equal(info.body.noticeDays, 15);
      assert.equal(info.body.earliestDay, addDays(today, 15));
      const tooSoon = addDays(today, 5);
      assert.equal((await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "departure", startDay: tooSoon })).status, 400);
      const r = await D.api.post(`/api/homes/${home._id}/requests`).send({ type: "departure", startDay: tooSoon, exceptionReason: "Job transfer" });
      assert.equal(r.status, 201);
      assert.equal(r.body.request.isException, true);
      assert.equal((await B.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/approve`)).status, 403);
      await A.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/approve`).expect(200);
      const m = await A.api.get(`/api/homes/${home._id}/members`);
      assert.equal(m.body.members.find((x) => x._id === members.Dan).scheduledLeaveDay, tooSoon);
      // withdraw the approved departure
      await D.api.post(`/api/homes/${home._id}/requests/${r.body.request._id}/cancel`).expect(200);
      assert.equal((await A.api.post(`/api/homes/${home._id}/requests`).send({ type: "departure", startDay: addDays(today, 30) })).status, 400, "admin must transfer ownership");
    });
  });

  describe("chat, friends and notifications", () => {
    let homeConv;

    it("home chat is limited to active members", async () => {
      const c = await B.api.get(`/api/chat/home/${home._id}`);
      assert.equal(c.status, 200);
      homeConv = c.body.conversation._id;
      const sent = await B.api.post(`/api/chat/${homeConv}/messages`).send({ body: "Bazar today? 🍛" });
      assert.equal(sent.status, 201);
      assert.equal((await E.api.get(`/api/chat/${homeConv}/messages`)).status, 404);
      assert.equal((await E.api.post(`/api/chat/${homeConv}/messages`).send({ body: "hi" })).status, 404);
      const list = await D.api.get("/api/chat/conversations");
      assert.equal(list.body.conversations.find((x) => x._id === homeConv).unread, 1);
      await D.api.post(`/api/chat/${homeConv}/read`).expect(200);
      assert.equal((await D.api.get("/api/chat/conversations")).body.conversations.find((x) => x._id === homeConv).unread, 0);
    });

    it("edits and deletes messages with audit, only by the sender", async () => {
      const msgs = await D.api.get(`/api/chat/${homeConv}/messages`);
      const m = msgs.body.messages[0];
      assert.equal((await D.api.patch(`/api/chat/messages/${m._id}`).send({ body: "hack" })).status, 403);
      const ed = await B.api.patch(`/api/chat/messages/${m._id}`).send({ body: "Bazar at 6pm?" });
      assert.ok(ed.body.message.editedAt);
      assert.equal(ed.body.message.edits, undefined);
      const del = await B.api.delete(`/api/chat/messages/${m._id}`);
      assert.equal(del.body.message.body, "");
    });

    it("friend requests, direct chat and unfriending", async () => {
      const search = await E.api.get(`/api/users/search?q=Dan`);
      assert.ok(search.body.users.some((u) => u._id === D.user._id));
      assert.equal(search.body.users[0].email, undefined, "search never exposes emails");
      assert.equal((await E.api.post("/api/chat/direct").send({ userId: D.user._id })).status, 403);
      const fr = await E.api.post("/api/friends/requests").send({ userId: D.user._id });
      assert.equal(fr.status, 201);
      assert.equal((await E.api.post("/api/friends/requests").send({ userId: D.user._id })).status, 409);
      const incoming = await D.api.get("/api/friends/requests");
      assert.equal(incoming.body.incoming.length, 1);
      await D.api.post(`/api/friends/requests/${fr.body.friendship._id}/accept`).expect(200);
      const conv = await E.api.post("/api/chat/direct").send({ userId: D.user._id });
      const cid = conv.body.conversation._id;
      await E.api.post(`/api/chat/${cid}/messages`).send({ body: "Hey Dan" }).expect(201);
      assert.equal((await A.api.get(`/api/chat/${cid}/messages`)).status, 404, "outsiders cannot read DMs");
      const dl = await D.api.get(`/api/chat/${cid}/messages`);
      assert.equal(dl.body.messages[0].body, "Hey Dan");
      await D.api.delete(`/api/friends/${E.user._id}`).expect(200);
      assert.equal((await E.api.post(`/api/chat/${cid}/messages`).send({ body: "still there?" })).status, 403);
    });

    it("notifications: unread count, mark read, mark all read", async () => {
      const n = await D.api.get("/api/notifications");
      assert.ok(n.body.unread > 0);
      assert.ok(n.body.items.some((i) => i.type === "request_reviewed"));
      await D.api.post(`/api/notifications/${n.body.items[0]._id}/read`).expect(200);
      await D.api.post("/api/notifications/read-all").expect(200);
      assert.equal((await D.api.get("/api/notifications/unread-count")).body.unread, 0);
      assert.equal((await E.api.post(`/api/notifications/${n.body.items[1]._id}/read`)).status, 404, "cannot touch others' notifications");
    });

    it("announcements and acknowledgement", async () => {
      assert.equal((await D.api.post(`/api/homes/${home._id}/announcements`).send({ title: "Hi all", body: "x" })).status, 403);
      const a = await B.api.post(`/api/homes/${home._id}/announcements`).send({ title: "Water off Friday", body: "Store water", important: true });
      assert.equal(a.status, 201);
      const ack = await D.api.post(`/api/homes/${home._id}/announcements/${a.body.announcement._id}/acknowledge`);
      assert.equal(ack.body.announcement.acknowledgements.length, 1);
    });

    it("grocery list → purchase creates a meal expense", async () => {
      const item = await C.api.post(`/api/homes/${home._id}/grocery`).send({ name: "Rice", quantity: 5, unit: "kg", assignedTo: members.Dan, estimatedCost: 400 });
      assert.equal(item.status, 201);
      assert.equal((await D.api.post(`/api/homes/${home._id}/grocery`).send({ name: "Chips" })).status, 403);
      const p = await C.api.post(`/api/homes/${home._id}/grocery/${item.body.item._id}/purchase`).send({ actualCost: "420", createExpense: true });
      assert.equal(p.status, 200);
      assert.ok(p.body.item.expense);
    });

    it("dashboard and calendar aggregate home data", async () => {
      const d = await D.api.get(`/api/homes/${home._id}/dashboard`);
      assert.equal(d.status, 200);
      assert.equal(d.body.memberCount, 4);
      const cal = await D.api.get(`/api/homes/${home._id}/calendar?from=${today}&to=${addDays(today, 40)}`);
      assert.ok(cal.body.items.some((i) => i.kind === "payment"));
    });
  });

  describe("membership lifecycle", () => {
    it("removing a member revokes access but keeps their history", async () => {
      const res = await B.api.post(`/api/homes/${home._id}/members/${members.Dan}/remove`).send({ reason: "Moved out" });
      assert.equal(res.status, 200);
      assert.equal(typeof res.body.balance, "number");
      assert.equal((await D.api.get(`/api/homes/${home._id}`)).status, 404);
      const conv = await B.api.get(`/api/chat/home/${home._id}`);
      assert.equal((await D.api.get(`/api/chat/${conv.body.conversation._id}/messages`)).status, 404);
      const acct = await A.api.get(`/api/homes/${home._id}/finance/accounts/${members.Dan}`);
      assert.ok(acct.body.entries.length > 0, "ledger preserved");
      assert.equal((await A.api.post(`/api/homes/${home._id}/members/${members.Alice}/remove`).send({})).status, 400, "admin cannot be removed");
    });

    it("transfers ownership before the admin can leave", async () => {
      await A.api.post(`/api/homes/${home._id}/transfer-ownership`).send({ membershipId: members.Bob }).expect(200);
      const bh = await B.api.get(`/api/homes/${home._id}`);
      assert.deepEqual(bh.body.home.myMembership.roles, ["admin"]);
      const ah = await A.api.get(`/api/homes/${home._id}`);
      assert.deepEqual(ah.body.home.myMembership.roles, ["manager"]);
    });

    it("archived homes are read-only; deletion needs the exact name", async () => {
      await A.api.post(`/api/homes/${home2._id}/archive`).expect(200);
      assert.equal((await A.api.post(`/api/homes/${home2._id}/announcements`).send({ title: "Test", body: "x" })).status, 403);
      assert.equal((await A.api.get(`/api/homes/${home2._id}/dashboard`)).status, 200);
      assert.equal((await A.api.delete(`/api/homes/${home2._id}`).send({ confirmName: "wrong" })).status, 400);
      await A.api.delete(`/api/homes/${home2._id}`).send({ confirmName: "Second Home" }).expect(200);
      assert.equal((await A.api.get(`/api/homes/${home2._id}`)).status, 404);
    });
  });
});
